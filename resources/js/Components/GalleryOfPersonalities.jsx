import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { LayoutGroup, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

function normalizePeople(people) {
    return (Array.isArray(people) ? people : []).filter((p) => p?.video_url && p?.name);
}

function buildSlots(items, current) {
    const len = items.length;
    if (!len) return { left: null, center: null, right: null };

    const center = items[current];

    if (len === 1) {
        return { left: center, center, right: center };
    }

    if (len === 2) {
        const other = items[(current + 1) % len];
        return { left: other, center, right: other };
    }

    return {
        left: items[(current - 1 + len) % len],
        center,
        right: items[(current + 1) % len],
    };
}

function getLayoutId(slotName, item, len) {
    if (!item) return undefined;
    if (len >= 3) return `personality-card-${item.id}`;
    return `personality-card-${slotName}-${item.id}`;
}

export default function GalleryOfPersonalities({ people = [], className = '' }) {
    const items = useMemo(() => normalizePeople(people), [people]);
    const [current, setCurrent] = useState(0);
    const [isInView, setIsInView] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);

    const sectionRef = useRef(null);
    const centerVideoRef = useRef(null);

    const indexById = useMemo(() => {
        const map = new Map();
        items.forEach((item, index) => map.set(item.id, index));
        return map;
    }, [items]);

    useEffect(() => {
        if (!items.length) {
            setCurrent(0);
            return;
        }
        setCurrent((prev) => (prev >= items.length ? 0 : prev));
    }, [items.length]);

    useEffect(() => {
        const el = sectionRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => setIsInView(entry.isIntersecting && entry.intersectionRatio >= 0.45),
            { threshold: [0, 0.45, 0.75, 1] }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const video = centerVideoRef.current;
        if (!video) return;

        if (isInView && isPlaying) {
            video.play().catch(() => {});
            return;
        }

        video.pause();
    }, [current, isInView, isPlaying]);

    useEffect(() => {
        const video = centerVideoRef.current;
        if (!video) return;
        video.muted = isMuted;
    }, [isMuted, current]);

    if (!items.length) {
        return (
            <div className={className}>
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center text-sm text-gray-600">
                    No personalities available yet.
                </div>
            </div>
        );
    }

    const len = items.length;
    const prev = () => setCurrent((i) => (i - 1 + len) % len);
    const next = () => setCurrent((i) => (i + 1) % len);
    const goTo = (id) => {
        const idx = indexById.get(id);
        if (typeof idx === 'number') setCurrent(idx);
    };

    const slots = buildSlots(items, current);
    const arrowClass =
        'inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 transition-colors';

    return (
        <div ref={sectionRef} className={className}>
            <LayoutGroup>
                <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[1fr_1.4fr_1fr]">
                    <div className="order-2 md:order-1">
                        <button
                            type="button"
                            onClick={() => goTo(slots.left.id)}
                            className="relative w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm text-left"
                            aria-label={`Show ${slots.left.name}`}
                        >
                            <motion.div
                                layoutId={getLayoutId('left', slots.left, len)}
                                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                            >
                                <video
                                    src={slots.left.video_url}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="h-40 w-full object-cover pointer-events-none"
                                    aria-hidden
                                />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 py-2">
                                    <p className="text-sm font-semibold text-white">{slots.left.name}</p>
                                </div>
                            </motion.div>
                        </button>
                    </div>

                    <div className="order-1 md:order-2 group relative overflow-hidden rounded-xl border border-amber-300 shadow-md">
                        <motion.div
                            layoutId={getLayoutId('center', slots.center, len)}
                            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                        >
                            <video
                                key={slots.center.id}
                                ref={centerVideoRef}
                                src={slots.center.video_url}
                                muted
                                loop
                                playsInline
                                preload="metadata"
                                className="h-48 md:h-64 w-full object-cover"
                            />
                        </motion.div>
                        <button
                            type="button"
                            onClick={() => setIsPlaying((v) => !v)}
                            className="absolute inset-0 m-auto h-12 w-12 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            aria-label={isPlaying ? 'Pause video' : 'Play video'}
                        >
                            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsMuted((v) => !v)}
                            className="absolute right-3 top-3 h-9 w-9 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                        >
                            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </button>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <p className="text-base font-bold text-white">{slots.center.name}</p>
                        </div>
                    </div>

                    <div className="order-3">
                        <button
                            type="button"
                            onClick={() => goTo(slots.right.id)}
                            className="relative w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm text-left"
                            aria-label={`Show ${slots.right.name}`}
                        >
                            <motion.div
                                layoutId={getLayoutId('right', slots.right, len)}
                                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                            >
                                <video
                                    src={slots.right.video_url}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="h-40 w-full object-cover pointer-events-none"
                                    aria-hidden
                                />
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 py-2">
                                    <p className="text-sm font-semibold text-white">{slots.right.name}</p>
                                </div>
                            </motion.div>
                        </button>
                    </div>
                </div>
            </LayoutGroup>

            <div className="mt-4 flex items-center justify-center gap-3">
                <button type="button" onClick={prev} className={arrowClass} aria-label="Previous personality">
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <button type="button" onClick={next} className={arrowClass} aria-label="Next personality">
                    <ChevronRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}
