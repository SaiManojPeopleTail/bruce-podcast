<?php

namespace App\Jobs;

use App\Models\MerchOrder;
use App\Services\MerchCheckoutFulfillmentService;
use App\Services\PrintifyService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class ProcessMerchOrdersJob implements ShouldQueue
{
    use Queueable;

    /**
     * Watches paid merch orders: push to Printify when needed, then sync shipment status from Printify.
     */
    public function handle(): void
    {
        $this->pushPaidOrFailedOrdersToPrintify();
        $this->syncPrintifyShipmentStatus();
    }

    /**
     * Orders that are paid (or failed before a Printify id was stored) and still need a Printify submission.
     */
    private function pushPaidOrFailedOrdersToPrintify(): void
    {
        MerchOrder::query()
            ->whereIn('status', ['paid', 'failed'])
            ->whereNull('printify_order_id')
            ->whereHas('items')
            ->orderBy('id')
            ->chunkById(50, function ($orders): void {
                foreach ($orders as $order) {
                    try {
                        app(MerchCheckoutFulfillmentService::class)->pushOrderToPrintify($order);
                    } catch (\Throwable $e) {
                        Log::error("ProcessMerchOrdersJob: Printify push failed for {$order->uuid}: ".$e->getMessage());
                    }
                }
            });
    }

    private function syncPrintifyShipmentStatus(): void
    {
        $orders = MerchOrder::whereIn('status', ['submitted', 'in_production', 'shipped'])
            ->whereNotNull('printify_order_id')
            ->get();

        if ($orders->isEmpty()) {
            return;
        }

        $printify = app(PrintifyService::class);

        foreach ($orders as $order) {
            try {
                $pOrder = $printify->getOrder($order->printify_order_id);
                $pStatus = $pOrder['status'] ?? null;

                $status = match ($pStatus) {
                    'in-production' => 'in_production',
                    'sent-to-production' => 'submitted',
                    'fulfilled' => 'fulfilled',
                    'shipped' => 'shipped',
                    'cancelled' => 'cancelled',
                    default => $order->status,
                };

                $tracking = null;
                $shipments = $pOrder['shipments'] ?? [];
                if (! empty($shipments)) {
                    $s = $shipments[0];
                    $tracking = [
                        'carrier' => $s['carrier'] ?? null,
                        'number' => $s['number'] ?? null,
                        'url' => $s['url'] ?? null,
                        'delivered_at' => $s['delivered_at'] ?? null,
                        'shipped_at' => $s['shipped_at'] ?? null,
                    ];
                }

                $order->update([
                    'status' => $status,
                    'tracking_info' => $tracking,
                    'tracking_last_polled_at' => now(),
                ]);
            } catch (\Throwable $e) {
                Log::error("ProcessMerchOrdersJob: tracking sync failed for order {$order->uuid}: ".$e->getMessage());
            }
        }
    }
}
