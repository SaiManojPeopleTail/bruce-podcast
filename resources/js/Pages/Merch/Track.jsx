import HomeLayout from '@/Layouts/HomeLayout';
import { Head, useForm } from '@inertiajs/react';
import { ExternalLink, Loader2, Package, Truck } from 'lucide-react';
import { useEffect } from 'react';

function formatPrice(cents) {
    return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

function formatDate(iso) {
    if (!iso) return null;
    try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }); } catch { return null; }
}

const STATUS_STEPS = ['paid', 'submitted', 'in_production', 'shipped', 'fulfilled'];

function StatusTimeline({ status }) {
    const current = STATUS_STEPS.indexOf(status);
    const labels = {
        paid: 'Payment received',
        submitted: 'Sent to production',
        in_production: 'In production',
        shipped: 'Shipped',
        fulfilled: 'Delivered',
    };
    return (
        <ol className="relative border-l border-gray-200 space-y-6 pl-6">
            {STATUS_STEPS.map((s, i) => {
                const done = i <= current;
                const active = i === current;
                return (
                    <li key={s} className="flex items-start gap-3">
                        <span
                            className={`absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                                done
                                    ? 'border-[#b59100] bg-[#b59100]'
                                    : 'border-gray-300 bg-white'
                            }`}
                            style={{ top: 'auto' }}
                        />
                        <p className={`ml-2 text-sm ${active ? 'font-semibold text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'}`}>
                            {labels[s]}
                        </p>
                    </li>
                );
            })}
        </ol>
    );
}

export default function Track({ order }) {
    const { data, setData, post, processing, errors } = useForm({ uuid: '', email: '' });

    // Pre-fill UUID from ?uuid= query param (set by the confirmation email link)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const uuidParam = params.get('uuid');
        if (uuidParam) setData('uuid', uuidParam);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('merch.track.lookup'));
    };

    const tracking = order?.tracking_info;

    return (
        <HomeLayout>
            <Head title="Track your order" />

            <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
                <div className="mb-10 text-center">
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#b59100]">Order tracking</p>
                    <h1 className="mt-2 text-3xl font-bold text-gray-900">Track your order</h1>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Order ID
                                {data.uuid && <span className="ml-2 text-xs font-normal text-[#b59100]">Pre-filled from your confirmation email</span>}
                            </label>
                            <input
                                type="text"
                                value={data.uuid}
                                onChange={(e) => setData('uuid', e.target.value)}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-[#b59100]/50 ${errors.uuid ? 'border-red-400' : 'border-gray-300'}`}
                            />
                            {errors.uuid && <p className="mt-1 text-xs text-red-500">{errors.uuid}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email address</label>
                            <input
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className={`mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#b59100]/50 ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
                            />
                            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                        </div>
                        <button
                            type="submit"
                            disabled={processing}
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b59100] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a07e00] disabled:opacity-60"
                        >
                            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {processing ? 'Looking up…' : 'Track order'}
                        </button>
                    </form>
                </div>

                {order && (
                    <div className="mt-8 space-y-6">
                        {/* Status */}
                        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <Package className="h-5 w-5 text-[#b59100]" />
                                <h2 className="font-semibold text-gray-900">Order status</h2>
                                <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium bg-${order.status_color}-100 text-${order.status_color}-800`}>
                                    {order.status_label}
                                </span>
                            </div>
                            <StatusTimeline status={order.status} />
                        </div>

                        {/* Tracking */}
                        {tracking && (
                            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                                <div className="mb-3 flex items-center gap-2">
                                    <Truck className="h-5 w-5 text-[#b59100]" />
                                    <h2 className="font-semibold text-gray-900">Shipment tracking</h2>
                                </div>
                                <dl className="space-y-2 text-sm">
                                    {tracking.carrier && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Carrier</dt>
                                            <dd className="font-medium text-gray-900">{tracking.carrier}</dd>
                                        </div>
                                    )}
                                    {tracking.number && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Tracking number</dt>
                                            <dd className="font-mono text-sm text-gray-900">{tracking.number}</dd>
                                        </div>
                                    )}
                                    {tracking.shipped_at && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Shipped</dt>
                                            <dd className="text-gray-900">{formatDate(tracking.shipped_at)}</dd>
                                        </div>
                                    )}
                                    {tracking.delivered_at && (
                                        <div className="flex justify-between">
                                            <dt className="text-gray-500">Delivered</dt>
                                            <dd className="text-gray-900">{formatDate(tracking.delivered_at)}</dd>
                                        </div>
                                    )}
                                </dl>
                                {tracking.url && (
                                    <a
                                        href={tracking.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Track on carrier website
                                    </a>
                                )}
                            </div>
                        )}

                        {/* Order items */}
                        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                            <h2 className="mb-3 font-semibold text-gray-900">Items</h2>
                            <ul className="divide-y divide-gray-100">
                                {(order.items ?? []).map((item, i) => (
                                    <li key={i} className="flex justify-between py-2.5 text-sm">
                                        <div>
                                            <p className="font-medium text-gray-900">{item.product_title}</p>
                                            {item.variant_title && <p className="text-xs text-gray-500">{item.variant_title}</p>}
                                        </div>
                                        <p className="text-gray-600">×{item.quantity}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </HomeLayout>
    );
}
