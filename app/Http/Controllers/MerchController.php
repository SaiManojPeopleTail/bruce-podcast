<?php

namespace App\Http\Controllers;

use App\Models\MerchOrder;
use App\Models\MerchProduct;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class MerchController extends Controller
{
    public static function clearCache(?string $slug = null): void
    {
        Cache::forget('merch.index');
        Cache::forget('merch.featured');
        if ($slug) {
            Cache::forget("merch.show.{$slug}");
        } else {
            // Bust all individual product caches
            Cache::flush(); // scoped if using tags; full flush as safe fallback
        }
    }

    public function index()
    {
        $products = Cache::remember('merch.index', now()->addMinutes(30), function () {
            return MerchProduct::where('is_visible', true)
                ->orderBy('title')
                ->get()
                ->map(fn ($p) => [
                    'id' => $p->id,
                    'slug' => $p->slug,
                    'title' => $p->title,
                    'images' => $p->images,
                    'printify_product_id' => $p->printify_product_id,
                    'variants' => $p->variants ?? [],
                    'starting_price' => $p->startingPrice(),
                    'has_sale' => $p->hasSale(),
                ]);
        });

        return Inertia::render('Merch/Index', compact('products'));
    }

    public function show(string $slug)
    {
        $data = Cache::remember("merch.show.{$slug}", now()->addMinutes(30), function () use ($slug) {
            $product = MerchProduct::where('slug', $slug)
                ->where('is_visible', true)
                ->firstOrFail();

            return [
                'id' => $product->id,
                'slug' => $product->slug,
                'title' => $product->title,
                'description' => $product->description,
                'images' => $product->images ?? [],
                'variants' => $product->variants ?? [],
                'printify_product_id' => $product->printify_product_id,
            ];
        });

        return Inertia::render('Merch/Show', [
            'product' => $data,
            'stripeKey' => config('services.stripe.key'),
        ]);
    }

    public function trackForm()
    {
        return Inertia::render('Merch/Track');
    }

    public function trackLookup(Request $request)
    {
        $data = $request->validate([
            'uuid' => ['required', 'string', 'uuid'],
            'email' => ['required', 'email'],
        ]);

        $order = MerchOrder::where('uuid', $data['uuid'])
            ->where('customer_email', $data['email'])
            ->with('items')
            ->first();

        if (! $order) {
            return back()->withErrors(['uuid' => 'No order found with those details.']);
        }

        return Inertia::render('Merch/Track', ['order' => $this->formatOrder($order)]);
    }

    protected function formatOrder(MerchOrder $order): array
    {
        return [
            'uuid' => $order->uuid,
            'status' => $order->status,
            'status_label' => $order->statusLabel(),
            'status_color' => $order->statusColor(),
            'customer_name' => $order->customer_name,
            'customer_email' => $order->customer_email,
            'subtotal_amount' => $order->subtotal_amount,
            'shipping_cost' => $order->shipping_cost,
            'tax_amount' => $order->tax_amount,
            'tax_rate' => (float) $order->tax_rate,
            'total_amount' => $order->total_amount,
            'tracking_info' => $order->tracking_info,
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
