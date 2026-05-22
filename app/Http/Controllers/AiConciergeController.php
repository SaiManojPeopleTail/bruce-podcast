<?php

namespace App\Http\Controllers;

use App\Jobs\SendProductEnquiryNotificationJob;
use App\Models\ElevenLabsKnowledgeBase;
use App\Models\ProductEnquiry;
use App\Models\ProductQrList;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiConciergeController extends Controller
{
    private const TOOL_CACHE_TTL = 3600; // 1 hour

    /** Tool configurations: name → tool_config body for POST /v1/convai/tools */
    private function toolConfigs(): array
    {
        return [
            'invoke_form' => [
                'type'        => 'client',
                'name'        => 'invoke_form',
                'description' => 'Show the product enquiry form to the user. Call this as soon as the user expresses interest in ordering, enquiring, or providing contact details.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'reason' => ['type' => 'string', 'description' => 'Brief reason for showing the form, e.g. "user wants to enquire"'],
                    ],
                    'required' => [],
                ],
                'expects_response' => true,
            ],
            'fill_form' => [
                'type'        => 'client',
                'name'        => 'fill_form',
                'description' => 'Pre-fill the enquiry form fields with information already collected from the user during conversation.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'name'       => ['type' => 'string', 'description' => "User's full name"],
                        'store_name' => ['type' => 'string', 'description' => "User's store or business name"],
                        'phone'      => ['type' => 'string', 'description' => "User's phone number"],
                        'email'      => ['type' => 'string', 'description' => "User's email address"],
                        'message'    => ['type' => 'string', 'description' => 'Optional additional notes or message'],
                    ],
                    'required' => [],
                ],
                'expects_response' => true,
            ],
            'submit_form' => [
                'type'        => 'client',
                'name'        => 'submit_form',
                'description' => 'Submit the filled enquiry form. Only call this after the user has confirmed they are ready to submit.',
                'parameters'  => ['type' => 'object', 'properties' => new \stdClass(), 'required' => []],
                'expects_response' => true,
            ],
        ];
    }

    /**
     * Ensure the three client tools exist in the workspace and are assigned to the agent,
     * and that knowledge_base is enabled as an overridable field on the agent.
     * Uses tool_ids (not inline tools) as required by the ElevenLabs API.
     * Result is cached per agent ID; cache is only written on success.
     */
    private function ensureClientTools(string $apiKey, string $agentId): void
    {
        $cacheKey = "elevenlabs_tools_ok_{$agentId}";

        if (Cache::get($cacheKey)) {
            return;
        }

        $headers   = ['xi-api-key' => $apiKey];
        $toolsBase = 'https://api.elevenlabs.io/v1/convai/tools';
        $agentBase = "https://api.elevenlabs.io/v1/convai/agents/{$agentId}";

        // 1. Fetch all existing workspace tools and index by name
        $listRes = Http::withHeaders($headers)->get($toolsBase);
        if (! $listRes->successful()) {
            Log::warning('[AiConcierge] Could not list tools', ['status' => $listRes->status()]);
            return;
        }
        $existingByName = [];
        foreach ($listRes->json('tools') ?? [] as $t) {
            $existingByName[$t['tool_config']['name']] = $t['id'];
        }

        // 2. Create any missing tools
        $toolIds = [];
        foreach ($this->toolConfigs() as $name => $config) {
            if (isset($existingByName[$name])) {
                $toolIds[] = $existingByName[$name];
            } else {
                $r = Http::withHeaders($headers)->post($toolsBase, ['tool_config' => $config]);
                if (! $r->successful() || ! $r->json('id')) {
                    Log::warning("[AiConcierge] Could not create tool '{$name}'", ['status' => $r->status(), 'body' => $r->body()]);
                    return;
                }
                $toolIds[] = $r->json('id');
            }
        }

        // 3. Fetch agent config
        $agentRes = Http::withHeaders($headers)->get($agentBase);
        if (! $agentRes->successful()) {
            Log::warning('[AiConcierge] Could not fetch agent', ['status' => $agentRes->status()]);
            return;
        }

        $assignedIds        = $agentRes->json('conversation_config.agent.prompt.tool_ids') ?? [];
        $kbOverrideEnabled  = $agentRes->json('platform_settings.overrides.conversation_config_override.agent.prompt.knowledge_base') ?? false;
        $missing            = array_diff($toolIds, $assignedIds);

        if (empty($missing) && $kbOverrideEnabled) {
            Cache::put($cacheKey, true, self::TOOL_CACHE_TTL);
            return;
        }

        // 4. Patch agent: merge tool_ids + enable knowledge_base override
        $merged   = array_values(array_unique(array_merge($assignedIds, $toolIds)));
        $patchRes = Http::withHeaders($headers)->patch($agentBase, [
            'conversation_config' => [
                'agent' => [
                    'prompt' => ['tool_ids' => $merged],
                ],
            ],
            'platform_settings' => [
                'overrides' => [
                    'conversation_config_override' => [
                        'agent' => [
                            'prompt' => [
                                'prompt'         => true,
                                'knowledge_base' => true,
                            ],
                        ],
                    ],
                ],
            ],
        ]);

        if (! $patchRes->successful()) {
            Log::warning('[AiConcierge] Could not patch agent', ['status' => $patchRes->status(), 'body' => $patchRes->body()]);
            return;
        }

        Cache::put($cacheKey, true, self::TOOL_CACHE_TTL);
    }

    /* ── Knowledge Base management ───────────────────────────────────────── */

    private const KB_BASE   = 'https://api.elevenlabs.io/v1/convai/knowledge-base';
    private const AGENT_BASE = 'https://api.elevenlabs.io/v1/convai/agents';

    /**
     * Add or remove a KB document from the agent's base knowledge_base list.
     * ElevenLabs requires the document to be pre-attached to the agent before
     * it can be referenced in per-conversation overrides.
     *
     * @param string      $apiKey
     * @param string      $kbId     ElevenLabs KB document ID
     * @param string|null $kbName   Human-readable name (only needed when adding)
     * @param bool        $remove   True to remove, false to add
     */
    private function syncKbOnAgent(string $apiKey, string $kbId, ?string $kbName = null, bool $remove = false): void
    {
        $agentId = config('services.elevenlabs.agent_id');
        if (! $agentId) {
            return;
        }

        $headers   = ['xi-api-key' => $apiKey];
        $agentBase = self::AGENT_BASE . "/{$agentId}";

        $agentRes = Http::withHeaders($headers)->get($agentBase);
        if (! $agentRes->successful()) {
            Log::warning('[AiConcierge] syncKbOnAgent: could not fetch agent', ['status' => $agentRes->status()]);
            return;
        }

        $current = $agentRes->json('conversation_config.agent.prompt.knowledge_base') ?? [];

        if ($remove) {
            $updated = array_values(array_filter($current, fn ($k) => ($k['id'] ?? '') !== $kbId));
        } else {
            $ids = array_column($current, 'id');
            if (in_array($kbId, $ids, true)) {
                return; // already attached — nothing to do
            }
            $updated   = $current;
            $updated[] = [
                'type'       => 'file',
                'name'       => $kbName ?? 'Knowledge Base',
                'id'         => $kbId,
                'usage_mode' => 'auto',
            ];
        }

        $patchRes = Http::withHeaders($headers)->patch($agentBase, [
            'conversation_config' => [
                'agent' => [
                    'prompt' => ['knowledge_base' => $updated],
                ],
            ],
        ]);

        if (! $patchRes->successful()) {
            Log::warning('[AiConcierge] syncKbOnAgent: patch failed', ['status' => $patchRes->status(), 'body' => $patchRes->body()]);
        }

        // Bust the tools cache so ensureClientTools re-runs on next request
        Cache::forget("elevenlabs_tools_ok_{$agentId}");
    }

    /**
     * Upload a text snippet or file to ElevenLabs as a knowledge base document,
     * trigger RAG indexing, and store the document ID on the product.
     */
    public function uploadKb(Request $request, string $slug): JsonResponse
    {
        $product = ProductQrList::query()->where('slug', $slug)->firstOrFail();

        $apiKey = config('services.elevenlabs.api_key');
        if (! $apiKey) {
            return response()->json(['error' => 'ElevenLabs API key not configured.'], 503);
        }

        $headers = ['xi-api-key' => $apiKey];
        $kbName  = trim($request->input('kb_name', '')) ?: ($product->product_name . ' — Knowledge Base');

        if ($request->hasFile('file')) {
            $kbType   = 'file';
            $file     = $request->file('file');
            $response = Http::withHeaders($headers)
                ->attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName())
                ->post(self::KB_BASE . '/file', ['name' => $kbName]);
        } else {
            $kbType    = 'text';
            $validated = $request->validate(['text' => ['required', 'string', 'max:200000']]);
            $response  = Http::withHeaders($headers)
                ->post(self::KB_BASE . '/text', [
                    'text' => $validated['text'],
                    'name' => $kbName,
                ]);
        }

        if (! $response->successful()) {
            Log::warning('[AiConcierge] KB upload failed', ['status' => $response->status(), 'body' => $response->body()]);
            return response()->json(['error' => 'Failed to upload knowledge base to ElevenLabs.'], 502);
        }

        $newKbId = $response->json('id');
        if (! $newKbId) {
            return response()->json(['error' => 'Unexpected response from ElevenLabs.'], 502);
        }

        // Remove old KB from ElevenLabs + agent if it's being replaced
        $oldKbId = $product->elevenlabs_kb_id;
        if ($oldKbId && $oldKbId !== $newKbId) {
            // Only delete from ElevenLabs if no other product still references it
            $otherRefs = ProductQrList::query()
                ->where('elevenlabs_kb_id', $oldKbId)
                ->where('slug', '!=', $slug)
                ->exists();
            if (! $otherRefs) {
                Http::withHeaders($headers)->delete(self::KB_BASE . "/{$oldKbId}");
                $this->syncKbOnAgent($apiKey, $oldKbId, null, true);
            }
        }

        // Trigger RAG indexing (idempotent — returns current status if already indexed)
        $ragRes    = Http::withHeaders($headers)
            ->post(self::KB_BASE . "/{$newKbId}/rag-index", ['model' => 'e5_mistral_7b_instruct']);
        $ragStatus = $ragRes->json('status') ?? 'processing';

        // Attach the new KB to the agent's base config so overrides work
        $this->syncKbOnAgent($apiKey, $newKbId, $kbName);

        // Register in the global KB registry (so it survives product unlinking)
        ElevenLabsKnowledgeBase::updateOrCreate(
            ['elevenlabs_kb_id' => $newKbId],
            ['kb_name' => $kbName, 'kb_type' => $kbType, 'kb_rag_status' => $ragStatus],
        );

        $product->update([
            'elevenlabs_kb_id' => $newKbId,
            'kb_rag_status'    => $ragStatus,
            'kb_name'          => $kbName,
            'kb_type'          => $kbType,
        ]);

        return response()->json([
            'kb_id'      => $newKbId,
            'rag_status' => $ragStatus,
            'kb_name'    => $kbName,
            'kb_type'    => $kbType,
        ]);
    }

    /**
     * Poll RAG index status for the product's knowledge base document.
     * Uses the idempotent POST endpoint (triggers indexing if not yet started).
     */
    public function kbRagStatus(string $slug): JsonResponse
    {
        $product = ProductQrList::query()->where('slug', $slug)->firstOrFail();

        if (! $product->elevenlabs_kb_id) {
            return response()->json(['status' => null]);
        }

        $apiKey = config('services.elevenlabs.api_key');
        $res    = Http::withHeaders(['xi-api-key' => $apiKey])
            ->post(self::KB_BASE . "/{$product->elevenlabs_kb_id}/rag-index", [
                'model' => 'e5_mistral_7b_instruct',
            ]);

        if (! $res->successful()) {
            return response()->json(['status' => $product->kb_rag_status ?? 'unknown']);
        }

        $status = $res->json('status') ?? 'unknown';
        $product->update(['kb_rag_status' => $status]);

        // Keep the registry in sync
        ElevenLabsKnowledgeBase::where('elevenlabs_kb_id', $product->elevenlabs_kb_id)
            ->update(['kb_rag_status' => $status]);

        return response()->json([
            'status'   => $status,
            'progress' => $res->json('progress_percentage'),
        ]);
    }

    /**
     * List all known knowledge base documents from the registry (for the "reuse" picker).
     * Documents remain here even after being unlinked from every product.
     */
    public function kbList(): JsonResponse
    {
        $kbs = ElevenLabsKnowledgeBase::query()
            ->orderBy('kb_name')
            ->get(['elevenlabs_kb_id', 'kb_name', 'kb_type', 'kb_rag_status']);

        // Attach a list of products currently using each KB (for display context)
        $assignments = ProductQrList::query()
            ->whereNotNull('elevenlabs_kb_id')
            ->get(['slug', 'product_name', 'elevenlabs_kb_id']);

        $byKb = $assignments->groupBy('elevenlabs_kb_id');

        $items = $kbs->map(fn ($kb) => [
            'elevenlabs_kb_id' => $kb->elevenlabs_kb_id,
            'kb_name'          => $kb->kb_name,
            'kb_type'          => $kb->kb_type ?? 'file',
            'kb_rag_status'    => $kb->kb_rag_status,
            'used_by'          => ($byKb[$kb->elevenlabs_kb_id] ?? collect())->map(fn ($p) => [
                'slug'         => $p->slug,
                'product_name' => $p->product_name,
            ])->values(),
        ]);

        return response()->json($items);
    }

    /**
     * Assign an existing ElevenLabs KB document to this product (no new upload).
     * The source document is NOT deleted — it stays on ElevenLabs and may remain
     * assigned to the source product too.
     */
    public function assignKb(Request $request, string $slug): JsonResponse
    {
        $product = ProductQrList::query()->where('slug', $slug)->firstOrFail();

        $validated = $request->validate([
            'kb_id'      => ['required', 'string'],
            'kb_name'    => ['nullable', 'string', 'max:255'],
            'kb_type'    => ['nullable', 'string'],
            'rag_status' => ['nullable', 'string'],
        ]);

        $product->update([
            'elevenlabs_kb_id' => $validated['kb_id'],
            'kb_rag_status'    => $validated['rag_status'] ?? 'succeeded',
            'kb_name'          => $validated['kb_name'] ?? null,
            'kb_type'          => $validated['kb_type'] ?? 'file',
        ]);

        // Ensure the document is attached to the agent (idempotent — skips if already there)
        $apiKey = config('services.elevenlabs.api_key');
        if ($apiKey) {
            $this->syncKbOnAgent($apiKey, $validated['kb_id'], $validated['kb_name']);
        }

        return response()->json([
            'kb_id'      => $validated['kb_id'],
            'rag_status' => $validated['rag_status'] ?? 'succeeded',
            'kb_name'    => $validated['kb_name'] ?? null,
            'kb_type'    => $validated['kb_type'] ?? 'file',
        ]);
    }

    /**
     * Unlink the KB from this product only — does NOT touch ElevenLabs or other products.
     */
    public function unlinkKb(string $slug): JsonResponse
    {
        $product = ProductQrList::query()->where('slug', $slug)->firstOrFail();

        $product->update([
            'elevenlabs_kb_id' => null,
            'kb_rag_status'    => null,
            'kb_name'          => null,
            'kb_type'          => null,
        ]);

        return response()->json(['success' => true]);
    }

    /**
     * Purge a KB document entirely: delete from ElevenLabs and clear it from
     * every product_qr_lists row that references it.
     */
    public function purgeKb(string $kbId): JsonResponse
    {
        $apiKey = config('services.elevenlabs.api_key');

        Http::withHeaders(['xi-api-key' => $apiKey])->delete(self::KB_BASE . "/{$kbId}");

        // Remove from the agent's base KB list so it no longer shows in overrides
        if ($apiKey) {
            $this->syncKbOnAgent($apiKey, $kbId, null, true);
        }

        // Delete from the registry — this is the only place it's truly removed
        ElevenLabsKnowledgeBase::where('elevenlabs_kb_id', $kbId)->delete();

        ProductQrList::query()
            ->where('elevenlabs_kb_id', $kbId)
            ->update([
                'elevenlabs_kb_id' => null,
                'kb_rag_status'    => null,
                'kb_name'          => null,
            ]);

        return response()->json(['success' => true]);
    }

    /**
     * Return a short-lived signed WebSocket URL from ElevenLabs Conversational AI.
     * Also ensures the three client tools are registered on the agent (cached).
     */
    public function signedUrl(): JsonResponse
    {
        $apiKey  = config('services.elevenlabs.api_key');
        $agentId = config('services.elevenlabs.agent_id');

        if (! $apiKey || ! $agentId) {
            return response()->json(['error' => 'AI Concierge is not configured.'], 503);
        }

        // Best-effort: ensure client tools exist on the agent (result cached 1 h)
        $this->ensureClientTools($apiKey, $agentId);

        $response = Http::withHeaders([
            'xi-api-key' => $apiKey,
        ])->get('https://api.elevenlabs.io/v1/convai/conversation/get-signed-url', [
            'agent_id' => $agentId,
        ]);

        if (! $response->successful()) {
            return response()->json(
                ['error' => 'Could not obtain a session token. Please try again.'],
                $response->status() ?: 502,
            );
        }

        $signedUrl = $response->json('signed_url');

        if (! $signedUrl) {
            return response()->json(['error' => 'Invalid response from AI service.'], 502);
        }

        return response()->json(['signed_url' => $signedUrl]);
    }

    /**
     * Submit an enquiry from the AI Concierge form (JSON endpoint — no Inertia redirect).
     */
    public function submitEnquiry(Request $request, string $slug): JsonResponse
    {
        $product = ProductQrList::query()->where('slug', $slug)->firstOrFail();

        $request->merge([
            'email'      => is_string($request->input('email'))      ? trim($request->input('email'))      : $request->input('email'),
            'store_name' => is_string($request->input('store_name')) ? trim($request->input('store_name')) : $request->input('store_name'),
            'message'    => is_string($request->input('message'))    ? trim($request->input('message'))    : $request->input('message'),
        ]);

        $validated = $request->validate([
            'name'       => ['required', 'string', 'max:255'],
            'store_name' => ['required', 'string', 'max:255'],
            'phone'      => ['required', 'string', 'max:64'],
            'email'      => ['required', 'string', 'max:255', 'email:rfc,strict,spoof'],
            'message'    => ['nullable', 'string', 'max:10000'],
        ]);

        $notifyTo           = trim((string) ($product->notification_email ?? ''));
        $notificationStatus = $notifyTo !== '' ? 'pending' : 'na';

        $enquiry = ProductEnquiry::query()->create([
            'product_qr_list_id'  => $product->id,
            'name'                => $validated['name'],
            'store_name'          => $validated['store_name'],
            'phone'               => $validated['phone'],
            'email'               => $validated['email'],
            'message'             => $validated['message'] ?? '',
            'notification_status' => $notificationStatus,
        ]);

        if ($notificationStatus === 'pending') {
            SendProductEnquiryNotificationJob::dispatchAfterResponse($enquiry->id);
        }

        return response()->json(['success' => true, 'message' => 'Thank you! We have received your enquiry.']);
    }
}
