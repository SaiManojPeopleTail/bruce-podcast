<?php

namespace App\Services;

use App\Mail\MerchNewOrderAdminMail;
use App\Mail\MerchOrderConfirmationMail;
use App\Models\MerchOrder;
use App\Models\MerchOrderItem;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Throwable;

class MerchCheckoutFulfillmentService
{
    /**
     * Called when Stripe reports a succeeded PaymentIntent (webhook or poll).
     * Prefers an existing pending_payment row created at checkout initiate.
     */
    public function fulfillFromPaymentIntentPayload(array $pi): ?MerchOrder
    {
        if (($pi['status'] ?? '') !== 'succeeded') {
            return null;
        }

        $piId = $pi['id'] ?? '';
        if ($piId === '' || ! str_starts_with($piId, 'pi_')) {
            return null;
        }

        $meta = (array) ($pi['metadata'] ?? []);

        try {
            [$order, $justPaid] = DB::transaction(function () use ($pi, $piId, $meta): array {
                $order = MerchOrder::where('stripe_payment_intent_id', $piId)->lockForUpdate()->first();

                if ($order && $order->status === 'pending_payment') {
                    if ((int) ($pi['amount'] ?? 0) !== (int) $order->total_amount) {
                        Log::critical("MerchCheckoutFulfillmentService: PI amount mismatch for order {$order->uuid} PI {$piId}");

                        throw new \RuntimeException('Payment amount mismatch');
                    }
                    $order->update(['status' => 'paid']);

                    return [$order->fresh(['items']), true];
                }

                if ($order) {
                    return [$order->fresh(['items']), false];
                }

                $uuid = $meta['merch_order_uuid'] ?? null;
                if (is_string($uuid) && $uuid !== '') {
                    $byUuid = MerchOrder::where('uuid', $uuid)->lockForUpdate()->first();
                    if ($byUuid && $byUuid->status === 'pending_payment') {
                        if ((int) ($pi['amount'] ?? 0) !== (int) $byUuid->total_amount) {
                            Log::critical("MerchCheckoutFulfillmentService: PI amount mismatch for order {$byUuid->uuid} PI {$piId}");

                            throw new \RuntimeException('Payment amount mismatch');
                        }
                        $byUuid->update([
                            'stripe_payment_intent_id' => $piId,
                            'status' => 'paid',
                        ]);

                        return [$byUuid->fresh(['items']), true];
                    }
                }

                if (MerchOrder::where('stripe_payment_intent_id', $piId)->exists()) {
                    $existing = MerchOrder::where('stripe_payment_intent_id', $piId)->first();

                    return [$existing->fresh(['items']), false];
                }

                $legacy = $this->createLegacyOrderWithoutExistingPi($pi, $piId, $meta);

                return [$legacy, true];
            });

            if ($justPaid) {
                $this->sendOrderPaidNotifications($order);
                $this->pushOrderToPrintify($order);
            }

            return $order->fresh(['items']);
        } catch (Throwable $e) {
            if (MerchOrder::where('stripe_payment_intent_id', $piId)->exists()) {
                return MerchOrder::where('stripe_payment_intent_id', $piId)->with('items')->first();
            }
            Log::error("MerchCheckoutFulfillmentService failed for {$piId}: ".$e->getMessage());

            throw $e;
        }
    }

    /**
     * Retry Printify for paid (or failed pre-Printify) orders with no Printify id. Used by the scheduled watcher job.
     */
    public function pushOrderToPrintify(MerchOrder $order): void
    {
        $order->load('items');

        if ($order->printify_order_id || $order->items->isEmpty()) {
            return;
        }

        if (! in_array($order->status, ['paid', 'failed'], true)) {
            return;
        }

        $cart = $order->items->map(fn ($i) => [
            'printify_product_id' => $i->printify_product_id,
            'printify_variant_id' => $i->printify_variant_id,
            'quantity' => $i->quantity,
        ])->all();

        $meta = ['shipping_method' => $order->shipping_method ?? 1];
        $this->submitToPrintify($order, $cart, $meta);
    }

    /**
     * @param  array<int, array<string, mixed>>  $cart
     */
    private function createLegacyOrderWithoutExistingPi(array $pi, string $piId, array $meta): MerchOrder
    {
        $cart = json_decode($meta['cart_json'] ?? '[]', true) ?: [];
        $address = json_decode($meta['address_json'] ?? '{}', true) ?: [];
        $nameParts = explode(' ', $address['full_name'] ?? '', 2);

        $order = MerchOrder::create([
            'uuid' => Str::uuid(),
            'stripe_payment_intent_id' => $piId,
            'status' => 'paid',
            'customer_name' => $address['full_name'] ?? '',
            'customer_email' => $address['email'] ?? '',
            'customer_phone' => $address['phone'] ?? null,
            'address_first_name' => $nameParts[0] ?? '',
            'address_last_name' => $nameParts[1] ?? '',
            'address_line1' => $address['address1'] ?? '',
            'address_line2' => $address['address2'] ?? null,
            'address_city' => $address['city'] ?? '',
            'address_region' => $address['region'] ?? '',
            'address_zip' => $address['zip'] ?? '',
            'address_country' => $address['country'] ?? 'CA',
            'subtotal_amount' => (int) ($meta['subtotal'] ?? 0),
            'shipping_cost' => (int) ($meta['shipping_cost'] ?? 0),
            'tax_rate' => (float) ($meta['tax_rate'] ?? 0),
            'tax_amount' => (int) ($meta['tax_amount'] ?? 0),
            'total_amount' => (int) ($pi['amount'] ?? 0),
            'shipping_method' => (int) ($meta['shipping_method'] ?? 0),
        ]);

        foreach ($cart as $item) {
            MerchOrderItem::create([
                'merch_order_id' => $order->id,
                'printify_product_id' => $item['printify_product_id'],
                'printify_variant_id' => $item['printify_variant_id'],
                'product_title' => $item['product_title'] ?? '',
                'variant_title' => $item['variant_title'] ?? null,
                'quantity' => (int) ($item['quantity'] ?? 1),
                'unit_price' => (int) ($item['unit_price'] ?? 0),
            ]);
        }

        return $order->fresh(['items']);
    }

    private function sendOrderPaidNotifications(MerchOrder $order): void
    {
        $order = $order->load('items');

        $customerEmail = trim((string) $order->customer_email);
        if ($customerEmail !== '' && filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            try {
                $name = trim((string) $order->customer_name);
                Mail::to(new Address($customerEmail, $name !== '' ? $name : 'Customer'))
                    ->send(new MerchOrderConfirmationMail($order));
            } catch (Throwable $e) {
                Log::warning("Failed to send customer order confirmation for {$order->uuid}: ".$e->getMessage());
            }
        } else {
            Log::warning("Order {$order->uuid}: missing or invalid customer_email; skipping customer confirmation.");
        }

        $adminOrderUrl = URL::route('merch-orders.show', $order, true);

        foreach (config('services.merch.orders_notify_emails', []) as $raw) {
            $adminEmail = trim((string) $raw);
            if ($adminEmail === '' || ! filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
                continue;
            }
            try {
                Mail::to($adminEmail)->send(new MerchNewOrderAdminMail($order, $adminOrderUrl));
            } catch (Throwable $e) {
                Log::warning("Failed to send admin new-order email to {$adminEmail} for {$order->uuid}: ".$e->getMessage());
            }
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $cart
     * @param  array<string, mixed>  $meta
     */
    private function submitToPrintify(MerchOrder $order, array $cart, array $meta): void
    {
        try {
            $printify = app(PrintifyService::class);

            $lineItems = array_map(fn ($item) => [
                'product_id' => $item['printify_product_id'],
                'variant_id' => (int) $item['printify_variant_id'],
                'quantity' => (int) ($item['quantity'] ?? 1),
            ], $cart);

            $printifyOrderId = $printify->createOrder([
                'external_id' => $order->uuid,
                'label' => 'Order #'.$order->id,
                'line_items' => $lineItems,
                'shipping_method' => (int) ($meta['shipping_method'] ?? 1),
                'send_shipping_notification' => true,
                'address_to' => [
                    'first_name' => $order->address_first_name,
                    'last_name' => $order->address_last_name,
                    'email' => $order->customer_email,
                    'phone' => $order->customer_phone ?? '',
                    'country' => $order->address_country,
                    'region' => $order->address_region,
                    'address1' => $order->address_line1,
                    'address2' => $order->address_line2 ?? '',
                    'city' => $order->address_city,
                    'zip' => $order->address_zip,
                ],
            ]);

            $printify->sendToProduction($printifyOrderId);

            $order->update([
                'printify_order_id' => $printifyOrderId,
                'status' => 'submitted',
            ]);
        } catch (Throwable $e) {
            Log::error("Failed to submit Printify order for {$order->uuid}: ".$e->getMessage());
            $order->update(['status' => 'failed']);
        }
    }

    /**
     * @throws \InvalidArgumentException
     */
    public function resendCustomerOrderConfirmation(MerchOrder $order): void
    {
        $order->load('items');
        $customerEmail = trim((string) $order->customer_email);
        if ($customerEmail === '' || ! filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException('Customer email is missing or invalid.');
        }
        $name = trim((string) $order->customer_name);
        Mail::to(new Address($customerEmail, $name !== '' ? $name : 'Customer'))
            ->send(new MerchOrderConfirmationMail($order));
    }

    /**
     * Resends {@see MerchNewOrderAdminMail} to all emails in `services.merch.orders_notify_emails`.
     *
     * @throws \InvalidArgumentException
     */
    public function resendAdminNewOrderNotifications(MerchOrder $order): void
    {
        $order->load('items');
        $valid = [];
        foreach (config('services.merch.orders_notify_emails', []) as $raw) {
            $e = trim((string) $raw);
            if ($e !== '' && filter_var($e, FILTER_VALIDATE_EMAIL)) {
                $valid[] = $e;
            }
        }
        if ($valid === []) {
            throw new \InvalidArgumentException(
                'No admin notification addresses configured. Set MERCH_ORDERS_NOTIFY_EMAILS in your environment.'
            );
        }
        $adminOrderUrl = URL::route('merch-orders.show', $order, true);
        foreach ($valid as $adminEmail) {
            Mail::to($adminEmail)->send(new MerchNewOrderAdminMail($order, $adminOrderUrl));
        }
    }
}
