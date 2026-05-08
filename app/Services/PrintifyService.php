<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class PrintifyService
{
    protected string $token;

    protected string $resolvedShopId = '';

    protected string $baseUrl;

    public function __construct()
    {
        $this->token = config('services.printify.token', '');
        $this->resolvedShopId = config('services.printify.shop_id', '');
        $this->baseUrl = rtrim(config('services.printify.base_url', 'https://api.printify.com/v1'), '/');
    }

    protected function http()
    {
        return Http::withToken($this->token)
            ->acceptJson()
            ->timeout(30);
    }

    /**
     * Return the shop ID, auto-detecting from the API if not configured.
     */
    protected function shopId(): string
    {
        if ($this->resolvedShopId) {
            return $this->resolvedShopId;
        }

        // Auto-detect: fetch all shops and use the first one
        $res = $this->http()->get("{$this->baseUrl}/shops.json");
        $this->assertOk($res, 'listShops');
        $shops = $res->json();
        if (empty($shops)) {
            throw new RuntimeException('No Printify shops found for this API token.');
        }
        $this->resolvedShopId = (string) ($shops[0]['id'] ?? '');

        return $this->resolvedShopId;
    }

    protected function shopUrl(string $path): string
    {
        return "{$this->baseUrl}/shops/{$this->shopId()}/{$path}";
    }

    /**
     * Return the resolved shop ID (after auto-detection if needed).
     */
    public function resolvedShopId(): string
    {
        return $this->shopId();
    }

    /**
     * List all shops connected to this token (no shop ID required).
     */
    public function listShops(): array
    {
        $res = $this->http()->get("{$this->baseUrl}/shops.json");
        $this->assertOk($res, 'listShops');

        return $res->json();
    }

    public function getShop(): array
    {
        $res = $this->http()->get("{$this->baseUrl}/shops/{$this->shopId()}.json");
        $this->assertOk($res, 'getShop');
        $data = $res->json();
        // Persist the detected shop ID to env cache for display
        if (! config('services.printify.shop_id')) {
            $data['_auto_detected'] = true;
        }

        return $data;
    }

    /**
     * List all products in the shop (paginated).
     */
    public function listProducts(int $page = 1, int $limit = 20): array
    {
        $res = $this->http()->get($this->shopUrl('products.json'), [
            'page' => $page,
            'limit' => $limit,
        ]);
        $this->assertOk($res, 'listProducts');

        return $res->json();
    }

    public function getProduct(string $productId): array
    {
        $res = $this->http()->get($this->shopUrl("products/{$productId}.json"));
        $this->assertOk($res, 'getProduct');

        return $res->json();
    }

    /**
     * @param  array  $lineItems  [['product_id'=>…,'variant_id'=>…,'quantity'=>1], …]
     * @param  array  $addressTo  Printify address_to object
     */
    public function calculateShipping(array $lineItems, array $addressTo): array
    {
        $res = $this->http()->post($this->shopUrl('orders/shipping.json'), [
            'line_items' => $lineItems,
            'address_to' => $addressTo,
        ]);
        $this->assertOk($res, 'calculateShipping');

        return $res->json();
    }

    /**
     * Create a draft order. Returns the Printify order ID.
     */
    public function createOrder(array $data): string
    {
        $res = $this->http()->post($this->shopUrl('orders.json'), $data);
        $this->assertOk($res, 'createOrder');

        return $res->json('id');
    }

    /**
     * Send a draft order into production.
     */
    public function sendToProduction(string $printifyOrderId): void
    {
        $res = $this->http()->post($this->shopUrl("orders/{$printifyOrderId}/send_to_production.json"));
        $this->assertOk($res, 'sendToProduction');
    }

    /**
     * Retrieve a single order (for tracking polling).
     */
    public function getOrder(string $printifyOrderId): array
    {
        $res = $this->http()->get($this->shopUrl("orders/{$printifyOrderId}.json"));
        $this->assertOk($res, 'getOrder');

        return $res->json();
    }

    protected function assertOk(\Illuminate\Http\Client\Response $res, string $method): void
    {
        if (! $res->successful()) {
            throw new RuntimeException(
                "Printify API error in {$method}: HTTP {$res->status()} — ".$res->body()
            );
        }
    }
}
