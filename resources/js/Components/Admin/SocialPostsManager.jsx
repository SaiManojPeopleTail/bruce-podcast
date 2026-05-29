import { SortableDndItem, SortableDndProvider } from '@/Components/Admin/SortableDnd';
import { ExternalLink, GripVertical, Instagram, Linkedin, Trash2 } from 'lucide-react';

function Toggle({ checked, onChange }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                checked ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'
            }`}
        >
            <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-150 ${
                    checked ? 'translate-x-4' : 'translate-x-0'
                }`}
            />
        </button>
    );
}

function PlatformBadge({ platform }) {
    const isInstagram = platform === 'instagram';
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isInstagram
                ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-200'
                : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200'
        }`}>
            {isInstagram
                ? <Instagram className="h-2.5 w-2.5" />
                : <Linkedin className="h-2.5 w-2.5" />
            }
            {platform}
        </span>
    );
}

function postSortId(post, index) {
    return post.post_url || `post-${index}`;
}

function PostCard({ post, index, onToggle, onRemove, overlay = false }) {
    return (
        <div
            className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all ${
                overlay
                    ? 'scale-[1.03] border-indigo-300 bg-white shadow-xl ring-2 ring-indigo-400 dark:border-indigo-500 dark:bg-slate-700'
                    : `cursor-grab active:cursor-grabbing ${
                        post.active
                            ? 'border-gray-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-700'
                            : 'border-dashed border-gray-200 bg-gray-50 opacity-50 dark:border-slate-700 dark:bg-slate-800'
                    }`
            }`}
        >
            {!overlay && (
                <div className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
                    <GripVertical className="h-3.5 w-3.5" />
                </div>
            )}

            <div className="relative aspect-square w-full overflow-hidden bg-gray-100 dark:bg-slate-700">
                {post.image_url ? (
                    <img
                        src={post.image_url}
                        alt={post.description || post.platform}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        draggable={false}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        {post.platform === 'instagram'
                            ? <Instagram className="h-8 w-8 text-gray-300 dark:text-slate-600" />
                            : <Linkedin className="h-8 w-8 text-gray-300 dark:text-slate-600" />
                        }
                    </div>
                )}

                <div className="absolute left-2 top-10">
                    <PlatformBadge platform={post.platform} />
                </div>

                {!overlay && (
                    <a
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                        <ExternalLink className="h-3 w-3" />
                    </a>
                )}
            </div>

            {post.description && (
                <p className="line-clamp-2 px-2.5 py-2 text-[11px] leading-snug text-gray-600 dark:text-slate-300">
                    {post.description}
                </p>
            )}

            {!overlay && (
                <div className="flex items-center justify-between border-t border-gray-100 px-2.5 py-2 dark:border-slate-600">
                    <div onPointerDown={(e) => e.stopPropagation()}>
                        <Toggle checked={post.active} onChange={() => onToggle(index)} />
                    </div>
                    <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onRemove(index)}
                        className="rounded p-0.5 text-red-300 transition hover:text-red-600 dark:text-red-800 dark:hover:text-red-400"
                        aria-label="Remove post"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * posts: Array<{ platform, post_url, description, active, image_url? }>
 * onChange: (posts) => void
 */
export default function SocialPostsManager({ posts, onChange }) {
    if (!posts || posts.length === 0) return null;

    const toggle = (index) =>
        onChange(posts.map((p, i) => i === index ? { ...p, active: !p.active } : p));

    const remove = (index) =>
        onChange(posts.filter((_, i) => i !== index));

    const activeCount = posts.filter((p) => p.active).length;

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-600 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Social posts
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">Drag to reorder — order is used on the public page</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-slate-700 dark:text-slate-400">
                    {activeCount} / {posts.length} active
                </span>
            </div>

            <SortableDndProvider
                items={posts}
                getId={postSortId}
                onReorder={onChange}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                renderOverlay={(post) => {
                    const index = posts.findIndex((p) => postSortId(p) === postSortId(post));
                    return <PostCard post={post} index={index} overlay />;
                }}
            >
                {posts.map((post, index) => (
                    <SortableDndItem key={postSortId(post, index)} id={postSortId(post, index)}>
                        <PostCard
                            post={post}
                            index={index}
                            onToggle={toggle}
                            onRemove={remove}
                        />
                    </SortableDndItem>
                ))}
            </SortableDndProvider>
        </div>
    );
}
