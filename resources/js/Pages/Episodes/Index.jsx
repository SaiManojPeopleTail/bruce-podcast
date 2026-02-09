import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import { getYouTubeThumbnail } from '@/utils/youtube';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function Index({ episodes, filters }) {
    const { flash } = usePage().props;
    const [deleteId, setDeleteId] = useState(null);
    const [search, setSearch] = useState(filters?.search ?? '');

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('episodes.index'), { search: search || undefined }, { preserveState: true });
    };

    const handleDelete = (id) => {
        setDeleteId(id);
    };

    const confirmDelete = () => {
        if (deleteId) {
            router.delete(route('episodes.destroy', deleteId), {
                preserveScroll: true,
                onSuccess: () => setDeleteId(null),
            });
        }
    };

    const episodeList = episodes.data || [];
    const pagination = episodes;

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Episodes
                </h2>
            }
        >
            <Head title="Episodes" />

            <div className="w-full py-6">
                {flash?.success && (
                    <div className="mb-4 rounded-md bg-green-100 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {flash.success}
                    </div>
                )}

                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <form onSubmit={handleSearch} className="flex flex-1 gap-2 sm:max-w-md">
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by title, slug, or description..."
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                        />
                        <button
                            type="submit"
                            className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Search
                        </button>
                    </form>
                    <Link href={route('episodes.create')}>
                        <PrimaryButton>Add episode</PrimaryButton>
                    </Link>
                </div>

                <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
                    {episodeList.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-slate-400">
                            {filters?.search
                                ? 'No episodes match your search.'
                                : 'No episodes yet. Create your first episode to get started.'}
                        </div>
                    ) : (
                        <>
                            <ul className="divide-y divide-gray-200 dark:divide-slate-700">
                                {episodeList.map((episode) => (
                                    <li
                                        key={episode.id}
                                        className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6"
                                    >
                                        <div className="h-24 w-full shrink-0 overflow-hidden rounded-lg bg-gray-200 sm:h-20 sm:w-36 dark:bg-slate-700">
                                            {episode.video_url ? (
                                                <img
                                                    src={getYouTubeThumbnail(episode.video_url)}
                                                    alt=""
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center text-gray-400">
                                                    <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium text-gray-900 dark:text-slate-100">
                                                {episode.title}
                                            </p>
                                            <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-slate-400">
                                                {episode.slug} · {new Date(episode.created_at).toLocaleDateString()}
                                            </p>
                                            {episode.short_description && (
                                                <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-slate-400">
                                                    {episode.short_description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <Link
                                                href={route('episodes.edit', episode.id)}
                                                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                            >
                                                Edit
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(episode.id)}
                                                className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            {pagination.last_page > 1 && (
                                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-3 dark:border-slate-700 sm:px-6">
                                    <p className="text-sm text-gray-700 dark:text-slate-300">
                                        Showing{' '}
                                        <span className="font-medium">{pagination.from}</span> to{' '}
                                        <span className="font-medium">{pagination.to}</span> of{' '}
                                        <span className="font-medium">{pagination.total}</span> episodes
                                    </p>
                                    <div className="flex gap-1">
                                        {pagination.links.map((link) => (
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
                        </>
                    )}
                </div>
            </div>

            <Modal show={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="sm">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                        Delete episode
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        Are you sure you want to delete this episode? This action cannot be undone.
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
