<?php

namespace App\Jobs;

use App\Mail\ProductEnquirySubmittedMail;
use App\Models\ProductEnquiry;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class SendProductEnquiryNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $productEnquiryId) {}

    public function handle(): void
    {
        $enquiry = ProductEnquiry::query()->with('productQrList')->find($this->productEnquiryId);
        if (! $enquiry) {
            return;
        }

        $product = $enquiry->productQrList;
        $to = trim((string) ($product?->notification_email ?? ''));
        if ($to === '') {
            $enquiry->forceFill([
                'notification_status' => 'na',
                'notification_error' => null,
            ])->save();

            return;
        }

        if ($enquiry->notification_status === 'sent') {
            return;
        }

        try {
            Mail::to($to)->send(new ProductEnquirySubmittedMail($enquiry));
            $enquiry->forceFill([
                'notification_status' => 'sent',
                'notification_error' => null,
            ])->save();
        } catch (\Throwable $e) {
            Log::warning('Product enquiry notification mail failed', [
                'enquiry_id' => $enquiry->id,
                'message' => $e->getMessage(),
            ]);
            $enquiry->forceFill([
                'notification_status' => 'failed',
                'notification_error' => Str::limit($e->getMessage(), 2000),
            ])->save();
        }
    }

    public function failed(?\Throwable $exception): void
    {
        if (! $exception) {
            return;
        }
        $enquiry = ProductEnquiry::query()->find($this->productEnquiryId);
        if ($enquiry && $enquiry->notification_status !== 'sent') {
            $enquiry->forceFill([
                'notification_status' => 'failed',
                'notification_error' => Str::limit($exception->getMessage(), 2000),
            ])->save();
        }
    }
}
