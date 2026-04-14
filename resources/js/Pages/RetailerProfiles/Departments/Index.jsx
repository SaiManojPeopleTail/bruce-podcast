import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

function serialNumber(paginator, index) {
    if (paginator?.from != null) {
        return paginator.from + index;
    }
    const page = Number(paginator?.current_page ?? 1);
    const perPage = Number(paginator?.per_page ?? 15);
    return (page - 1) * perPage + index + 1;
}

export default function Index({ departments, filters }) {
    const [deleteId, setDeleteId] = useState(null);
    const [search, setSearch] = useState(filters?.search ?? '');

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('retailer-profiles.departments.index'), { search: search || undefined }, { preserveState: true });
    };

    const confirmDelete = () => {
        if (!deleteId) return;
        router.delete(route('retailer-profiles.departments.destroy', deleteId), {
            preserveScroll: true,
            onSuccess: () => setDeleteId(null),
        });
    };

    const rows = departments?.data ?? [];

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Manage departments
                </h2>
            }
        >
            <Head title="Departments" />

            <div className="w-full py-6">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <form onSubmit={handleSearch} className="flex flex-1 gap-2 sm:max-w-md">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search departments..."
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        />
                        <button
                            type="submit"
                            className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Search
                        </button>
                    </form>
                    <Link href={route('retailer-profiles.departments.create')}>
                        <PrimaryButton>Add department</PrimaryButton>
                    </Link>
                </div>

                <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
                    {rows.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-slate-400">
                            {filters?.search ? 'No departments match your search.' : 'No departments yet. Add your first department.'}
                        </div>
                    ) : (
                        <>
                        <div className="hidden border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-900/50 sm:block sm:px-6">
                            <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                <span className="w-10 text-right">S.No.</span>
                                <span className="min-w-0 flex-1">Department</span>
                                <span className="w-0 flex-1 sm:w-auto" aria-hidden />
                            </div>
                        </div>
                        <ul className="divide-y divide-gray-200 dark:divide-slate-700">
                            {rows.map((dept, index) => (
                                <li
                                    key={dept.id}
                                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6"
                                >
                                    <div className="flex min-w-0 gap-3 sm:gap-4">
                                        <span
                                            className="w-10 shrink-0 pt-0.5 text-right text-sm font-medium tabular-nums text-gray-400 dark:text-slate-500"
                                            aria-hidden
                                        >
                                            {serialNumber(departments, index)}
                                        </span>
                                        <div className="min-w-0">
                                        <p className="font-medium text-gray-900 dark:text-white">{dept.name}</p>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                                            {dept.retailer_profiles_count ?? 0} retailer profile(s)
                                        </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 gap-2 sm:pt-0.5">
                                        <Link
                                            href={route('retailer-profiles.departments.edit', dept.id)}
                                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                        >
                                            Edit
                                        </Link>
                                        <DangerButton type="button" onClick={() => setDeleteId(dept.id)}>
                                            Delete
                                        </DangerButton>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        </>
                    )}
                </div>

                {departments?.last_page > 1 && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-sm text-gray-700 dark:text-slate-300">
                            Showing{' '}
                            <span className="font-medium">{departments.from}</span> to{' '}
                            <span className="font-medium">{departments.to}</span> of{' '}
                            <span className="font-medium">{departments.total}</span>
                        </p>
                        <div className="flex flex-wrap gap-1">
                            {departments.links.map((link) => (
                                <span key={link.label}>
                                    {link.url ? (
                                        <Link
                                            href={link.url}
                                            className={`inline-flex items-center rounded-md border px-3 py-1 text-sm ${
                                                link.active
                                                    ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-600 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                            }`}
                                        >
                                            {link.label.replace('&laquo; Previous', 'Previous').replace('Next &raquo;', 'Next')}
                                        </Link>
                                    ) : (
                                        <span className="inline-flex cursor-default items-center rounded-md border border-gray-200 bg-gray-100 px-3 py-1 text-sm text-gray-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-500">
                                            {link.label.replace('&laquo; ', '').replace(' &raquo;', '')}
                                        </span>
                                    )}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <Modal show={deleteId !== null} onClose={() => setDeleteId(null)}>
                <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Delete department</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        This cannot be undone. Departments in use by retailer profiles cannot be deleted until those profiles are removed or reassigned.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setDeleteId(null)}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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
