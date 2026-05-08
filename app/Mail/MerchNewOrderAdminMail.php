<?php

namespace App\Mail;

use App\Models\MerchOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class MerchNewOrderAdminMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public MerchOrder $order,
        public string $adminOrderUrl,
    ) {
        $this->order->load('items');
    }

    public function envelope(): Envelope
    {
        $customerEmail = trim((string) $this->order->customer_email);
        $replyTo = [];
        if ($customerEmail !== '' && filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            $replyTo[] = new Address(
                $customerEmail,
                trim((string) $this->order->customer_name) ?: 'Customer',
            );
        }

        return new Envelope(
            subject: 'New merch order #'.$this->order->id.' — '.config('app.name'),
            replyTo: $replyTo,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.merch-new-order-admin',
        );
    }
}
