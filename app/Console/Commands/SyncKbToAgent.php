<?php

namespace App\Console\Commands;

use App\Models\ElevenLabsKnowledgeBase;
use App\Models\ProductQrList;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncKbToAgent extends Command
{
    protected $signature   = 'kb:sync-to-agent';
    protected $description = 'Attach all product knowledge bases to the ElevenLabs agent so per-conversation overrides work.';

    public function handle(): int
    {
        $apiKey  = config('services.elevenlabs.api_key');
        $agentId = config('services.elevenlabs.agent_id');

        if (! $apiKey || ! $agentId) {
            $this->error('ElevenLabs API key or agent ID not configured.');
            return 1;
        }

        $headers   = ['xi-api-key' => $apiKey];
        $agentBase = "https://api.elevenlabs.io/v1/convai/agents/{$agentId}";

        // Fetch current agent knowledge_base list
        $agentRes = Http::withHeaders($headers)->get($agentBase);
        if (! $agentRes->successful()) {
            $this->error('Could not fetch agent: ' . $agentRes->status());
            return 1;
        }

        $existing    = $agentRes->json('conversation_config.agent.prompt.knowledge_base') ?? [];
        $existingIds = array_column($existing, 'id');

        $products = ProductQrList::query()
            ->whereNotNull('elevenlabs_kb_id')
            ->get(['product_name', 'elevenlabs_kb_id', 'kb_name']);

        // Also include KB registry documents not tied to any product
        $registryOnly = ElevenLabsKnowledgeBase::query()
            ->whereNotIn('elevenlabs_kb_id', $products->pluck('elevenlabs_kb_id')->filter()->all())
            ->get(['elevenlabs_kb_id', 'kb_name']);

        $allKbs = collect();
        foreach ($products as $p) {
            $allKbs->push(['id' => $p->elevenlabs_kb_id, 'name' => $p->kb_name ?? ($p->product_name . ' — Knowledge Base')]);
        }
        foreach ($registryOnly as $r) {
            $allKbs->push(['id' => $r->elevenlabs_kb_id, 'name' => $r->kb_name]);
        }

        $toAdd = [];
        foreach ($allKbs as $kb) {
            $kbId = $kb['id'];
            if (! in_array($kbId, $existingIds, true)) {
                $toAdd[] = [
                    'type'       => 'file',
                    'name'       => $kb['name'],
                    'id'         => $kbId,
                    'usage_mode' => 'auto',
                ];
                $this->line("  + Queuing: {$kbId}");
            } else {
                $this->line("  ~ Already attached: {$kbId}");
            }
        }

        if (empty($toAdd)) {
            $this->info('All knowledge bases are already attached to the agent.');
            return 0;
        }

        $updated  = array_merge($existing, $toAdd);
        $patchRes = Http::withHeaders($headers)->patch($agentBase, [
            'conversation_config' => [
                'agent' => [
                    'prompt' => ['knowledge_base' => $updated],
                ],
            ],
        ]);

        if (! $patchRes->successful()) {
            $this->error('Patch failed: ' . $patchRes->status() . ' — ' . $patchRes->body());
            return 1;
        }

        $this->info('Successfully attached ' . count($toAdd) . ' knowledge base(s) to the agent.');
        return 0;
    }
}
