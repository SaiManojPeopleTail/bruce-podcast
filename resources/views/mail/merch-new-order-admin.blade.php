<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>New merch order — {{ config('app.name') }}</title>
</head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f4f4f5;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
                    <tr>
                        <td style="padding:24px 28px;background:#b59100;color:#fff;">
                            <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;">Admin</p>
                            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;">New paid merch order</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 28px;">
                            <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
                                Order <strong>#{{ $order->id }}</strong> · Reference <span class="font-mono" style="font-family:ui-monospace,monospace;">{{ $order->uuid }}</span>
                            </p>
                            <p style="margin:0 0 20px;">
                                <a href="{{ $adminOrderUrl }}" style="display:inline-block;padding:12px 20px;background:#b59100;color:#fff;text-decoration:none;font-weight:600;border-radius:8px;font-size:14px;">
                                    Open order in admin
                                </a>
                            </p>
                            <p style="margin:0 0 8px;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Direct link</p>
                            <p style="margin:0 0 20px;font-size:12px;word-break:break-all;color:#3f3f46;">
                                <a href="{{ $adminOrderUrl }}" style="color:#b59100;">{{ $adminOrderUrl }}</a>
                            </p>

                            <h2 style="margin:24px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">Customer</h2>
                            <p style="margin:0;font-size:14px;line-height:1.6;">
                                {{ $order->customer_name }}<br>
                                <a href="mailto:{{ $order->customer_email }}" style="color:#b59100;">{{ $order->customer_email }}</a>
                                @if($order->customer_phone)
                                    <br>{{ $order->customer_phone }}
                                @endif
                            </p>

                            <h2 style="margin:24px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">Ship to</h2>
                            <p style="margin:0;font-size:14px;line-height:1.6;">
                                {{ $order->address_line1 }}@if($order->address_line2), {{ $order->address_line2 }}@endif<br>
                                {{ $order->address_city }}, {{ $order->address_region }} {{ $order->address_zip }}<br>
                                {{ $order->address_country }}
                            </p>

                            <h2 style="margin:24px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#71717a;">Items</h2>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;">
                                @foreach ($order->items as $i)
                                    <tr>
                                        <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;">
                                            <strong>{{ $i->product_title }}</strong>
                                            @if($i->variant_title)<br><span style="color:#71717a;font-size:13px;">{{ $i->variant_title }}</span>@endif
                                        </td>
                                        <td style="padding:8px 0;border-bottom:1px solid #f4f4f5;text-align:right;white-space:nowrap;color:#52525b;">
                                            ×{{ $i->quantity }} · {{ number_format(($i->unit_price * $i->quantity) / 100, 2) }} USD
                                        </td>
                                    </tr>
                                @endforeach
                            </table>

                            <p style="margin:20px 0 0;font-size:14px;line-height:1.6;">
                                <strong>Subtotal:</strong> {{ number_format($order->subtotal_amount / 100, 2) }} USD<br>
                                <strong>Shipping:</strong> {{ number_format($order->shipping_cost / 100, 2) }} USD<br>
                                <strong>Tax:</strong> {{ number_format($order->tax_amount / 100, 2) }} USD<br>
                                <strong style="color:#b59100;">Total:</strong> {{ number_format($order->total_amount / 100, 2) }} USD
                            </p>

                            @if($order->stripe_payment_intent_id)
                                <p style="margin:16px 0 0;font-size:12px;color:#71717a;">
                                    Stripe: <span style="font-family:ui-monospace,monospace;">{{ $order->stripe_payment_intent_id }}</span>
                                </p>
                            @endif
                            @if($order->printify_order_id)
                                <p style="margin:8px 0 0;font-size:12px;color:#71717a;">
                                    Printify: <span style="font-family:ui-monospace,monospace;">{{ $order->printify_order_id }}</span>
                                </p>
                            @endif
                            <p style="margin:8px 0 0;font-size:12px;color:#71717a;">
                                Status: {{ $order->statusLabel() }}
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
