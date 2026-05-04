<?php

namespace App\Mail;

use App\Models\ProductEnquiry;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ProductEnquirySubmittedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public ProductEnquiry $enquiry) {}

    public function envelope(): Envelope
    {
        $productName = $this->enquiry->productQrList?->product_name ?? 'Product';

        return new Envelope(
            subject: 'New product enquiry: '.$productName,
            replyTo: [
                new Address($this->enquiry->email, $this->enquiry->name),
            ],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.product-enquiry-submitted',
        );
    }
}
