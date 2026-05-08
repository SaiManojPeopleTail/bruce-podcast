<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CurrencyService
{
    /**
     * Live USD → CAD exchange rate, cached for 6 hours.
     * Falls back to a sensible hard-coded rate if the API is unreachable.
     */
    public function usdToCad(): float
    {
        return Cache::remember('currency.usd_cad', now()->addHours(6), function () {
            try {
                $response = Http::timeout(5)->get('https://api.frankfurter.app/latest', [
                    'from' => 'USD',
                    'to' => 'CAD',
                ]);

                if ($response->successful()) {
                    return (float) $response->json('rates.CAD', 1.37);
                }
            } catch (\Throwable $e) {
                Log::warning('CurrencyService: could not fetch USD→CAD rate: '.$e->getMessage());
            }

            return 1.37; // fallback
        });
    }

    /** Convert USD cents to CAD cents. */
    public function usdCentsToCadCents(int $usdCents): int
    {
        return (int) round($usdCents * $this->usdToCad());
    }
}
