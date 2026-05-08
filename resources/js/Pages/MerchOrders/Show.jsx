import ResendMerchOrderEmailDropdown from '@/Components/ResendMerchOrderEmailDropdown';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { ExternalLink, Package, Truck } from 'lucide-react';

const COLOR_MAP = {
    amber:   'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    blue:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    indigo:  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    emerald: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    red:     'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    gray:    'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
};

function formatPrice(cents) {
    return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

function formatDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return '—'; }
}

function DL({ label, value }) {
    return (
        <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-0.5 text-sm text-gray-900 dark:text-slate-100">{value ?? '—'}</dd>
        </div>
    );
}

export default function MerchOrdersShow({ order }) {
    const tracking = order.tracking_info;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex w-full flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link href={route('merch-orders.index')} className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
                            ← Orders
                        </Link>
                        <h2 className="text-xl font-semibold text-gray-800 dark:text-slate-200">
                            Order #{order.id}
                        </h2>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_MAP[order.status_color ?? 'gray'] ?? COLOR_MAP.gray}`}>
                            {order.status_label}
                        </span>
                    </div>
                    <ResendMerchOrderEmailDropdown orderId={order.id} align="left" />
                </div>
            }
        >
            <Head title={`Order #${order.id}`} />

            <div className="mx-auto w-full max-w-3xl py-6 space-y-6">

                {/* Customer + Address */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Customer</h3>
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <DL label="Name" value={order.customer_name} />
                        <DL label="Email" value={order.customer_email} />
                        <DL label="Phone" value={order.customer_phone} />
                        <DL label="Printify order ID" value={order.printify_order_id} />
                    </dl>
                    <div className="mt-4 border-t border-gray-100 pt-4 dark:border-slate-700">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-1">Shipping address</p>
                        <p className="text-sm text-gray-900 dark:text-slate-100">
                            {order.address_first_name} {order.address_last_name}<br />
                            {order.address_line1}{order.address_line2 ? `, ${order.address_line2}` : ''}<br />
                            {order.address_city}, {order.address_region} {order.address_zip}<br />
                            {order.address_country}
                        </p>
                    </div>
                </div>

                {/* Items */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="mb-3 flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Items</h3>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                        <thead>
                            <tr>
                                {['Product', 'Variant', 'Qty', 'Unit price', 'Line total'].map((h) => (
                                    <th key={h} className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                            {(order.merch_order_items ?? order.items ?? []).map((item, i) => (
                                <tr key={i}>
                                    <td className="py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100">{item.product_title}</td>
                                    <td className="py-2.5 text-sm text-gray-500 dark:text-slate-400">{item.variant_title ?? '—'}</td>
                                    <td className="py-2.5 text-sm text-gray-700 dark:text-slate-300">{item.quantity}</td>
                                    <td className="py-2.5 text-sm text-gray-700 dark:text-slate-300">{formatPrice(item.unit_price)}</td>
                                    <td className="py-2.5 text-sm font-medium text-gray-900 dark:text-slate-100">{formatPrice(item.unit_price * item.quantity)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div className="mt-4 space-y-1.5 border-t border-gray-200 pt-4 dark:border-slate-700">
                        <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                            <span>Subtotal</span><span>{formatPrice(order.subtotal_amount)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                            <span>Shipping</span><span>{formatPrice(order.shipping_cost)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                            <span>Tax (HST {(parseFloat(order.tax_rate ?? 0) * 100).toFixed(0)}%)</span>
                            <span>{formatPrice(order.tax_amount)}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-semibold text-gray-900 dark:border-slate-700 dark:text-slate-100">
                            <span>Total</span><span>{formatPrice(order.total_amount)}</span>
                        </div>
                    </div>
                </div>

                {/* Tracking */}
                {tracking && (
                    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                        <div className="mb-3 flex items-center gap-2">
                            <Truck className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Shipment tracking</h3>
                        </div>
                        <dl className="grid gap-3 sm:grid-cols-2">
                            <DL label="Carrier" value={tracking.carrier} />
                            <DL label="Tracking number" value={tracking.number} />
                            <DL label="Shipped" value={formatDate(tracking.shipped_at)} />
                            <DL label="Delivered" value={formatDate(tracking.delivered_at)} />
                        </dl>
                        {tracking.url && (
                            <a href={tracking.url} target="_blank" rel="noopener noreferrer"
                                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                                <ExternalLink className="h-4 w-4" />
                                Track on carrier website
                            </a>
                        )}
                    </div>
                )}

                <div className="text-xs text-gray-400 dark:text-slate-500">
                    <p>Order UUID: <span className="font-mono">{order.uuid}</span></p>
                    <p>Stripe PI: <span className="font-mono">{order.stripe_payment_intent_id}</span></p>
                    <p>Placed: {formatDate(order.created_at)}</p>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
