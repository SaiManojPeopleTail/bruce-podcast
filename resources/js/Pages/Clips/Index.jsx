import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function Index({ episode, clips, filters }) {
    const { flash } = usePage().props;
    const [deleteId, setDeleteId] = useState(null);
    const [search, setSearch] = useState(filters?.search ?? '');
    const [openMenuId, setOpenMenuId] = useState(null);

    useEffect(() => {
        const onDocClick = (event) => {
            if (!event.target.closest('[data-actions-menu]')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('click', onDocClick);
        return () => document.removeEventListener('click', onDocClick);
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        router.get(route('episodes.clips.index', episode.id), { search: search || undefined }, { preserveState: true });
    };

    const confirmDelete = () => {
        if (!deleteId) return;
        router.delete(route('episodes.clips.destroy', [episode.id, deleteId]), {
            preserveScroll: true,
            onSuccess: () => setDeleteId(null),
        });
    };

    const clipList = clips.data || [];

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">{episode.title} Videos</h2>}
        >
            <Head title={`${episode.title} Videos`} />

            <div className="w-full py-6">
                {flash?.success && (
                    <div className="mb-4 rounded-md bg-green-100 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">{flash.success}</div>
                )}
                {flash?.error && (
                    <div className="mb-4 rounded-md bg-red-100 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">{flash.error}</div>
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
                    <div className="flex gap-2">
                        <Link
                            href={route('episodes.index')}
                            className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to episodes
                        </Link>
                        <Link href={route('episodes.clips.create', episode.id)}>
                            <PrimaryButton>Add Clip</PrimaryButton>
                        </Link>
                    </div>
                </div>

                <div className="overflow-visible rounded-lg bg-white shadow dark:bg-slate-800">
                    {clipList.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-slate-400">
                            {filters?.search ? 'No clips match your search.' : 'No clips yet. Upload the first one.'}
                        </div>
                    ) : (
                        <ul className="overflow-visible divide-y divide-gray-200 dark:divide-slate-700">
                            {clipList.map((clip) => (
                                <li key={clip.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
                                    <div className="h-24 w-full shrink-0 overflow-hidden rounded-lg bg-gray-200 sm:h-20 sm:w-36 dark:bg-slate-700">
                                        {clip.thumbnail_url ? <img src={clip.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-gray-400">No thumbnail</div>}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-gray-900 dark:text-slate-100">{clip.title}</p>
                                        <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-slate-400">{clip.slug} · {new Date(clip.created_at).toLocaleDateString()}</p>
                                        {clip.short_description && <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-slate-400">{clip.short_description}</p>}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => router.patch(route('episodes.clips.toggle-status', [episode.id, clip.id]), {}, { preserveScroll: true })}
                                            className={`inline-flex h-8 w-14 items-center rounded-full p-1 transition ${clip.status ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                                            aria-label={`Toggle status for ${clip.title}`}
                                        >
                                            <span className={`h-6 w-6 rounded-full bg-white shadow transition-transform ${clip.status ? 'translate-x-6' : 'translate-x-0'}`} />
                                        </button>
                                        <Link
                                            href={route('episodes.clips.edit', [episode.id, clip.id])}
                                            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                        >
                                            Edit
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => setDeleteId(clip.id)}
                                            className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                        >
                                            Delete
                                        </button>
                                        <div className="relative" data-actions-menu>
                                            <button
                                                type="button"
                                                onClick={() => setOpenMenuId((id) => (id === clip.id ? null : clip.id))}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                                aria-label={`More actions for ${clip.title}`}
                                            >
                                                <span className="text-lg leading-none">⋯</span>
                                            </button>
                                            {openMenuId === clip.id && (
                                                <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-gray-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                                                    {clip.status ? (
                                                        <a
                                                            href={route('episode-clip-show', { slug: clip.slug })}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
                                                        >
                                                            Live link
                                                        </a>
                                                    ) : (
                                                        <span className="block cursor-not-allowed rounded-md px-3 py-2 text-sm text-gray-400 dark:text-slate-500">
                                                            Live link (status off)
                                                        </span>
                                                    )}
                                                    <a
                                                        href={route('preview.clip', clip.id)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-slate-200 dark:hover:bg-slate-700"
                                                    >
                                                        Preview draft link
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <Modal show={!!deleteId} onClose={() => setDeleteId(null)} maxWidth="sm">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">Delete clip</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">This deletes from Bunny first, then local database.</p>
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
