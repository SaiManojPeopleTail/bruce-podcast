<?php

namespace App\Http\Controllers;

use App\Models\MerchOrder;
use App\Services\MerchCheckoutFulfillmentService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MerchOrderController extends Controller
{
    public function index(Request $request)
    {
        $query = MerchOrder::with('items')->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('customer_name', 'like', "%{$s}%")
                    ->orWhere('customer_email', 'like', "%{$s}%")
                    ->orWhere('uuid', 'like', "%{$s}%");
            });
        }

        $orders = $query->paginate(20)->withQueryString();

        return Inertia::render('MerchOrders/Index', [
            'orders' => $orders,
            'filters' => $request->only('status', 'search'),
        ]);
    }

    public function show(MerchOrder $merchOrder)
    {
        $merchOrder->load('items');

        return Inertia::render('MerchOrders/Show', [
            'order' => array_merge($merchOrder->toArray(), [
                'status_label' => $merchOrder->statusLabel(),
                'status_color' => $merchOrder->statusColor(),
            ]),
        ]);
    }

    public function resendEmail(Request $request, MerchOrder $merchOrder)
    {
        $request->validate([
            'target' => ['required', 'string', 'in:customer,admin'],
        ]);

        try {
            $service = app(MerchCheckoutFulfillmentService::class);
            if ($request->input('target') === 'customer') {
                $service->resendCustomerOrderConfirmation($merchOrder);

                return back()->with('success', 'Customer confirmation email sent.');
            }
            $service->resendAdminNewOrderNotifications($merchOrder);

            return back()->with('success', 'Admin notification sent to all configured addresses.');
        } catch (\InvalidArgumentException $e) {
            return back()->with('error', $e->getMessage());
        } catch (\Throwable $e) {
            report($e);

            return back()->with('error', 'Could not send email. Check the mail configuration and try again.');
        }
    }
}
