import { useReduceMotion } from '@/hooks/useReduceMotion';
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
    const reduceMotion = useReduceMotion();
    const Card = reduceMotion ? 'div' : motion.div;
    const items = useMemo(() => normalizePeople(people), [people]);
    const [current, setCurrent] = useState(0);
    const [isInView, setIsInView] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileControlsVisible, setMobileControlsVisible] = useState(true);

    const sectionRef = useRef(null);
    const centerVideoRef = useRef(null);
    const touchStartRef = useRef({ x: 0, y: 0 });
    const controlsTimeoutRef = useRef(null);

    const SWIPE_THRESHOLD = 50;
    const CONTROLS_VISIBLE_MS = 2500;

    const showControlsAndScheduleHide = () => {
        setMobileControlsVisible(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            setMobileControlsVisible(false);
            controlsTimeoutRef.current = null;
        }, CONTROLS_VISIBLE_MS);
    };

    const handleTouchStart = (e) => {
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY };
    };

    const handleTouchEnd = (e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartRef.current.x;
        const dy = t.clientY - touchStartRef.current.y;
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) >= Math.abs(dy)) {
            if (dx < 0) next();
            else prev();
            return;
        }
        if (isMobile) showControlsAndScheduleHide();
    };

    const handleVideoBlockClick = () => {
        if (isMobile) showControlsAndScheduleHide();
    };

    const indexById = useMemo(() => {
        const map = new Map();
        items.forEach((item, index) => map.set(item.id, index));
        return map;
    }, [items]);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        if (!isMobile) return;
        const t = setTimeout(() => setMobileControlsVisible(false), CONTROLS_VISIBLE_MS);
        return () => clearTimeout(t);
    }, [isMobile]);

    useEffect(() => {
        return () => {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        };
    }, []);

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
    const cardProps = (slotName, item) =>
        reduceMotion ? {} : { layoutId: getLayoutId(slotName, item, len), transition: { type: 'spring', stiffness: 260, damping: 28 } };
    const arrowClass =
        'inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 transition-colors';

    return (
        <div ref={sectionRef} className={className}>
            <LayoutGroup>
                {/* Mobile: show only center card. Desktop (md+): show all three */}
                <div className="flex flex-col md:grid md:grid-cols-[1fr_1.4fr_1fr] items-center gap-4">
                    {/* Left - only on md+ */}
                    <div className="hidden md:block order-2 md:order-1">
                        <button
                            type="button"
                            onClick={() => goTo(slots.left.id)}
                            className="relative w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm text-left"
                            aria-label={`Show ${slots.left.name}`}
                        >
                            <Card {...cardProps('left', slots.left)}>
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
                            </Card>
                        </button>
                    </div>

                    {/* Center - always visible; swipe left/right on mobile to change; tap to show controls */}
                    <div
                        className="order-1 md:order-2 group relative overflow-hidden rounded-xl border border-amber-300 shadow-md w-full touch-pan-y"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                        onClick={handleVideoBlockClick}
                    >
                        <Card {...cardProps('center', slots.center)}>
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
                        </Card>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsPlaying((v) => !v); }}
                            className={`absolute inset-0 m-auto h-12 w-12 rounded-full bg-black/55 text-white flex items-center justify-center transition-opacity duration-200 ${isMobile ? (mobileControlsVisible ? 'opacity-100' : 'opacity-0') : 'opacity-0 md:opacity-0 md:group-hover:opacity-100'}`}
                            aria-label={isPlaying ? 'Pause video' : 'Play video'}
                        >
                            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsMuted((v) => !v); }}
                            className={`absolute right-3 top-3 h-9 w-9 rounded-full bg-black/55 text-white flex items-center justify-center transition-opacity duration-200 ${isMobile ? (mobileControlsVisible ? 'opacity-100' : 'opacity-0') : 'opacity-0 md:opacity-0 md:group-hover:opacity-100'}`}
                            aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                        >
                            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </button>
                        <div
                            className={`pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 transition-opacity duration-200 ${isMobile ? (mobileControlsVisible ? 'opacity-100' : 'opacity-0') : 'opacity-0 md:opacity-0 md:group-hover:opacity-100'}`}
                        >
                            <p className="text-base font-bold text-white">{slots.center.name}</p>
                        </div>
                    </div>

                    {/* Right - only on md+ */}
                    <div className="hidden md:block order-3">
                        <button
                            type="button"
                            onClick={() => goTo(slots.right.id)}
                            className="relative w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm text-left"
                            aria-label={`Show ${slots.right.name}`}
                        >
                            <Card {...cardProps('right', slots.right)}>
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
                            </Card>
                        </button>
                    </div>
                </div>
            </LayoutGroup>

            {/* Navigation arrows - always show, but you could hide on mobile if UX prefers */}
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
