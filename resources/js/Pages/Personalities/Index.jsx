import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function Index({ personalities, filters }) {
    const { flash } = usePage().props;
    const [deleteId, setDeleteId] = useState(null);
    const [search, setSearch] = useState(filters?.search ?? '');

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('personalities.index'), { search: search || undefined }, { preserveState: true });
    };

    const confirmDelete = () => {
        if (!deleteId) return;
        router.delete(route('personalities.destroy', deleteId), {
            preserveScroll: true,
            onSuccess: () => setDeleteId(null),
        });
    };

    const list = personalities.data || [];

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">Personalities</h2>}>
            <Head title="Personalities" />

            <div className="w-full py-6">
                {flash?.success && (
                    <div className="mb-4 rounded-md bg-green-100 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {flash.success}
                    </div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-md bg-red-100 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {flash.error}
                    </div>
                )}

                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <form onSubmit={handleSearch} className="flex flex-1 gap-2 sm:max-w-md">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search personalities..."
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        />
                        <button
                            type="submit"
                            className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Search
                        </button>
                    </form>
                    <Link href={route('personalities.create')}>
                        <PrimaryButton>Add personality</PrimaryButton>
                    </Link>
                </div>

                <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
                    {list.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-slate-400">
                            {filters?.search ? 'No personalities match your search.' : 'No personalities yet. Create your first one.'}
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-200 dark:divide-slate-700">
                            {list.map((personality) => (
                                <li key={personality.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
                                    <div className="h-24 w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-20 sm:w-36 dark:bg-slate-700">
                                        {personality.video_url ? (
                                            <video src={personality.video_url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                                        ) : (
                                            <div className="flex h-full items-center justify-center text-sm text-gray-400">No video</div>
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-gray-900 dark:text-slate-100">{personality.name}</p>
                                        <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{personality.status ? 'Active' : 'Inactive'}</p>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => router.patch(route('personalities.toggle-status', personality.id), {}, { preserveScroll: true })}
                                            className={`inline-flex h-8 w-14 items-center rounded-full p-1 transition ${personality.status ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                                            aria-label={`Toggle status for ${personality.name}`}
                                        >
                                            <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${personality.status ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                        <Link
                                            href={route('personalities.edit', personality.id)}
                                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                        >
                                            Edit
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => setDeleteId(personality.id)}
                                            className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <Modal show={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="sm">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Delete personality</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">This also deletes the uploaded S3 video.</p>
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
