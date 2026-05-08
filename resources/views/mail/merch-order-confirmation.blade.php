<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Order confirmed — {{ config('app.name') }}</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#e5e7eb;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#e5e7eb;">
        <tr>
            <td align="center" style="padding:28px 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;margin:0 auto;">

                    {{-- Top accent stripe --}}
                    <tr>
                        <td style="height:4px;background-color:#ffde59;border-radius:16px 16px 0 0;line-height:4px;font-size:0;">&nbsp;</td>
                    </tr>

                    {{-- Header --}}
                    <tr>
                        <td style="background-color:#b59100;padding:26px 28px 28px;text-align:center;border-left:1px solid #9a7c00;border-right:1px solid #9a7c00;">
                            <p style="margin:0 0 6px;font-family:'Barlow Condensed',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:#ffde59;">
                                Order confirmed
                            </p>
                            <h1 style="margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:30px;font-weight:700;line-height:1.15;color:#ffffff;">
                                Thank you, {{ $order->address_first_name }}!
                            </h1>
                            <p style="margin:12px 0 0;font-family:'Source Serif 4',Georgia,serif;font-size:14px;color:rgba(255,255,255,0.92);">
                                Your order has been received and is being prepared for production.
                            </p>
                        </td>
                    </tr>

                    {{-- Card body --}}
                    <tr>
                        <td style="background-color:#ffffff;border:1px solid #d1d5db;border-top:0;padding:0 0 8px;border-radius:0 0 16px 16px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">

                                {{-- Order reference --}}
                                <tr>
                                    <td style="padding:24px 28px 0;">
                                        <p style="margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">
                                            Order reference
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:8px 28px 0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                                            <tr>
                                                <td style="padding:12px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;width:38%;">
                                                    Order ID
                                                </td>
                                                <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e5e7eb;font-family:'Source Serif 4',Georgia,serif;font-size:14px;color:#111827;">
                                                    {{ strtoupper(substr($order->uuid, 0, 8)) }}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:12px 16px;background-color:#f9fafb;border-bottom:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">
                                                    Date
                                                </td>
                                                <td style="padding:12px 16px;background-color:#ffffff;font-family:'Source Serif 4',Georgia,serif;font-size:14px;color:#111827;">
                                                    {{ $order->created_at->format('F j, Y') }}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                {{-- Items --}}
                                <tr>
                                    <td style="padding:20px 28px 0;">
                                        <p style="margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">
                                            Items ordered
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:8px 28px 0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                                            @foreach ($order->items as $i)
                                            <tr>
                                                <td style="padding:12px 16px;background-color:#ffffff;{{ !$loop->last ? 'border-bottom:1px solid #e5e7eb;' : '' }}font-family:'Source Serif 4',Georgia,serif;font-size:14px;color:#111827;">
                                                    <strong>{{ $i->product_title }}</strong>
                                                    @if ($i->variant_title)
                                                        <br><span style="font-size:12px;color:#6b7280;">{{ $i->variant_title }}</span>
                                                    @endif
                                                </td>
                                                <td style="padding:12px 16px;background-color:#ffffff;{{ !$loop->last ? 'border-bottom:1px solid #e5e7eb;' : '' }}font-family:'Source Serif 4',Georgia,serif;font-size:14px;color:#6b7280;white-space:nowrap;text-align:right;">
                                                    × {{ $i->quantity }}
                                                </td>
                                                <td style="padding:12px 16px;background-color:#ffffff;{{ !$loop->last ? 'border-bottom:1px solid #e5e7eb;' : '' }}font-family:'Barlow Condensed',Arial,sans-serif;font-size:14px;font-weight:600;color:#111827;white-space:nowrap;text-align:right;">
                                                    {{ number_format(($i->unit_price * $i->quantity) / 100, 2) }} USD
                                                </td>
                                            </tr>
                                            @endforeach
                                        </table>
                                    </td>
                                </tr>

                                {{-- Pricing summary --}}
                                <tr>
                                    <td style="padding:20px 28px 0;">
                                        <p style="margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">
                                            Summary
                                        </p>
                                        <p style="margin:6px 0 0;font-family:'Source Serif 4',Georgia,serif;font-size:13px;color:#6b7280;">
                                            All amounts in USD (charged via Stripe).
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:8px 28px 0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                                            <tr>
                                                <td style="padding:10px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;width:50%;">Subtotal</td>
                                                <td style="padding:10px 16px;background-color:#ffffff;border-bottom:1px solid #e5e7eb;font-family:'Source Serif 4',Georgia,serif;font-size:14px;color:#111827;text-align:right;">{{ number_format($order->subtotal_amount / 100, 2) }} USD</td>
                                            </tr>
                                            <tr>
                                                <td style="padding:10px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">Shipping</td>
                                                <td style="padding:10px 16px;background-color:#ffffff;border-bottom:1px solid #e5e7eb;font-family:'Source Serif 4',Georgia,serif;font-size:14px;color:#111827;text-align:right;">{{ number_format($order->shipping_cost / 100, 2) }} USD</td>
                                            </tr>
                                            <tr>
                                                <td style="padding:10px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">Tax (HST {{ number_format($order->tax_rate * 100, 0) }}%)</td>
                                                <td style="padding:10px 16px;background-color:#ffffff;border-bottom:1px solid #e5e7eb;font-family:'Source Serif 4',Georgia,serif;font-size:14px;color:#111827;text-align:right;">{{ number_format($order->tax_amount / 100, 2) }} USD</td>
                                            </tr>
                                            <tr>
                                                <td style="padding:12px 16px;background-color:#fffbeb;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#b59100;">Total</td>
                                                <td style="padding:12px 16px;background-color:#fffbeb;font-family:'Barlow Condensed',Arial,sans-serif;font-size:16px;font-weight:700;color:#b59100;text-align:right;">{{ number_format($order->total_amount / 100, 2) }} USD</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                {{-- Shipping address --}}
                                <tr>
                                    <td style="padding:20px 28px 0;">
                                        <p style="margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">
                                            Shipping address
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:8px 28px 24px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                                            <tr>
                                                <td style="padding:16px 18px;background-color:#fafafa;font-family:'Source Serif 4',Georgia,serif;font-size:14px;line-height:1.65;color:#374151;">
                                                    {{ $order->address_first_name }} {{ $order->address_last_name }}<br>
                                                    {{ $order->address_line1 }}@if($order->address_line2), {{ $order->address_line2 }}@endif<br>
                                                    {{ $order->address_city }}, {{ $order->address_region }} {{ $order->address_zip }}<br>
                                                    {{ $order->address_country }}
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                {{-- Track order CTA --}}
                                <tr>
                                    <td style="padding:4px 28px 28px;text-align:center;">
                        <a href="{{ url(route('merch.track')) . '?uuid=' . $order->uuid }}" style="display:inline-block;background-color:#b59100;color:#ffffff;font-family:'Barlow Condensed',Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none;padding:13px 32px;border-radius:10px;">
                            Track your order
                        </a>
                                    </td>
                                </tr>

                            </table>
                        </td>
                    </tr>

                    {{-- Footer --}}
                    <tr>
                        <td align="center" style="padding:20px 16px 8px;">
                            <p style="margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:500;letter-spacing:0.06em;text-transform:uppercase;color:#9ca3af;">
                                {{ config('app.name') }}
                            </p>
                            <p style="margin:8px 0 0;font-family:'Source Serif 4',Georgia,serif;font-size:12px;color:#6b7280;">
                                Questions? Reply to this email and we'll be happy to help.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
