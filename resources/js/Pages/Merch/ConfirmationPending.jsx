import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link, router } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const POLL_MS = 1000;
const MAX_ATTEMPTS = 45;

export default function ConfirmationPending({ paymentIntentId }) {
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let attempt = 0;
        let timer;

        const poll = async () => {
            if (cancelled) return;
            attempt += 1;
            if (attempt > MAX_ATTEMPTS) {
                setTimedOut(true);
                return;
            }
            try {
                const res = await fetch(route('checkout.lookup-order', paymentIntentId), {
                    headers: { Accept: 'application/json' },
                    credentials: 'same-origin',
                });
                if (!res.ok) {
                    timer = setTimeout(poll, POLL_MS);
                    return;
                }
                const data = await res.json();
                if (data.ready && data.uuid) {
                    router.visit(route('checkout.confirmation', data.uuid), { replace: true });
                    return;
                }
            } catch {
                /* network blip — retry */
            }
            timer = setTimeout(poll, POLL_MS);
        };

        poll();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [paymentIntentId]);

    return (
        <HomeLayout>
            <Head title="Confirming order…" />

            <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
                {!timedOut ? (
                    <>
                        <Loader2 className="h-10 w-10 animate-spin text-[#b59100]" aria-hidden />
                        <h1 className="mt-6 text-xl font-semibold text-gray-900">Finalizing your order…</h1>
                        <p className="mt-2 text-sm text-gray-600">
                            This usually takes a moment. Please keep this page open.
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className="text-xl font-semibold text-gray-900">Still processing</h1>
                        <p className="mt-2 text-sm text-gray-600">
                            Your payment may have gone through, but we couldn’t load the confirmation page yet.
                            Check your email for a receipt, or look up your order with the reference from Stripe.
                        </p>
                        <div className="mt-8 flex flex-wrap justify-center gap-3">
                            <Link
                                href={route('merch.track')}
                                className="rounded-lg bg-[#b59100] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#a07e00]"
                            >
                                Track order
                            </Link>
                            <Link
                                href={route('merch.index')}
                                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Back to shop
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </HomeLayout>
    );
}
