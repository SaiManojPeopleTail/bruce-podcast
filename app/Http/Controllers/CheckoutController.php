<?php

namespace App\Http\Controllers;

use App\Models\MerchOrder;
use App\Models\MerchOrderItem;
use App\Models\MerchProduct;
use App\Services\MerchCheckoutFulfillmentService;
use App\Services\PrintifyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Stripe\StripeClient;

class CheckoutController extends Controller
{
    public function index()
    {
        abort_if(! config('services.merch.purchase_enabled'), 404);

        return Inertia::render('Merch/Checkout', [
            'stripeKey' => config('services.stripe.key'),
        ]);
    }

    public function initiate(Request $request)
    {
        abort_if(! config('services.merch.purchase_enabled'), 404);
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:200'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address_line1' => ['required', 'string', 'max:200'],
            'address_line2' => ['nullable', 'string', 'max:200'],
            'city' => ['required', 'string', 'max:100'],
            'region' => ['required', 'string', 'max:100'],
            'zip' => ['required', 'string', 'max:20'],
            'country' => ['required', 'string', 'size:2'],
            'shipping_method' => ['required', 'integer'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.printify_product_id' => ['required', 'string'],
            'items.*.printify_variant_id' => ['required', 'string'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:50'],
        ]);

        // Re-fetch prices from DB — never trust client-sent prices
        $subtotal = 0;
        $lineItems = [];
        $cartSnapshot = [];

        foreach ($data['items'] as $item) {
            $product = MerchProduct::where('printify_product_id', $item['printify_product_id'])
                ->where('is_visible', true)
                ->firstOrFail();

            $variant = collect($product->variants ?? [])
                ->firstWhere('variant_id', $item['printify_variant_id']);

            abort_if(! $variant, 422, "Variant {$item['printify_variant_id']} not found.");
            abort_if(! ($variant['is_available'] ?? true), 422, 'Variant is not available.');

            $unitPrice = (int) ($variant['our_price'] ?? 0);
            $qty = (int) $item['quantity'];
            $subtotal += $unitPrice * $qty;

            $lineItems[] = [
                'product_id' => $item['printify_product_id'],
                'variant_id' => (int) $item['printify_variant_id'],
                'quantity' => $qty,
            ];
            $cartSnapshot[] = [
                'printify_product_id' => $item['printify_product_id'],
                'printify_variant_id' => $item['printify_variant_id'],
                'product_title' => $product->title,
                'variant_title' => $variant['title'] ?? null,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
            ];
        }

        // Calculate shipping options from Printify
        $addressTo = [
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? '',
            'country' => $data['country'],
            'region' => $data['region'],
            'address1' => $data['address_line1'],
            'address2' => $data['address_line2'] ?? '',
            'city' => $data['city'],
            'zip' => $data['zip'],
        ];

        $printify = app(PrintifyService::class);
        $shippingData = $printify->calculateShipping($lineItems, $addressTo);
        $shippingOptions = $shippingData['standard'] ?? [];

        // Find selected shipping cost
        $selectedMethod = (int) $data['shipping_method'];
        $shippingCost = 0;
        $allShipping = array_merge(
            isset($shippingData['standard']) ? [$shippingData['standard']] : [],
            $shippingData['express'] ?? []
        );
        foreach ($allShipping as $opt) {
            if (($opt['id'] ?? null) === $selectedMethod) {
                $shippingCost = (int) ($opt['rate'] ?? 0);
                break;
            }
        }

        // Tax
        $taxRate = (float) config('app.merch_tax_rate', env('MERCH_TAX_RATE', 0));
        $taxAmount = (int) round(($subtotal + $shippingCost) * $taxRate);
        $total = $subtotal + $shippingCost + $taxAmount;

        $fullName = $data['first_name'].' '.$data['last_name'];

        $order = DB::transaction(function () use ($data, $cartSnapshot, $subtotal, $shippingCost, $taxRate, $taxAmount, $total, $selectedMethod, $fullName): MerchOrder {
            $order = MerchOrder::create([
                'uuid' => Str::uuid(),
                'stripe_payment_intent_id' => null,
                'status' => 'pending_payment',
                'customer_name' => $fullName,
                'customer_email' => $data['email'],
                'customer_phone' => $data['phone'] ?? null,
                'address_first_name' => $data['first_name'],
                'address_last_name' => $data['last_name'],
                'address_line1' => $data['address_line1'],
                'address_line2' => $data['address_line2'] ?? null,
                'address_city' => $data['city'],
                'address_region' => $data['region'],
                'address_zip' => $data['zip'],
                'address_country' => $data['country'],
                'subtotal_amount' => $subtotal,
                'shipping_cost' => $shippingCost,
                'tax_rate' => $taxRate,
                'tax_amount' => $taxAmount,
                'total_amount' => $total,
                'shipping_method' => $selectedMethod,
            ]);

            foreach ($cartSnapshot as $item) {
                MerchOrderItem::create([
                    'merch_order_id' => $order->id,
                    'printify_product_id' => $item['printify_product_id'],
                    'printify_variant_id' => $item['printify_variant_id'],
                    'product_title' => $item['product_title'] ?? '',
                    'variant_title' => $item['variant_title'] ?? null,
                    'quantity' => (int) $item['quantity'],
                    'unit_price' => (int) $item['unit_price'],
                ]);
            }

            return $order;
        });

        $stripe = new StripeClient(config('services.stripe.secret'));
        try {
            $intent = $stripe->paymentIntents->create([
                'amount' => $total,
                'currency' => 'usd',
                'payment_method_types' => ['card'],
                'metadata' => [
                    'merch_order_uuid' => $order->uuid,
                    'cart_json' => json_encode($cartSnapshot),
                    'address_json' => json_encode(array_merge($addressTo, [
                        'full_name' => $fullName,
                        'phone' => $data['phone'] ?? '',
                    ])),
                    'shipping_method' => (string) $selectedMethod,
                    'subtotal' => (string) $subtotal,
                    'shipping_cost' => (string) $shippingCost,
                    'tax_rate' => (string) $taxRate,
                    'tax_amount' => (string) $taxAmount,
                ],
            ]);
        } catch (\Throwable $e) {
            $order->items()->delete();
            $order->delete();
            report($e);

            return response()->json(['message' => 'Could not start payment. Please try again.'], 502);
        }

        $order->update(['stripe_payment_intent_id' => $intent->id]);

        return response()->json([
            'clientSecret' => $intent->client_secret,
            'orderUuid' => $order->uuid,
            'shippingOptions' => $shippingData,
            'subtotal' => $subtotal,
            'shippingCost' => $shippingCost,
            'taxRate' => $taxRate,
            'taxAmount' => $taxAmount,
            'total' => $total,
        ]);
    }

    /**
     * Poll payment completion; may sync PaymentIntent with our DB when webhooks are missing (local dev).
     */
    public function lookupOrderByPaymentIntent(string $paymentIntentId)
    {
        abort_unless(str_starts_with($paymentIntentId, 'pi_'), 404);

        $order = MerchOrder::where('stripe_payment_intent_id', $paymentIntentId)->first();

        $stripe = new StripeClient(config('services.stripe.secret'));
        if ($order && $order->status === 'pending_payment') {
            try {
                $pi = $stripe->paymentIntents->retrieve($paymentIntentId);
                $piArray = json_decode(json_encode($pi), true, 512, JSON_THROW_ON_ERROR);
                app(MerchCheckoutFulfillmentService::class)->fulfillFromPaymentIntentPayload($piArray);
                $order->refresh();
            } catch (\Throwable) {
                // PI not ready or Stripe error — keep polling
            }
        }

        if ($order && $order->status !== 'pending_payment') {
            return response()->json(['ready' => true, 'uuid' => $order->uuid]);
        }

        if (! $order) {
            try {
                $pi = $stripe->paymentIntents->retrieve($paymentIntentId);
                $piArray = json_decode(json_encode($pi), true, 512, JSON_THROW_ON_ERROR);
            } catch (\Throwable) {
                return response()->json(['ready' => false]);
            }

            $order = app(MerchCheckoutFulfillmentService::class)->fulfillFromPaymentIntentPayload($piArray);
            if ($order && $order->status !== 'pending_payment') {
                return response()->json(['ready' => true, 'uuid' => $order->uuid]);
            }
        }

        return response()->json(['ready' => false]);
    }

    /**
     * @param  string  $token  Merch order UUID, or Stripe PaymentIntent id (pi_…) right after pay.
     */
    public function confirmation(string $token)
    {
        if (str_starts_with($token, 'pi_')) {
            $order = MerchOrder::where('stripe_payment_intent_id', $token)->with('items')->first();
            if ($order) {
                return redirect()->route('checkout.confirmation', $order->uuid);
            }

            return Inertia::render('Merch/ConfirmationPending', [
                'paymentIntentId' => $token,
            ]);
        }

        $order = MerchOrder::where('uuid', $token)
            ->with('items')
            ->firstOrFail();

        if ($order->status === 'pending_payment' && $order->stripe_payment_intent_id) {
            return Inertia::render('Merch/ConfirmationPending', [
                'paymentIntentId' => $order->stripe_payment_intent_id,
            ]);
        }

        return Inertia::render('Merch/Confirmation', [
            'order' => $this->confirmationOrderProps($order),
        ]);
    }

    private function confirmationOrderProps(MerchOrder $order): array
    {
        return [
            'uuid' => $order->uuid,
            'status' => $order->status,
            'status_label' => $order->statusLabel(),
            'customer_name' => $order->customer_name,
            'customer_email' => $order->customer_email,
            'address_line1' => $order->address_line1,
            'address_city' => $order->address_city,
            'address_region' => $order->address_region,
            'address_country' => $order->address_country,
            'subtotal_amount' => $order->subtotal_amount,
            'shipping_cost' => $order->shipping_cost,
            'tax_amount' => $order->tax_amount,
            'tax_rate' => (float) $order->tax_rate,
            'total_amount' => $order->total_amount,
            'created_at' => $order->created_at,
            'items' => $order->items->map(fn ($i) => [
                'product_title' => $i->product_title,
                'variant_title' => $i->variant_title,
                'quantity' => $i->quantity,
                'unit_price' => $i->unit_price,
            ]),
        ];
    }
}
