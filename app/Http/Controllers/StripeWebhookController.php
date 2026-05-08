<?php

namespace App\Http\Controllers;

use App\Services\MerchCheckoutFulfillmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;

class StripeWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $secret = config('services.stripe.webhook_secret');

        if ($secret) {
            try {
                $event = Webhook::constructEvent($payload, $sigHeader, $secret);
            } catch (SignatureVerificationException $e) {
                Log::warning('Stripe webhook signature failure: '.$e->getMessage());

                return response()->json(['error' => 'Invalid signature'], 400);
            }
        } else {
            // Dev/local — parse without verification
            $event = json_decode($payload, true);
        }

        $type = is_array($event) ? ($event['type'] ?? '') : ($event->type ?? '');

        if ($type !== 'payment_intent.succeeded') {
            return response()->json(['status' => 'ignored']);
        }

        $pi = is_array($event) ? $event['data']['object'] : $event->data->object;
        $piArray = is_array($pi) ? $pi : json_decode(json_encode($pi), true);

        $order = app(MerchCheckoutFulfillmentService::class)->fulfillFromPaymentIntentPayload($piArray);

        return response()->json(['status' => $order ? 'ok' : 'ignored']);
    }
}
