<?php

namespace App\Http\Controllers;

use App\Models\MerchProduct;
use App\Services\CurrencyService;
use App\Services\PrintifyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Inertia\Inertia;

class MerchProductController extends Controller
{
    /**
     * Show the live Printify catalog with on/off toggles.
     */
    public function index(Request $request)
    {
        $page = max(1, (int) $request->query('page', 1));
        $limit = 20;
        $printify = app(PrintifyService::class);

        $catalog = $printify->listProducts($page, $limit);
        $pProducts = $catalog['data'] ?? $catalog;

        // Expose the resolved shop ID so the admin can save it to .env
        $resolvedShopId = $printify->resolvedShopId();

        // Build a lookup of which printify_product_ids are already in our DB
        $allIds = collect($pProducts)->pluck('id')->map(fn ($id) => (string) $id)->toArray();
        $activeMap = MerchProduct::whereIn('printify_product_id', $allIds)
            ->get(['printify_product_id', 'id', 'slug', 'is_visible', 'variants'])
            ->keyBy('printify_product_id');

        $currency = app(CurrencyService::class);

        $products = collect($pProducts)->map(function ($p) use ($activeMap) {
            $pid = (string) ($p['id'] ?? '');
            $active = $activeMap->get($pid);
            $firstImg = $p['images'][0]['src'] ?? ($p['images'][0] ?? null);

            // Price info — only available for synced products
            $startingPriceCad = null;
            $startingPriceUsd = null;
            if ($active) {
                $variants = $active->variants ?? [];
                $available = array_filter($variants, fn ($v) => ($v['is_available'] ?? true));
                if (! empty($available)) {
                    $minCad = min(array_map(fn ($v) => (int) ($v['our_price'] ?? 0), $available));
                    $minCostUsd = min(array_map(fn ($v) => (int) ($v['printify_cost'] ?? 0), $available));
                    $startingPriceCad = $minCad;
                    $startingPriceUsd = $minCostUsd; // raw Printify USD cost for reference
                }
            }

            return [
                'printify_product_id' => $pid,
                'title' => $p['title'] ?? '',
                'image' => $firstImg,
                'variant_count' => count($p['variants'] ?? []),
                'is_synced' => (bool) $active,
                'local_id' => $active?->id,
                'local_slug' => $active?->slug,
                'is_visible' => $active?->is_visible ?? false,
                'starting_price_cad' => $startingPriceCad,
                'starting_price_usd' => $startingPriceUsd,
            ];
        })->values();

        $usdToCad = app(CurrencyService::class)->usdToCad();

        return Inertia::render('MerchProducts/Index', [
            'products' => $products,
            'pagination' => [
                'current_page' => $catalog['current_page'] ?? $page,
                'last_page' => $catalog['last_page'] ?? 1,
                'total' => $catalog['total'] ?? count($pProducts),
            ],
            'defaultMarkup' => (int) env('MERCH_DEFAULT_MARKUP', 30),
            'shopIdMissing' => ! config('services.printify.shop_id'),
            'resolvedShopId' => $resolvedShopId,
            'usdToCad' => $usdToCad,
        ]);
    }

    /**
     * Fetch a Printify product preview (variant costs) without storing it.
     */
    public function preview(Request $request)
    {
        $data = $request->validate(['printify_product_id' => ['required', 'string']]);
        $printify = app(PrintifyService::class);
        $p = $printify->getProduct($data['printify_product_id']);

        $currency = app(CurrencyService::class);
        $usdToCad = $currency->usdToCad();

        return response()->json([
            'title' => $p['title'] ?? '',
            'description' => strip_tags($p['description'] ?? ''),
            'images' => array_slice($p['images'] ?? [], 0, 3),
            'usdToCad' => $usdToCad,
            'variants' => collect($p['variants'] ?? [])->map(fn ($v) => [
                'variant_id' => (string) ($v['id'] ?? ''),
                'title' => $v['title'] ?? '',
                'printify_cost' => (int) ($v['cost'] ?? 0),
                'printify_cost_cad' => $currency->usdCentsToCadCents((int) ($v['cost'] ?? 0)),
                'is_available' => $v['is_enabled'] ?? true,
            ])->values(),
        ]);
    }

    /**
     * Toggle a Printify product on (sync to DB) or off (remove from DB).
     */
    public function toggle(Request $request)
    {
        $data = $request->validate([
            'printify_product_id' => ['required', 'string'],
            'enable' => ['required', 'boolean'],
            'variants' => ['nullable', 'array'],
            'variants.*.variant_id' => ['required', 'string'],
            'variants.*.our_price' => ['required', 'integer', 'min:0'],
            'variants.*.sale_price' => ['nullable', 'integer', 'min:0'],
            'variants.*.is_available' => ['boolean'],
        ]);

        $pid = $data['printify_product_id'];
        $enable = (bool) $data['enable'];

        if (! $enable) {
            $existing = MerchProduct::where('printify_product_id', $pid)->first();
            if ($existing) {
                $this->bustCache($existing);
                $existing->delete();
            }

            return response()->json(['status' => 'removed']);
        }

        // Already synced? Nothing to do
        if (MerchProduct::where('printify_product_id', $pid)->exists()) {
            return response()->json(['status' => 'already_synced']);
        }

        // Fetch full product from Printify and store
        $printify = app(PrintifyService::class);
        $p = $printify->getProduct($pid);
        $adminVariants = collect($data['variants'] ?? [])->keyBy('variant_id');

        $variants = collect($p['variants'] ?? [])->map(function ($v) use ($adminVariants) {
            $vid = (string) ($v['id'] ?? '');
            $admin = $adminVariants->get($vid);
            $cost = (int) ($v['cost'] ?? 0);

            return [
                'variant_id' => $vid,
                'title' => $v['title'] ?? '',
                'our_price' => $admin ? (int) $admin['our_price'] : (int) ceil($cost * 1.3),
                'sale_price' => ($admin && isset($admin['sale_price'])) ? (int) $admin['sale_price'] : null,
                'printify_cost' => $cost,
                'options' => $v['options'] ?? [],
                'is_available' => $admin['is_available'] ?? ($v['is_enabled'] ?? true),
            ];
        })->values()->toArray();

        $baseSlug = Str::slug($p['title'] ?? $pid);
        $slug = $baseSlug;
        $i = 1;
        while (MerchProduct::where('slug', $slug)->exists()) {
            $slug = $baseSlug.'-'.$i++;
        }

        $product = MerchProduct::create([
            'printify_product_id' => $pid,
            'slug' => $slug,
            'title' => $p['title'] ?? '',
            'description' => $p['description'] ?? null,
            'images' => $p['images'] ?? [],
            'variants' => $variants,
            'blueprint_id' => $p['blueprint_id'] ?? null,
            'print_provider_id' => $p['print_provider_id'] ?? null,
            'is_visible' => false, // hidden until admin makes it visible in Edit
        ]);

        Cache::forget('merch.index');
        Cache::forget('merch.featured');
        Cache::forget('merch.featured.v2');

        return response()->json([
            'status' => 'synced',
            'local_id' => $product->id,
            'local_slug' => $product->slug,
        ]);
    }

    public function toggleVisibility(MerchProduct $merchProduct)
    {
        $merchProduct->update(['is_visible' => ! $merchProduct->is_visible]);
        $this->bustCache($merchProduct);

        return response()->json(['is_visible' => $merchProduct->is_visible]);
    }

    public function edit(MerchProduct $merchProduct)
    {
        $currency = app(CurrencyService::class);
        $usdToCad = $currency->usdToCad();

        // Annotate each variant with its Printify cost in CAD for display
        $product = $merchProduct->toArray();
        $product['variants'] = collect($merchProduct->variants ?? [])->map(function ($v) use ($currency) {
            $v['printify_cost_cad'] = $currency->usdCentsToCadCents((int) ($v['printify_cost'] ?? 0));

            return $v;
        })->values()->toArray();

        return Inertia::render('MerchProducts/Edit', [
            'product' => $product,
            'usdToCad' => $usdToCad,
        ]);
    }

    public function update(Request $request, MerchProduct $merchProduct)
    {
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:150', 'unique:merch_products,slug,'.$merchProduct->id, 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string'],
            'is_visible' => ['boolean'],
            'variants' => ['required', 'array'],
            'variants.*.variant_id' => ['required', 'string'],
            'variants.*.our_price' => ['required', 'integer', 'min:0'],
            'variants.*.sale_price' => ['nullable', 'integer', 'min:0'],
            'variants.*.is_available' => ['boolean'],
        ]);

        $adminPrices = collect($data['variants'])->keyBy('variant_id');
        $variants = collect($merchProduct->variants ?? [])->map(function ($v) use ($adminPrices) {
            $variantId = (string) ($v['variant_id'] ?? '');
            $admin = $adminPrices->get($variantId);
            if ($admin) {
                $v['our_price'] = (int) $admin['our_price'];
                $v['sale_price'] = isset($admin['sale_price']) && $admin['sale_price'] > 0
                    ? (int) $admin['sale_price'] : null;
                $v['is_available'] = $admin['is_available'] ?? ($v['is_available'] ?? true);
            }

            return $v;
        })->values()->toArray();

        $oldSlug = $merchProduct->slug;

        $merchProduct->update([
            'slug' => $data['slug'],
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'is_visible' => (bool) ($data['is_visible'] ?? false),
            'variants' => $variants,
        ]);

        $this->bustCache($merchProduct, $oldSlug);

        return redirect()->route('merch-products.index')
            ->with('success', 'Product updated.');
    }

    public function destroy(MerchProduct $merchProduct)
    {
        $this->bustCache($merchProduct);
        $merchProduct->delete();

        return redirect()->route('merch-products.index')
            ->with('success', 'Product removed from store.');
    }

    public function refresh(MerchProduct $merchProduct)
    {
        $printify = app(PrintifyService::class);
        $pProduct = $printify->getProduct($merchProduct->printify_product_id);
        $existingPrices = collect($merchProduct->variants ?? [])->keyBy('variant_id');

        $variants = collect($pProduct['variants'] ?? [])->map(function ($v) use ($existingPrices) {
            $variantId = (string) ($v['id'] ?? '');
            $existing = $existingPrices->get($variantId);

            return [
                'variant_id' => $variantId,
                'title' => $v['title'] ?? '',
                'our_price' => (int) ($existing['our_price'] ?? 0),
                'printify_cost' => (int) ($v['cost'] ?? 0),
                'options' => $v['options'] ?? [],
                'is_available' => $existing['is_available'] ?? ($v['is_enabled'] ?? true),
            ];
        })->values()->toArray();

        $merchProduct->update([
            'images' => $pProduct['images'] ?? [],
            'variants' => $variants,
        ]);

        $this->bustCache($merchProduct);

        return back()->with('success', 'Refreshed from Printify.');
    }

    private function bustCache(MerchProduct $product, ?string $oldSlug = null): void
    {
        Cache::forget('merch.index');
        Cache::forget('merch.featured');
        Cache::forget('merch.featured.v2');
        Cache::forget("merch.show.{$product->slug}");
        if ($oldSlug && $oldSlug !== $product->slug) {
            Cache::forget("merch.show.{$oldSlug}");
        }
    }
}
