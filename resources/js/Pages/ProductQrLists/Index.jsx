import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, Link, router } from '@inertiajs/react';
import { ReactQRCode } from '@lglab/react-qr-code';
import { Download, QrCode } from 'lucide-react';
import { useRef, useState } from 'react';

const QR_SETTINGS = {
    dataModulesSettings: { style: 'rounded' },
    finderPatternOuterSettings: { style: 'rounded-sm' },
    finderPatternInnerSettings: { style: 'rounded-sm' },
};

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
    } catch {
        return '—';
    }
}

function QrModal({ product, onClose }) {
    const qrRef = useRef(null);
    const qrUrl = `${window.location.origin}/product/${product.slug}`;

    const handleDownload = () => {
        qrRef.current?.download({ name: product.slug, format: 'png', size: 512 });
    };

    return (
        <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                    QR Code — {product.product_name}
                </h3>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    aria-label="Close"
                >
                    <span className="text-xl leading-none">×</span>
                </button>
            </div>

            <div className="flex flex-col items-center gap-5">
                {/* Always white so the QR is scannable in dark mode */}
                <div className="rounded-2xl border border-gray-200 bg-white p-0 overflow-hidden shadow-sm">
                    <ReactQRCode
                        ref={qrRef}
                        value={qrUrl}
                        size={256}
                        level="M"
                        background="#ffffff"
                        {...QR_SETTINGS}
                    />
                </div>

                <div className="w-full rounded-lg bg-gray-50 px-4 py-2 text-center dark:bg-slate-800">
                    <p className="break-all font-mono text-xs text-gray-500 dark:text-slate-400">{qrUrl}</p>
                </div>

                <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
                >
                    <Download className="h-4 w-4" />
                    Download PNG (512 × 512)
                </button>
            </div>
        </div>
    );
}

function serialNumber(pagination, index) {
    const page = Number(pagination?.current_page ?? 1);
    const perPage = Number(pagination?.per_page ?? 15);
    return (page - 1) * perPage + index + 1;
}

export default function Index({ products, filters }) {
    const [search, setSearch] = useState(filters?.search ?? '');
    const [deleteId, setDeleteId] = useState(null);
    const [qrProduct, setQrProduct] = useState(null);

    const rows = products?.data ?? [];

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('product-qr-lists.index'), { search: search || undefined }, { preserveState: true });
    };

    const confirmDelete = () => {
        if (!deleteId) return;
        router.delete(route('product-qr-lists.destroy', deleteId), {
            preserveScroll: true,
            onSuccess: () => setDeleteId(null),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    QR Companies
                </h2>
            }
        >
            <Head title="QR Companies" />

            <div className="w-full py-6">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <form onSubmit={handleSearch} className="flex flex-1 gap-2 sm:max-w-md">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or slug…"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        />
                        <button
                            type="submit"
                            className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Search
                        </button>
                    </form>
                    <Link href={route('product-qr-lists.create')}>
                        <PrimaryButton>Add QR Company</PrimaryButton>
                    </Link>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {rows.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-slate-400">
                            {filters?.search
                                ? 'No products match your search.'
                                : 'No QR companies yet. Add your first one.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        {['S.No.', 'Product', 'Slug', 'Images', 'Video', 'Created', 'Actions'].map((h, i) => (
                                            <th
                                                key={h}
                                                scope="col"
                                                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 ${i === 0 ? 'w-14 text-center' : i === 6 ? 'text-right' : 'text-left'}`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {rows.map((r, idx) => (
                                        <tr key={r.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-900/30">
                                            <td className="w-14 px-4 py-4 text-center text-sm tabular-nums text-gray-500 dark:text-slate-400">
                                                {serialNumber(products, idx)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-medium text-gray-900 dark:text-slate-100">{r.product_name}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <span className="font-mono text-xs text-gray-500 dark:text-slate-400">
                                                    {r.slug}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-600 dark:text-slate-400">
                                                {Array.isArray(r.product_images) ? r.product_images.length : 0}
                                            </td>
                                            <td className="px-4 py-4 text-sm">
                                                {r.video_url ? (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                                        Yes
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 dark:text-slate-500">—</span>
                                                )}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-slate-400">
                                                {formatDate(r.created_at)}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setQrProduct(r)}
                                                        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                                    >
                                                        <QrCode className="h-4 w-4" />
                                                        QR
                                                    </button>
                                                    <Link
                                                        href={route('product-qr-lists.edit', r.id)}
                                                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                                    >
                                                        Edit
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteId(r.id)}
                                                        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {rows.length > 0 && products?.total != null && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-sm text-gray-700 dark:text-slate-300">
                            Showing{' '}
                            <span className="font-medium">{products.from}</span> to{' '}
                            <span className="font-medium">{products.to}</span> of{' '}
                            <span className="font-medium">{products.total}</span>
                        </p>
                        {products.last_page > 1 && (
                            <div className="flex flex-wrap gap-1">
                                {products.links.map((link, i) => (
                                    <span key={i}>
                                        {link.url ? (
                                            <Link
                                                href={link.url}
                                                className={`inline-flex items-center rounded-md border px-3 py-1 text-sm ${
                                                    link.active
                                                        ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-600 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                                }`}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        ) : (
                                            <span
                                                className="inline-flex cursor-default items-center rounded-md border border-gray-200 bg-gray-100 px-3 py-1 text-sm text-gray-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-500"
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* QR Modal */}
            <Modal show={!!qrProduct} onClose={() => setQrProduct(null)} maxWidth="sm">
                {qrProduct && <QrModal product={qrProduct} onClose={() => setQrProduct(null)} />}
            </Modal>


            {/* Delete Modal */}
            <Modal show={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="sm">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Delete QR Company</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        This permanently removes the QR company entry and deletes all associated images and video from S3. This cannot be undone.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setDeleteId(null)}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                        <DangerButton onClick={confirmDelete}>Delete</DangerButton>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
