import ResendMerchOrderEmailDropdown from '@/Components/ResendMerchOrderEmailDropdown';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'pending_payment', label: 'Pending payment' },
    { value: 'paid', label: 'Paid' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'in_production', label: 'In production' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'fulfilled', label: 'Fulfilled' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'failed', label: 'Failed' },
];

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
    try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }); } catch { return '—'; }
}

function serialNumber(pagination, index) {
    const page = Number(pagination?.current_page ?? 1);
    const perPage = Number(pagination?.per_page ?? 20);
    return (page - 1) * perPage + index + 1;
}

export default function MerchOrdersIndex({ orders, filters }) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [status, setStatus] = useState(filters?.status ?? '');

    const rows = orders?.data ?? [];

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('merch-orders.index'), { search: search || undefined, status: status || undefined }, { preserveState: true });
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">Merch Orders</h2>}
        >
            <Head title="Merch Orders" />

            <div className="w-full py-6">
                <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3">
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, email or order ID…"
                        className="block w-full max-w-sm rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    />
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                    >
                        {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    <button type="submit" className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                        Filter
                    </button>
                </form>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {rows.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-slate-400">No orders found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        {['#', 'Order ID', 'Customer', 'Total', 'Status', 'Date', 'Actions'].map((h, i) => (
                                            <th key={h} scope="col" className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 ${i === 0 ? 'w-14 text-center' : i === 6 ? 'text-right' : 'text-left'}`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {rows.map((r, idx) => (
                                        <tr key={r.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-900/30">
                                            <td className="w-14 px-4 py-4 text-center text-sm tabular-nums text-gray-500 dark:text-slate-400">
                                                {serialNumber(orders, idx)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="font-mono text-xs text-gray-500 dark:text-slate-400 truncate max-w-[10rem] block" title={r.uuid}>
                                                    {r.uuid?.slice(0, 8)}…
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-medium text-gray-900 dark:text-slate-100">{r.customer_name}</p>
                                                <p className="text-xs text-gray-500 dark:text-slate-400">{r.customer_email}</p>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-700 dark:text-slate-300">
                                                {formatPrice(r.total_amount)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR_MAP[r.status_color ?? 'gray'] ?? COLOR_MAP.gray}`}>
                                                    {r.status_label ?? r.status}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-slate-400">
                                                {formatDate(r.created_at)}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right">
                                                <div className="inline-flex flex-wrap items-center justify-end gap-2">
                                                    <Link
                                                        href={route('merch-orders.show', r.id)}
                                                        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                                    >
                                                        View
                                                    </Link>
                                                    <ResendMerchOrderEmailDropdown orderId={r.id} align="left" />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {rows.length > 0 && orders?.total != null && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-sm text-gray-700 dark:text-slate-300">
                            Showing <span className="font-medium">{orders.from}</span> to{' '}
                            <span className="font-medium">{orders.to}</span> of{' '}
                            <span className="font-medium">{orders.total}</span>
                        </p>
                        {orders.last_page > 1 && (
                            <div className="flex flex-wrap gap-1">
                                {orders.links.map((link, i) => (
                                    <span key={i}>
                                        {link.url ? (
                                            <Link href={link.url} className={`inline-flex items-center rounded-md border px-3 py-1 text-sm ${link.active ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-600 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'}`} dangerouslySetInnerHTML={{ __html: link.label }} />
                                        ) : (
                                            <span className="inline-flex cursor-default items-center rounded-md border border-gray-200 bg-gray-100 px-3 py-1 text-sm text-gray-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-500" dangerouslySetInnerHTML={{ __html: link.label }} />
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
