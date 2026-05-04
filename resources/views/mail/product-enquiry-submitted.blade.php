<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>New product enquiry — {{ config('app.name') }}</title>
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
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">

                    {{-- Top accent stripe (matches site gold / yellow ring) --}}
                    <tr>
                        <td style="height:4px;background-color:#ffde59;border-radius:16px 16px 0 0;line-height:4px;font-size:0;">&nbsp;</td>
                    </tr>
                    {{-- Header --}}
                    <tr>
                        <td style="background-color:#b59100;padding:22px 28px 24px;text-align:center;border-left:1px solid #9a7c00;border-right:1px solid #9a7c00;">
                            <p style="margin:0 0 6px;font-family:'Barlow Condensed',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:#ffde59;">
                                Product enquiry
                            </p>
                            <h1 style="margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:28px;font-weight:700;line-height:1.15;color:#ffffff;">
                                {{ $enquiry->productQrList?->product_name ?? 'New submission' }}
                            </h1>
                            <p style="margin:12px 0 0;font-family:'Source Serif 4',Georgia,serif;font-size:14px;font-weight:400;color:rgba(255,255,255,0.92);">
                                Someone submitted a form for this product on {{ config('app.name') }}.
                            </p>
                        </td>
                    </tr>

                    {{-- Card body --}}
                    <tr>
                        <td style="background-color:#ffffff;border:1px solid #d1d5db;border-top:0;padding:0 0 8px;border-radius:0 0 16px 16px;">
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="padding:24px 28px 8px;">
                                        <p style="margin:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">
                                            Contact details
                                        </p>
                                    </td>
                                </tr>

                                {{-- Row helper: label | value --}}
                                <tr>
                                    <td style="padding:8px 28px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
                                            <tr>
                                                <td style="padding:12px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;width:38%;">
                                                    Name
                                                </td>
                                                <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e5e7eb;font-family:'Source Serif 4',Georgia,serif;font-size:15px;color:#111827;">
                                                    {{ $enquiry->name }}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:12px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">
                                                    Store name
                                                </td>
                                                <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e5e7eb;font-family:'Source Serif 4',Georgia,serif;font-size:15px;color:#111827;">
                                                    {{ $enquiry->store_name ?: '—' }}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:12px 16px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">
                                                    Email
                                                </td>
                                                <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #e5e7eb;font-family:'Source Serif 4',Georgia,serif;font-size:15px;">
                                                    <a href="mailto:{{ $enquiry->email }}" style="color:#b59100;text-decoration:none;font-weight:600;">{{ $enquiry->email }}</a>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:12px 16px;background-color:#f9fafb;border-bottom:0;font-family:'Barlow Condensed',Arial,sans-serif;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">
                                                    Phone
                                                </td>
                                                <td style="padding:12px 16px;background-color:#ffffff;font-family:'Source Serif 4',Georgia,serif;font-size:15px;color:#111827;">
                                                    <a href="tel:{{ preg_replace('/\s+/', '', $enquiry->phone) }}" style="color:#b59100;text-decoration:none;font-weight:600;">{{ $enquiry->phone }}</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                {{-- Message --}}
                                <tr>
                                    <td style="padding:16px 28px 24px;">
                                        <p style="margin:0 0 10px;font-family:'Barlow Condensed',Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">
                                            Message
                                        </p>
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                                            <tr>
                                                <td style="width:4px;background-color:#ffde59;border-radius:2px 0 0 2px;line-height:1;font-size:0;">&nbsp;</td>
                                                <td style="background-color:#fafafa;border:1px solid #e5e7eb;border-left:0;border-radius:0 12px 12px 0;padding:16px 18px;">
                                                    <div style="font-family:'Source Serif 4',Georgia,serif;font-size:15px;line-height:1.55;color:#374151;white-space:pre-wrap;">{!! $enquiry->message !== '' ? nl2br(e($enquiry->message)) : '—' !!}</div>
                                                </td>
                                            </tr>
                                        </table>
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
                                Submitted {{ $enquiry->created_at?->timezone(config('app.timezone'))->format('M j, Y \a\t g:i A') ?? '' }} ({{ config('app.timezone') }})
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
