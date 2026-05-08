import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link } from '@inertiajs/react';
import { CheckCircle2, Package } from 'lucide-react';

function formatPrice(cents) {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function Row({ label, value, bold }) {
    return (
        <div className={`flex justify-between text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
            <span>{label}</span>
            <span>{value}</span>
        </div>
    );
}

export default function Confirmation({ order }) {
    return (
        <HomeLayout>
            <Head title="Order confirmed" />

            <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
                <div className="mb-8 flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900">Order confirmed!</h1>
                    <p className="text-gray-600">
                        Thanks{order.customer_name ? `, ${order.customer_name.split(' ')[0]}` : ''}! Your order has been received and is being prepared.
                    </p>
                    <p className="text-sm text-gray-400">
                        A confirmation will be sent to <span className="font-medium text-gray-600">{order.customer_email}</span>
                    </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        <Package className="h-4 w-4" />
                        Order summary
                    </div>

                    <ul className="mb-4 divide-y divide-gray-100">
                        {(order.items ?? []).map((item, i) => (
                            <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                                <div>
                                    <p className="font-medium text-gray-900">{item.product_title}</p>
                                    {item.variant_title && <p className="text-xs text-gray-500">{item.variant_title}</p>}
                                </div>
                                <div className="text-right text-gray-600">
                                    <p>{formatPrice(item.unit_price * item.quantity)}</p>
                                    <p className="text-xs text-gray-400">×{item.quantity}</p>
                                </div>
                            </li>
                        ))}
                    </ul>

                    <div className="space-y-1.5 border-t border-gray-100 pt-4">
                        <p className="text-xs text-gray-500">All amounts in USD</p>
                        <Row label="Subtotal" value={formatPrice(order.subtotal_amount)} />
                        <Row label="Shipping" value={formatPrice(order.shipping_cost)} />
                        <Row
                            label={`Tax (HST ${(order.tax_rate * 100).toFixed(0)}%)`}
                            value={formatPrice(order.tax_amount)}
                        />
                        <div className="my-1 border-t border-gray-200" />
                        <Row label="Total" value={formatPrice(order.total_amount)} bold />
                    </div>

                    <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                        <p className="font-medium text-gray-700">Shipping to</p>
                        <p className="mt-1">{order.address_line1}, {order.address_city}, {order.address_region} {order.address_country}</p>
                    </div>

                    <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
                        <p className="font-medium">Order reference</p>
                        <p className="mt-1 font-mono text-xs">{order.uuid}</p>
                        <p className="mt-2 text-xs">Keep this ID to track your order at any time.</p>
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <Link
                        href={route('merch.track')}
                        className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Track order
                    </Link>
                    <Link
                        href={route('merch.index')}
                        className="rounded-lg bg-[#b59100] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#a07e00]"
                    >
                        Continue shopping
                    </Link>
                </div>
            </div>
        </HomeLayout>
    );
}
