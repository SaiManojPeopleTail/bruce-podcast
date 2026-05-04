import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronDown, Copy, Download, Eye, Mail } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

function localDateInputMax() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDate(iso) {
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

async function copyToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied`);
    } catch {
        toast.error('Could not copy');
    }
}

function serialNumber(pagination, index) {
    const page = Number(pagination?.current_page ?? 1);
    const perPage = Number(pagination?.per_page ?? 15);
    return (page - 1) * perPage + index + 1;
}

function hasProductNotifyEmail(row) {
    return Boolean(row?.product_notification_email?.trim?.());
}

function notifyStatusLabel(row) {
    if (!hasProductNotifyEmail(row)) return 'NA';
    switch (row.notification_status) {
        case 'sent':
            return 'Sent';
        case 'failed':
            return 'Failed';
        case 'pending':
            return 'Queued';
        default:
            return 'NA';
    }
}

function notifyStatusBadgeClass(row) {
    if (!hasProductNotifyEmail(row)) {
        return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    }
    switch (row.notification_status) {
        case 'sent':
            return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
        case 'failed':
            return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
        case 'pending':
            return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200';
        default:
            return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    }
}

function DetailModal({ row, onClose }) {
    if (!row) return null;

    return (
        <div className="p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Enquiry details</h3>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    aria-label="Close"
                >
                    <span className="text-xl leading-none">×</span>
                </button>
            </div>

            <dl className="space-y-4 text-sm">
                <div>
                    <dt className="font-medium text-gray-500 dark:text-slate-400">Product</dt>
                    <dd className="mt-1 text-base font-semibold text-gray-900 dark:text-slate-100">{row.product_name}</dd>
                </div>
                <div>
                    <dt className="font-medium text-gray-500 dark:text-slate-400">Name</dt>
                    <dd className="mt-1 text-gray-900 dark:text-slate-100">{row.name}</dd>
                </div>
                <div>
                    <dt className="font-medium text-gray-500 dark:text-slate-400">Store name</dt>
                    <dd className="mt-1 text-gray-900 dark:text-slate-100">
                        {row.store_name?.trim() ? row.store_name : '—'}
                    </dd>
                </div>
                <div>
                    <dt className="font-medium text-gray-500 dark:text-slate-400">Phone</dt>
                    <dd className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-gray-900 dark:text-slate-100">{row.phone}</span>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(row.phone, 'Phone')}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                        </button>
                    </dd>
                </div>
                <div>
                    <dt className="font-medium text-gray-500 dark:text-slate-400">Email</dt>
                    <dd className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="break-all text-gray-900 dark:text-slate-100">{row.email}</span>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(row.email, 'Email')}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                        </button>
                    </dd>
                </div>
                <div>
                    <dt className="font-medium text-gray-500 dark:text-slate-400">Message</dt>
                    <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-900 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100">
                        {row.message}
                    </dd>
                </div>
                <div>
                    <dt className="font-medium text-gray-500 dark:text-slate-400">Staff notification email</dt>
                    <dd className="mt-1 text-gray-900 dark:text-slate-100">
                        {row.product_notification_email?.trim() ? row.product_notification_email : '—'}
                    </dd>
                </div>
                <div>
                    <dt className="font-medium text-gray-500 dark:text-slate-400">Notification status</dt>
                    <dd className="mt-1">
                        <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${notifyStatusBadgeClass(row)}`}
                        >
                            {notifyStatusLabel(row)}
                        </span>
                        {row.notification_status === 'failed' && row.notification_error ? (
                            <p className="mt-2 whitespace-pre-wrap rounded border border-red-200 bg-red-50/80 p-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                                {row.notification_error}
                            </p>
                        ) : null}
                    </dd>
                </div>
                <div>
                    <dt className="font-medium text-gray-500 dark:text-slate-400">Submitted</dt>
                    <dd className="mt-1 text-gray-700 dark:text-slate-300">{formatDate(row.created_at)}</dd>
                </div>
            </dl>
        </div>
    );
}

export default function Index({ enquiries, filters, enquiriesExportAllCount = 0 }) {
    const page = usePage();
    const [search, setSearch] = useState(filters?.search ?? '');
    const [deleteId, setDeleteId] = useState(null);
    const [viewRow, setViewRow] = useState(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [exportScope, setExportScope] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [exporting, setExporting] = useState(false);
    const [rangeCount, setRangeCount] = useState(null);
    const [rangeCountLoading, setRangeCountLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectMenuOpen, setSelectMenuOpen] = useState(false);
    const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [selectAllMatchingLoading, setSelectAllMatchingLoading] = useState(false);
    const [selectMenuPosition, setSelectMenuPosition] = useState(null);
    const [resendingId, setResendingId] = useState(null);

    const todayMax = useMemo(() => localDateInputMax(), []);
    const rangeCountRequestId = useRef(0);
    const headerCheckboxRef = useRef(null);
    const selectMenuButtonRef = useRef(null);
    const prevFlashKeyRef = useRef('');

    const rows = enquiries?.data ?? [];
    const pageRowIds = useMemo(() => rows.map((r) => r.id), [rows]);
    const allPageSelected =
        pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.includes(id));
    const somePageSelected = pageRowIds.some((id) => selectedIds.includes(id));

    useEffect(() => {
        const el = headerCheckboxRef.current;
        if (el) {
            el.indeterminate = somePageSelected && !allPageSelected;
        }
    }, [somePageSelected, allPageSelected]);

    useEffect(() => {
        setSelectedIds([]);
    }, [filters?.search]);

    useEffect(() => {
        const s = page.props.flash?.success ?? '';
        const err = page.props.flash?.error ?? '';
        if (!s && !err) {
            prevFlashKeyRef.current = '';
            return;
        }
        const key = `${s}|${err}`;
        if (key === prevFlashKeyRef.current) {
            return;
        }
        prevFlashKeyRef.current = key;
        if (s) {
            toast.success(s);
        }
        if (err) {
            toast.error(err);
        }
    }, [page.props.flash]);

    const resendNotification = (id) => {
        setResendingId(id);
        router.post(
            route('product-enquiries.resend-notification', id),
            {},
            {
                preserveScroll: true,
                onFinish: () => setResendingId(null),
            },
        );
    };

    const updateSelectMenuPosition = useCallback(() => {
        const el = selectMenuButtonRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const menuWidth = 224;
        const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
        setSelectMenuPosition({ top: rect.bottom + 6, left });
    }, []);

    useLayoutEffect(() => {
        if (!selectMenuOpen) {
            setSelectMenuPosition(null);
            return undefined;
        }
        updateSelectMenuPosition();
        window.addEventListener('resize', updateSelectMenuPosition);
        window.addEventListener('scroll', updateSelectMenuPosition, true);
        return () => {
            window.removeEventListener('resize', updateSelectMenuPosition);
            window.removeEventListener('scroll', updateSelectMenuPosition, true);
        };
    }, [selectMenuOpen, updateSelectMenuPosition]);

    useEffect(() => {
        if (!selectMenuOpen) return undefined;
        const onDoc = (e) => {
            if (
                e.target.closest?.('[data-select-menu-root]') ||
                e.target.closest?.('[data-select-menu-portal]')
            ) {
                return;
            }
            setSelectMenuOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [selectMenuOpen]);

    useEffect(() => {
        if (!exportOpen || exportScope !== 'range') {
            setRangeCount(null);
            setRangeCountLoading(false);
            return undefined;
        }
        if (!dateFrom || !dateTo || dateFrom > dateTo || dateTo > todayMax || dateFrom > todayMax) {
            setRangeCount(null);
            setRangeCountLoading(false);
            return undefined;
        }

        const myId = ++rangeCountRequestId.current;
        let cancelled = false;
        setRangeCountLoading(true);
        setRangeCount(null);

        const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
        fetch(`${route('product-enquiries.export-range-count')}?${params}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        })
            .then((res) => {
                if (cancelled || rangeCountRequestId.current !== myId) {
                    return null;
                }
                return res.ok ? res.json() : null;
            })
            .then((data) => {
                if (cancelled || rangeCountRequestId.current !== myId || !data) {
                    return;
                }
                setRangeCount(typeof data.count === 'number' ? data.count : null);
            })
            .catch(() => {
                if (!cancelled && rangeCountRequestId.current === myId) {
                    setRangeCount(null);
                }
            })
            .finally(() => {
                if (!cancelled && rangeCountRequestId.current === myId) {
                    setRangeCountLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [exportOpen, exportScope, dateFrom, dateTo, todayMax]);

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('product-enquiries.index'), { search: search || undefined }, { preserveState: true });
    };

    const confirmDelete = () => {
        if (!deleteId) return;
        const id = deleteId;
        router.delete(route('product-enquiries.destroy', id), {
            preserveScroll: true,
            onSuccess: () => {
                setDeleteId(null);
                setSelectedIds((prev) => prev.filter((x) => x !== id));
            },
        });
    };

    const toggleRowSelected = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleSelectCurrentPage = () => {
        if (pageRowIds.length === 0) return;
        if (allPageSelected) {
            setSelectedIds((prev) => prev.filter((id) => !pageRowIds.includes(id)));
        } else {
            setSelectedIds((prev) => [...new Set([...prev, ...pageRowIds])]);
        }
    };

    const selectAllOnPageOnly = () => {
        if (pageRowIds.length === 0) return;
        setSelectedIds((prev) => [...new Set([...prev, ...pageRowIds])]);
    };

    const clearSelection = () => {
        setSelectedIds([]);
    };

    const selectAllMatchingFilter = async () => {
        setSelectAllMatchingLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters?.search) params.set('search', filters.search);
            const res = await fetch(`${route('product-enquiries.ids')}?${params}`, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (!res.ok) {
                toast.error('Could not load all matching IDs.');
                return;
            }
            const data = await res.json();
            const ids = Array.isArray(data.ids) ? data.ids.map(Number) : [];
            setSelectedIds(ids);
            setSelectMenuOpen(false);
            toast.success(
                ids.length === 1 ? '1 enquiry selected.' : `${ids.length} enquiries selected.`,
            );
        } catch {
            toast.error('Could not load all matching IDs.');
        } finally {
            setSelectAllMatchingLoading(false);
        }
    };

    const confirmBulkDelete = () => {
        if (selectedIds.length === 0) return;
        setBulkDeleting(true);
        router.post(
            route('product-enquiries.bulk-destroy'),
            { ids: selectedIds },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setBulkDeleteOpen(false);
                    setSelectedIds([]);
                },
                onFinish: () => setBulkDeleting(false),
            },
        );
    };

    const openExportModal = () => {
        setExportScope(selectedIds.length > 0 ? 'selected' : 'all');
        setDateFrom('');
        setDateTo('');
        setRangeCount(null);
        setRangeCountLoading(false);
        rangeCountRequestId.current += 1;
        setExportOpen(true);
    };

    const closeExportModal = () => {
        if (exporting) return;
        setExportOpen(false);
    };

    useEffect(() => {
        if (exportOpen && exportScope === 'selected' && selectedIds.length === 0) {
            setExportScope('all');
        }
    }, [exportOpen, exportScope, selectedIds.length]);

    const runExport = async () => {
        if (exportScope === 'selected') {
            if (selectedIds.length === 0) {
                toast.error('No rows selected.');
                return;
            }
            setExporting(true);
            try {
                const res = await fetch(route('product-enquiries.export'), {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        Accept: 'text/csv, application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': csrfToken(),
                    },
                    body: JSON.stringify({ scope: 'selected', ids: selectedIds }),
                });

                if (res.status === 422) {
                    const data = await res.json().catch(() => ({}));
                    const errs = data.errors ? Object.values(data.errors).flat() : [];
                    toast.error(errs[0] || data.message || 'Could not export.');
                    return;
                }

                if (!res.ok) {
                    toast.error('Export failed.');
                    return;
                }

                const blob = await res.blob();
                const cd = res.headers.get('Content-Disposition');
                let filename = 'product-enquiries-selected.csv';
                const m = cd?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i) || cd?.match(/filename="([^"]+)"/i);
                if (m?.[1]) {
                    filename = decodeURIComponent(m[1].trim());
                }

                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = filename;
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(blobUrl);
                toast.success('CSV downloaded.');
                setExportOpen(false);
            } catch {
                toast.error('Could not download export.');
            } finally {
                setExporting(false);
            }
            return;
        }

        if (exportScope === 'range') {
            if (!dateFrom || !dateTo) {
                toast.error('Please select both from and to dates.');
                return;
            }
            if (dateFrom > dateTo) {
                toast.error('From date must be on or before to date.');
                return;
            }
            if (dateTo > todayMax) {
                toast.error('To date cannot be after today.');
                return;
            }
            if (dateFrom > todayMax) {
                toast.error('From date cannot be after today.');
                return;
            }
        }

        const params = new URLSearchParams({ scope: exportScope });
        if (exportScope === 'range') {
            params.set('date_from', dateFrom);
            params.set('date_to', dateTo);
        }

        const url = `${route('product-enquiries.export')}?${params.toString()}`;
        setExporting(true);
        try {
            const res = await fetch(url, {
                credentials: 'same-origin',
                headers: {
                    Accept: 'text/csv, application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (res.status === 422) {
                const data = await res.json().catch(() => ({}));
                const errs = data.errors ? Object.values(data.errors).flat() : [];
                toast.error(errs[0] || data.message || 'Could not export.');
                return;
            }

            if (!res.ok) {
                toast.error('Export failed.');
                return;
            }

            const blob = await res.blob();
            const cd = res.headers.get('Content-Disposition');
            let filename = `product-enquiries-${exportScope}.csv`;
            const m = cd?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i) || cd?.match(/filename="([^"]+)"/i);
            if (m?.[1]) {
                filename = decodeURIComponent(m[1].trim());
            }

            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
            toast.success('CSV downloaded.');
            setExportOpen(false);
        } catch {
            toast.error('Could not download export.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Product Enquiries
                </h2>
            }
        >
            <Head title="Product Enquiries" />

            <div className="w-full py-6">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <form onSubmit={handleSearch} className="flex max-w-md flex-1 gap-2">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search product, name, store, email, phone…"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        />
                        <button
                            type="submit"
                            className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Search
                        </button>
                    </form>

                    <div className="mb-4 flex flex-wrap items-end gap-3">
                    {selectedIds.length > 0 ? (
                        <>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                            {selectedIds.length} selected
                        </span>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setBulkDeleteOpen(true)}
                                className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                                Delete selected
                            </button>
                            <button
                                type="button"
                                onClick={clearSelection}
                                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                                Clear selection
                            </button>
                        </div>
                        </>
                ) : null}
                    <button
                        type="button"
                        onClick={openExportModal}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 sm:self-start"
                    >
                        <Download className="h-4 w-4" />
                        Export CSV
                    </button>

                    </div>

                </div>

                

                <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {rows.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-slate-400">
                            {filters?.search
                                ? 'No enquiries match your search.'
                                : 'No product enquiries yet.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="w-44 min-w-[11rem] px-2 py-3 text-gray-500 dark:text-slate-400"
                                        >
                                            <div className="grid w-full grid-cols-2 items-stretch gap-2">
                                                <div className="flex items-center justify-center gap-0.5" data-select-menu-root>
                                                    <input
                                                        ref={headerCheckboxRef}
                                                        type="checkbox"
                                                        checked={allPageSelected}
                                                        onChange={toggleSelectCurrentPage}
                                                        disabled={pageRowIds.length === 0}
                                                        className="h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800"
                                                        aria-label="Select all enquiries on this page"
                                                    />
                                                    <button
                                                        ref={selectMenuButtonRef}
                                                        type="button"
                                                        disabled={pageRowIds.length === 0}
                                                        onClick={() => setSelectMenuOpen((o) => !o)}
                                                        className="inline-flex shrink-0 rounded p-1 text-gray-600 hover:bg-gray-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-600"
                                                        aria-label="More selection options"
                                                        aria-expanded={selectMenuOpen}
                                                        aria-haspopup="menu"
                                                    >
                                                        <ChevronDown className="h-4 w-4" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center justify-center text-center text-xs font-semibold uppercase tracking-wide">
                                                    S.No.
                                                </div>
                                            </div>
                                        </th>
                                        {['Product', 'Name', 'Store name', 'Email', 'Phone', 'Notify', 'Submitted', 'Actions'].map((h, i) => (
                                            <th
                                                key={h}
                                                scope="col"
                                                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 ${
                                                    i === 7 ? 'text-right' : 'text-left'
                                                }`}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {rows.map((r, idx) => (
                                        <tr key={r.id} className="hover:bg-gray-50/80 dark:hover:bg-slate-900/30">
                                            <td className="w-44 min-w-[11rem] px-2 py-4">
                                                <div className="grid w-full grid-cols-2 items-center gap-2">
                                                    <div className="flex items-center justify-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.includes(r.id)}
                                                            onChange={() => toggleRowSelected(r.id)}
                                                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800"
                                                            aria-label={`Select enquiry ${r.name}`}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-center text-center text-sm tabular-nums text-gray-500 dark:text-slate-400">
                                                        {serialNumber(enquiries, idx)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-medium text-gray-900 dark:text-slate-100">{r.product_name}</p>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-900 dark:text-slate-100">{r.name}</td>
                                            <td className="max-w-[10rem] truncate px-4 py-4 text-sm text-gray-900 dark:text-slate-100">
                                                {r.store_name?.trim() ? r.store_name : '—'}
                                            </td>
                                            <td className="max-w-[12rem] truncate px-4 py-4 text-sm text-gray-600 dark:text-slate-300">
                                                {r.email}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600 dark:text-slate-300">
                                                {r.phone}
                                            </td>
                                            <td className="max-w-[9rem] px-4 py-4 text-sm">
                                                <span
                                                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${notifyStatusBadgeClass(r)}`}
                                                >
                                                    {notifyStatusLabel(r)}
                                                </span>
                                                {r.notification_status === 'failed' && r.notification_error ? (
                                                    <p
                                                        className="mt-1 line-clamp-2 text-xs text-red-600 dark:text-red-400"
                                                        title={r.notification_error}
                                                    >
                                                        {r.notification_error}
                                                    </p>
                                                ) : null}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-sm tabular-nums text-gray-600 dark:text-slate-300">
                                                {formatDate(r.created_at)}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right">
                                                <div className="flex flex-wrap justify-end gap-2">
                                                    {hasProductNotifyEmail(r) && r.notification_status !== 'sent' ? (
                                                        <button
                                                            type="button"
                                                            disabled={resendingId === r.id}
                                                            onClick={() => resendNotification(r.id)}
                                                            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                            title="Queue notification email again"
                                                        >
                                                            <Mail className="h-4 w-4" />
                                                            {resendingId === r.id ? 'Sending…' : 'Send'}
                                                        </button>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewRow(r)}
                                                        className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        View
                                                    </button>
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

                {rows.length > 0 && enquiries?.total != null && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-sm text-gray-700 dark:text-slate-300">
                            Showing <span className="font-medium">{enquiries.from}</span> to{' '}
                            <span className="font-medium">{enquiries.to}</span> of{' '}
                            <span className="font-medium">{enquiries.total}</span>
                        </p>
                        {enquiries.last_page > 1 && (
                            <div className="flex flex-wrap gap-1">
                                {enquiries.links.map((link, i) => (
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

            <Modal show={!!viewRow} onClose={() => setViewRow(null)} maxWidth="lg">
                {viewRow && <DetailModal row={viewRow} onClose={() => setViewRow(null)} />}
            </Modal>

            <Modal show={exportOpen} onClose={closeExportModal} maxWidth="md">
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Export enquiries</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                        Download a CSV of submissions. Date range cannot extend past today.
                    </p>

                    <fieldset className="mt-6 space-y-3">
                        <legend className="sr-only">Export scope</legend>
                        {selectedIds.length > 0 ? (
                            <label
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 dark:border-slate-600 ${
                                    exportScope === 'selected'
                                        ? 'border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/30'
                                        : 'border-gray-200'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="export-scope"
                                    value="selected"
                                    checked={exportScope === 'selected'}
                                    onChange={() => setExportScope('selected')}
                                    className="mt-1 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span>
                                    <span className="block text-sm font-medium text-gray-900 dark:text-slate-100">
                                        Export selected — {selectedIds.length}{' '}
                                        {selectedIds.length === 1 ? 'record' : 'records'}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-slate-400">
                                        Only the enquiries whose rows are checked on this page (and any other pages
                                        where you selected rows).
                                    </span>
                                </span>
                            </label>
                        ) : null}
                        <label
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 dark:border-slate-600 ${
                                exportScope === 'all'
                                    ? 'border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/30'
                                    : 'border-gray-200'
                            }`}
                        >
                            <input
                                type="radio"
                                name="export-scope"
                                value="all"
                                checked={exportScope === 'all'}
                                onChange={() => setExportScope('all')}
                                className="mt-1 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>
                                <span className="block text-sm font-medium text-gray-900 dark:text-slate-100">
                                    Export all — {enquiriesExportAllCount}{' '}
                                    {enquiriesExportAllCount === 1 ? 'record' : 'records'}
                                </span>
                                <span className="mt-0.5 block text-xs text-gray-500 dark:text-slate-400">
                                    Every enquiry in the database (not limited to the search filter or current page).
                                </span>
                            </span>
                        </label>
                        <label
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 dark:border-slate-600 ${
                                exportScope === 'range'
                                    ? 'border-indigo-400 bg-indigo-50/50 dark:border-indigo-600 dark:bg-indigo-950/30'
                                    : 'border-gray-200'
                            }`}
                        >
                            <input
                                type="radio"
                                name="export-scope"
                                value="range"
                                checked={exportScope === 'range'}
                                onChange={() => setExportScope('range')}
                                className="mt-1 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>
                                <span className="block text-sm font-medium text-gray-900 dark:text-slate-100">Date range</span>
                                <span className="mt-0.5 block text-xs text-gray-500 dark:text-slate-400">
                                    Only rows submitted between the two dates (inclusive).
                                </span>
                            </span>
                        </label>
                    </fieldset>

                    {exportScope === 'range' ? (
                        <div className="mt-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="export-date-from" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                                        From
                                    </label>
                                    <input
                                        id="export-date-from"
                                        type="date"
                                        value={dateFrom}
                                        max={todayMax}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="export-date-to" className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                                        To
                                    </label>
                                    <input
                                        id="export-date-to"
                                        type="date"
                                        value={dateTo}
                                        max={todayMax}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                    />
                                </div>
                            </div>
                            <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
                                {rangeCountLoading ? (
                                    <span className="tabular-nums">Loading count…</span>
                                ) : rangeCount !== null ? (
                                    <span className="tabular-nums">
                                        ({rangeCount} {rangeCount === 1 ? 'record' : 'records'} selected)
                                    </span>
                                ) : dateFrom && dateTo && (dateFrom > dateTo || dateTo > todayMax || dateFrom > todayMax) ? (
                                    <span className="text-amber-800 dark:text-amber-300">
                                        Fix the date range to see how many records match.
                                    </span>
                                ) : dateFrom || dateTo ? (
                                    <span>Select both dates to see the count.</span>
                                ) : (
                                    <span>Select from and to dates.</span>
                                )}
                            </p>
                        </div>
                    ) : null}

                    <div className="mt-8 flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={closeExportModal}
                            disabled={exporting}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                        <PrimaryButton type="button" disabled={exporting} onClick={runExport}>
                            {exporting ? 'Exporting…' : 'Export CSV'}
                        </PrimaryButton>
                    </div>
                </div>
            </Modal>

            <Modal show={bulkDeleteOpen} onClose={() => !bulkDeleting && setBulkDeleteOpen(false)} maxWidth="sm">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Delete selected enquiries</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        Permanently delete <span className="font-semibold text-gray-900 dark:text-slate-100">{selectedIds.length}</span>{' '}
                        {selectedIds.length === 1 ? 'submission' : 'submissions'}. This cannot be undone.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            disabled={bulkDeleting}
                            onClick={() => setBulkDeleteOpen(false)}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                        <DangerButton disabled={bulkDeleting} onClick={confirmBulkDelete}>
                            {bulkDeleting ? 'Deleting…' : 'Delete'}
                        </DangerButton>
                    </div>
                </div>
            </Modal>

            <Modal show={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="sm">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Delete enquiry</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        This permanently removes this submission. This cannot be undone.
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

            {selectMenuOpen && selectMenuPosition
                ? createPortal(
                      <div
                          data-select-menu-portal
                          role="menu"
                          className="fixed z-[9999] w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800"
                          style={{ top: selectMenuPosition.top, left: selectMenuPosition.left }}
                      >
                          <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
                              onClick={() => {
                                  selectAllOnPageOnly();
                                  setSelectMenuOpen(false);
                              }}
                          >
                              Select all on this page
                          </button>
                          <button
                              type="button"
                              role="menuitem"
                              disabled={selectAllMatchingLoading}
                              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                              onClick={() => {
                                  void selectAllMatchingFilter();
                              }}
                          >
                              {selectAllMatchingLoading
                                  ? 'Loading…'
                                  : filters?.search
                                    ? 'Select all matching search'
                                    : 'Select all enquiries'}
                          </button>
                          <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
                              onClick={() => {
                                  clearSelection();
                                  setSelectMenuOpen(false);
                              }}
                          >
                              Clear selection
                          </button>
                      </div>,
                      document.body,
                  )
                : null}
        </AuthenticatedLayout>
    );
}
