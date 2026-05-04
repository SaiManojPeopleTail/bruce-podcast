<?php

namespace App\Http\Controllers;

use App\Models\ProductEnquiry;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductEnquirySubmissionController extends Controller
{
    /** Same search scope as {@see index()} for list, IDs, and bulk actions. */
    protected function applyEnquirySearch(Builder $query, Request $request): Builder
    {
        if (! $request->filled('search')) {
            return $query;
        }

        $term = $request->search;

        return $query->where(function ($q) use ($term) {
            $q->where('name', 'like', "%{$term}%")
                ->orWhere('store_name', 'like', "%{$term}%")
                ->orWhere('email', 'like', "%{$term}%")
                ->orWhere('phone', 'like', "%{$term}%")
                ->orWhereHas('productQrList', fn ($q2) => $q2->where('product_name', 'like', "%{$term}%"));
        });
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    protected function validatedExportRangeBounds(string $dateFrom, string $dateTo): array
    {
        $fromDate = Carbon::parse($dateFrom)->toDateString();
        $toDate = Carbon::parse($dateTo)->toDateString();
        $todayDate = now()->toDateString();

        if ($fromDate > $toDate) {
            throw ValidationException::withMessages([
                'date_from' => ['The from date must be on or before the to date.'],
            ]);
        }

        if ($toDate > $todayDate) {
            throw ValidationException::withMessages([
                'date_to' => ['The to date cannot be after today.'],
            ]);
        }

        if ($fromDate > $todayDate) {
            throw ValidationException::withMessages([
                'date_from' => ['The from date cannot be after today.'],
            ]);
        }

        return [
            Carbon::parse($dateFrom)->startOfDay(),
            Carbon::parse($dateTo)->endOfDay(),
        ];
    }

    public function index(Request $request)
    {
        $query = $this->applyEnquirySearch(
            ProductEnquiry::query()
                ->with(['productQrList:id,product_name'])
                ->orderByDesc('created_at'),
            $request,
        );

        $enquiries = $query->paginate(15)->withQueryString()->through(function (ProductEnquiry $e) {
            return [
                'id' => $e->id,
                'name' => $e->name,
                'store_name' => $e->store_name,
                'phone' => $e->phone,
                'email' => $e->email,
                'message' => $e->message,
                'created_at' => $e->created_at?->toIso8601String(),
                'product_name' => $e->productQrList?->product_name ?? '—',
            ];
        });

        return Inertia::render('ProductEnquiries/Index', [
            'enquiries' => $enquiries,
            'filters' => $request->only('search'),
            'enquiriesExportAllCount' => ProductEnquiry::query()->count(),
        ]);
    }

    /**
     * All enquiry IDs matching the current list filters (for “select all matching search”).
     */
    public function ids(Request $request): JsonResponse
    {
        $query = $this->applyEnquirySearch(
            ProductEnquiry::query()->orderByDesc('created_at'),
            $request,
        );

        $ids = $query->limit(25_000)->pluck('id')->values()->all();

        return response()->json(['ids' => $ids]);
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:5000'],
            'ids.*' => ['integer', 'exists:product_enquiries,id'],
        ]);

        foreach (array_chunk($validated['ids'], 500) as $chunk) {
            ProductEnquiry::query()->whereIn('id', $chunk)->delete();
        }

        $n = count($validated['ids']);

        return redirect()->back()
            ->with('success', $n === 1 ? '1 enquiry deleted.' : "{$n} enquiries deleted.");
    }

    public function exportRangeCount(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date'],
        ]);

        [$from, $to] = $this->validatedExportRangeBounds(
            $validated['date_from'],
            $validated['date_to'],
        );

        $count = ProductEnquiry::query()
            ->whereBetween('created_at', [$from, $to])
            ->count();

        return response()->json(['count' => $count]);
    }

    public function export(Request $request): StreamedResponse
    {
        if ($request->isMethod('post')) {
            $validated = $request->validate([
                'scope' => ['required', 'in:selected'],
                'ids' => ['required', 'array', 'min:1', 'max:5000'],
                'ids.*' => ['integer', 'exists:product_enquiries,id'],
            ]);

            $query = ProductEnquiry::query()
                ->with(['productQrList:id,product_name'])
                ->whereIn('id', $validated['ids'])
                ->orderBy('created_at');

            return $this->streamEnquiriesCsv($query);
        }

        $validated = $request->validate([
            'scope' => ['required', 'in:all,range'],
            'date_from' => ['required_if:scope,range', 'nullable', 'date'],
            'date_to' => ['required_if:scope,range', 'nullable', 'date'],
        ]);

        $from = null;
        $to = null;

        if ($validated['scope'] === 'range') {
            [$from, $to] = $this->validatedExportRangeBounds(
                $validated['date_from'],
                $validated['date_to'],
            );
        }

        $query = ProductEnquiry::query()
            ->with(['productQrList:id,product_name'])
            ->orderBy('created_at');

        if ($validated['scope'] === 'range') {
            $query->whereBetween('created_at', [$from, $to]);
        }

        return $this->streamEnquiriesCsv($query);
    }

    protected function streamEnquiriesCsv(Builder $query): StreamedResponse
    {
        $filename = 'product-enquiries-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, ['Submitted at', 'Product', 'Name', 'Store name', 'Email', 'Phone', 'Message']);

            foreach ($query->cursor() as $e) {
                fputcsv($handle, [
                    $e->created_at?->timezone(config('app.timezone'))->format('Y-m-d H:i:s') ?? '',
                    $e->productQrList?->product_name ?? '',
                    $e->name,
                    $e->store_name ?? '',
                    $e->email,
                    $e->phone,
                    $e->message,
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function destroy(ProductEnquiry $productEnquiry)
    {
        $productEnquiry->delete();

        return redirect()->route('product-enquiries.index')
            ->with('success', 'Enquiry deleted.');
    }
}
