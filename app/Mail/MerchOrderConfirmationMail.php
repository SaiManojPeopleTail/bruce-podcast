<?php

namespace App\Mail;

use App\Models\MerchOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class MerchOrderConfirmationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public MerchOrder $order) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your order is confirmed — '.config('app.name'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.merch-order-confirmation',
        );
    }
}
