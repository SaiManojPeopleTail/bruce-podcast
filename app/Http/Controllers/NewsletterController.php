<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class NewsletterController extends Controller
{
    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'max:255', 'email:rfc'],
        ]);

        $apiKey = config('services.mailchimp.api_key');
        $listId = config('services.mailchimp.audience_id');

        if (! is_string($apiKey) || $apiKey === '' || ! is_string($listId) || $listId === '') {
            Log::warning('Newsletter subscribe: Mailchimp is not configured.');

            return response()->json([
                'message' => 'Newsletter signup is not available right now. Please try again later.',
            ], 503);
        }

        $dataCenter = Str::afterLast($apiKey, '-');
        if ($dataCenter === '' || $dataCenter === $apiKey) {
            Log::warning('Newsletter subscribe: invalid Mailchimp API key format (missing data-center suffix).');

            return response()->json([
                'message' => 'Newsletter signup is not available right now. Please try again later.',
            ], 503);
        }

        $url = sprintf('https://%s.api.mailchimp.com/3.0/lists/%s/members', $dataCenter, $listId);

        $response = Http::withBasicAuth('anystring', $apiKey)
            ->acceptJson()
            ->asJson()
            ->post($url, [
                'email_address' => $validated['email'],
                'status' => 'subscribed',
            ]);

        if ($response->successful()) {
            return response()->json([
                'message' => 'Thanks — you are subscribed.',
            ]);
        }

        $body = $response->json();
        $title = is_array($body) ? ($body['title'] ?? null) : null;

        if ($response->status() === 400 && $title === 'Member Exists') {
            return response()->json([
                'message' => 'This email is already on the list.',
            ]);
        }

        Log::warning('Mailchimp subscribe failed', [
            'status' => $response->status(),
            'body' => $body,
        ]);

        return response()->json([
            'message' => 'Something went wrong. Please try again in a moment.',
        ], 422);
    }
}
