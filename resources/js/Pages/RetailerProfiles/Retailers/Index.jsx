import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

function formatUpdatedAt(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        });
    } catch {
        return '—';
    }
}

function stripPaginationLabel(label) {
    if (label == null) {
        return '';
    }
    return String(label)
        .replace(/<[^>]+>/g, '')
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace('&laquo; Previous', 'Previous')
        .replace('Next &raquo;', 'Next')
        .trim();
}

/** Serial number for paginated rows (1-based across pages). */
function serialNumber(paginator, index) {
    if (paginator?.from != null) {
        return paginator.from + index;
    }
    const page = Number(paginator?.current_page ?? 1);
    const perPage = Number(paginator?.per_page ?? 15);
    return (page - 1) * perPage + index + 1;
}

export default function Index({ retailers, filters }) {
    const [deleteId, setDeleteId] = useState(null);
    const [search, setSearch] = useState(filters?.search ?? '');
    const [togglingId, setTogglingId] = useState(null);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkUploading, setBulkUploading] = useState(false);
    const [rows, setRows] = useState(retailers?.data ?? []);

    useEffect(() => {
        setRows(retailers?.data ?? []);
    }, [retailers?.data]);

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('retailer-profiles.retailers.index'), { search: search || undefined }, { preserveState: true });
    };

    const confirmDelete = () => {
        if (!deleteId) return;
        router.delete(route('retailer-profiles.retailers.destroy', deleteId), {
            preserveScroll: true,
            onSuccess: () => setDeleteId(null),
        });
    };

    const toggleActive = async (id) => {
        if (togglingId === id) return;
        const current = rows.find((row) => row.id === id);
        if (!current) return;

        const nextIsActive = !current.is_active;
        setRows((prev) => prev.map((row) => (row.id === id ? { ...row, is_active: nextIsActive } : row)));
        setTogglingId(id);

        try {
            const { data } = await axios.patch(
                route('retailer-profiles.retailers.toggle-active', id),
                {},
                { headers: { Accept: 'application/json' } },
            );
            if (typeof data?.is_active === 'boolean') {
                setRows((prev) =>
                    prev.map((row) => (row.id === id ? { ...row, is_active: data.is_active } : row)),
                );
            }
        } catch (err) {
            setRows((prev) => prev.map((row) => (row.id === id ? { ...row, is_active: current.is_active } : row)));
            toast.error('Could not update retailer status. Please try again.');
        } finally {
            setTogglingId(null);
        }
    };

    const openBulkModal = () => {
        setBulkFile(null);
        setBulkOpen(true);
    };

    const submitBulkImport = async () => {
        if (!bulkFile || bulkUploading) return;
        setBulkUploading(true);
        const formData = new FormData();
        formData.append('csv', bulkFile);

        try {
            const { data } = await axios.post(route('retailer-profiles.retailers.bulk-import'), formData, {
                headers: { Accept: 'application/json' },
            });
            toast.success(data.message ?? 'Import finished.');
            if (Array.isArray(data.errors) && data.errors.length > 0) {
                const sample = data.errors
                    .slice(0, 5)
                    .map((e) => `Line ${e.line}: ${e.message}`)
                    .join('\n');
                toast.error(`Some rows failed: ${sample.replace(/\n/g, ' · ')}`, { duration: 8000 });
            }
            setBulkOpen(false);
            setBulkFile(null);
            router.reload({ preserveScroll: true });
        } catch (err) {
            const msg =
                err.response?.data?.message ??
                err.response?.data?.errors?.csv?.[0] ??
                'Import failed. Check the file and try again.';
            toast.error(typeof msg === 'string' ? msg : 'Import failed.');
        } finally {
            setBulkUploading(false);
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Manage retailers
                </h2>
            }
        >
            <Head title="Retailers" />

            <div className="w-full py-6">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <form onSubmit={handleSearch} className="flex flex-1 gap-2 sm:max-w-md">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, handle, or website…"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        />
                        <button
                            type="submit"
                            className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Search
                        </button>
                    </form>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={openBulkModal}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Bulk import
                        </button>
                        <Link href={route('retailer-profiles.retailers.create')}>
                            <PrimaryButton>Add retailer</PrimaryButton>
                        </Link>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {rows.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-slate-400">
                            {filters?.search ? 'No retailers match your search.' : 'No retailers yet. Add your first retailer.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="w-14 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400"
                                        >
                                            S.No.
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400"
                                        >
                                            Name
                                        </th>
                                        <th
                                            scope="col"
                                            className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell dark:text-slate-400"
                                        >
                                            Departments
                                        </th>
                                        <th
                                            scope="col"
                                            className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell dark:text-slate-400"
                                        >
                                            Website
                                        </th>
                                        <th
                                            scope="col"
                                            className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 xl:table-cell dark:text-slate-400"
                                        >
                                            Last updated
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400"
                                        >
                                            Active
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400"
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {rows.map((r, idx) => (
                                        <tr key={r.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-900/30">
                                            <td className="w-14 px-3 py-4 text-center text-sm tabular-nums text-gray-500 dark:text-slate-400">
                                                {serialNumber(retailers, idx)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-medium text-gray-900 dark:text-slate-100">{r.name}</p>
                                                <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-slate-500">
                                                    @{r.handle}
                                                </p>
                                                {(r.departments ?? []).length > 0 ? (
                                                    <div className="mt-2 flex flex-wrap gap-1.5 lg:hidden">
                                                        {r.departments.map((d) => (
                                                            <span
                                                                key={d.id}
                                                                className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                                            >
                                                                {d.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                                <p className="mt-2 text-sm text-indigo-600 md:hidden dark:text-indigo-400">
                                                    {r.website ? (
                                                        <a
                                                            href={
                                                                r.website.startsWith('http')
                                                                    ? r.website
                                                                    : `https://${r.website}`
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="hover:underline"
                                                        >
                                                            {r.website}
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400 dark:text-slate-500">No website</span>
                                                    )}
                                                </p>
                                            </td>
                                            <td className="hidden px-4 py-4 lg:table-cell">
                                                <div className="flex max-w-[14rem] flex-wrap gap-1.5">
                                                    {(r.departments ?? []).length > 0 ? (
                                                        r.departments.map((d) => (
                                                            <span
                                                                key={d.id}
                                                                className="inline-flex rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                                            >
                                                                {d.name}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-sm text-gray-400 dark:text-slate-500">—</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="hidden px-4 py-4 md:table-cell">
                                                {r.website ? (
                                                    <a
                                                        href={
                                                            r.website.startsWith('http') ? r.website : `https://${r.website}`
                                                        }
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="max-w-xs truncate text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                                                    >
                                                        {r.website}
                                                    </a>
                                                ) : (
                                                    <span className="text-sm text-gray-400 dark:text-slate-500">—</span>
                                                )}
                                            </td>
                                            <td className="hidden whitespace-nowrap px-4 py-4 text-sm text-gray-600 xl:table-cell dark:text-slate-400">
                                                {formatUpdatedAt(r.updated_at)}
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex justify-center">
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={r.is_active}
                                                        disabled={togglingId === r.id}
                                                        onClick={() => toggleActive(r.id)}
                                                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-slate-800 ${
                                                            r.is_active ? 'bg-emerald-600' : 'bg-gray-200 dark:bg-slate-600'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                                                                r.is_active ? 'translate-x-5' : 'translate-x-0.5'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link
                                                        href={route('retailer-profiles.retailers.edit', r.id)}
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

                {rows.length > 0 && retailers?.total != null && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-sm text-gray-700 dark:text-slate-300">
                            Showing{' '}
                            <span className="font-medium">{retailers.from}</span> to{' '}
                            <span className="font-medium">{retailers.to}</span> of{' '}
                            <span className="font-medium">{retailers.total}</span>
                            {retailers.last_page > 1 ? (
                                <span className="text-gray-500 dark:text-slate-400">
                                    {' '}
                                    (page {retailers.current_page} of {retailers.last_page})
                                </span>
                            ) : null}
                        </p>
                        {retailers.last_page > 1 ? (
                            <div className="flex flex-wrap gap-1">
                                {retailers.links.map((link, idx) => (
                                    <span key={idx}>
                                        {link.url ? (
                                            <Link
                                                href={link.url}
                                                className={`inline-flex items-center rounded-md border px-3 py-1 text-sm ${
                                                    link.active
                                                        ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-600 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                                }`}
                                            >
                                                {stripPaginationLabel(link.label)}
                                            </Link>
                                        ) : (
                                            <span className="inline-flex cursor-default items-center rounded-md border border-gray-200 bg-gray-100 px-3 py-1 text-sm text-gray-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-500">
                                                {stripPaginationLabel(link.label)}
                                            </span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            <Modal
                show={bulkOpen}
                onClose={() => {
                    if (!bulkUploading) setBulkOpen(false);
                }}
                closeable={!bulkUploading}
                maxWidth="lg"
            >
                <div className="p-6 dark:bg-slate-800">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Bulk import retailers</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        Upload a CSV with a header row. Columns (in order): Name, Departments, Description, Address Line 1,
                        Address Line 2, City, State, Postcode, Country, Phone, Notes, Email, URL — then for each contact
                        (up to 7): Contact1, Title, Email, Linkedin; Contact2, Title, Email, Linkedin; … through Contact7.
                        The Notes column is not imported (leave it empty or use it as a scratch column); add internal notes
                        when editing a retailer. Separate multiple departments with commas. Multiple phone numbers in the
                        Phone column may be comma-separated.
                    </p>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                            CSV file
                        </label>
                        <input
                            type="file"
                            accept=".csv,.txt,text/csv,text/plain"
                            disabled={bulkUploading}
                            onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                            className="mt-1 block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:text-slate-400 dark:file:bg-slate-700 dark:file:text-slate-200"
                        />
                    </div>
                    {bulkUploading ? (
                        <div
                            className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 dark:border-amber-900/50 dark:bg-amber-950/40"
                            role="status"
                            aria-live="polite"
                        >
                            <Loader2 className="h-10 w-10 animate-spin text-amber-700 dark:text-amber-400" />
                            <p className="text-center text-sm font-medium text-amber-900 dark:text-amber-200">
                                Importing… Do not refresh or close this window until finished.
                            </p>
                        </div>
                    ) : (
                        <p className="mt-3 text-xs text-gray-500 dark:text-slate-500">
                            New department names in the file are created automatically; existing names are matched
                            case-insensitively.
                        </p>
                    )}
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            disabled={bulkUploading}
                            onClick={() => setBulkOpen(false)}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                        <PrimaryButton type="button" disabled={!bulkFile || bulkUploading} onClick={submitBulkImport}>
                            {bulkUploading ? 'Importing…' : 'Start import'}
                        </PrimaryButton>
                    </div>
                </div>
            </Modal>

            <Modal show={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="sm">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Delete retailer</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        This removes the retailer profile, all store phone numbers, and contacts linked to it.
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
