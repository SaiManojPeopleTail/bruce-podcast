import { Film, GripVertical, X } from 'lucide-react';
import { SortableDndItem, SortableDndProvider } from '@/Components/Admin/SortableDnd';

function MediaThumb({ item }) {
    const src = item.previewUrl;
    const isVideo = item.mediaType === 'video';

    if (isVideo) {
        return (
            <>
                <video src={src} muted preload="metadata" className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55">
                        <Film className="h-4 w-4 text-white" />
                    </div>
                </div>
            </>
        );
    }

    return <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />;
}

function MediaTile({ item, onRemove, index, overlay = false }) {
    return (
        <div
            className={`group relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm dark:border-slate-600 dark:bg-slate-700 ${
                overlay ? 'scale-105 shadow-lg ring-2 ring-indigo-400' : 'cursor-grab active:cursor-grabbing'
            }`}
        >
            <MediaThumb item={item} />

            {!overlay && (
                <>
                    <div className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-black/45 text-white opacity-0 transition group-hover:opacity-100">
                        <GripVertical className="h-3 w-3" />
                    </div>

                    {item.badge === 'new' && (
                        <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/70 py-0.5 text-center text-[9px] text-white">new</span>
                    )}
                    {item.badge === 'shopify' && (
                        <span className="absolute bottom-0 left-0 right-0 bg-emerald-600/70 py-0.5 text-center text-[9px] text-white">shopify</span>
                    )}

                    <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onRemove(index)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Remove"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </>
            )}
        </div>
    );
}

/**
 * @param {{ items: Array, onChange: Function, onRemove: Function, className?: string }} props
 */
export default function SortableMediaGrid({ items, onChange, onRemove, className = '' }) {
    if (!items.length) return null;

    return (
        <SortableDndProvider
            items={items}
            getId={(item) => item.id}
            onReorder={onChange}
            className={`mb-3 flex flex-wrap gap-3 ${className}`}
            renderOverlay={(item) => <MediaTile item={item} overlay />}
        >
            {items.map((item, index) => (
                <SortableDndItem key={item.id} id={item.id}>
                    <MediaTile item={item} onRemove={onRemove} index={index} />
                </SortableDndItem>
            ))}
        </SortableDndProvider>
    );
}
