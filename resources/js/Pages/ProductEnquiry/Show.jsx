import AiConcierge from '@/Components/AiConcierge';
import HeroNav from '@/Components/HeroNav';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, ExternalLink, Film, ImageIcon, Mail, Phone, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const VIDEO_THUMB_TIME = 4;

function isVideoUrl(url) {
    if (!url) return false;
    const path = url.split('?')[0].toLowerCase();
    return /\.(mp4|mov|avi|webm|mkv|m4v|ogv)(\b|$)/.test(path);
}

function GalleryVideoThumb({ src, className }) {
    const seekDone = useRef(false);

    const trySeek = (e) => {
        const v = e.currentTarget;
        if (!v || seekDone.current) return;
        if (!v.duration || !Number.isFinite(v.duration) || v.duration <= 0) return;
        const target = v.duration > 1 ? 1 : Math.max(0.05, v.duration / 2);
        let rangeEnd = 0;
        if (v.seekable && v.seekable.length > 0) rangeEnd = v.seekable.end(v.seekable.length - 1);
        if (rangeEnd < target - 0.1) return;
        try {
            if (Math.abs(v.currentTime - target) > 0.05) v.currentTime = target;
            else { seekDone.current = true; v.pause(); }
        } catch { /* ignore */ }
    };

    const onSeeked = (e) => {
        const v = e.currentTarget;
        if (seekDone.current) return;
        if (!v.duration || !Number.isFinite(v.duration)) return;
        const target = v.duration > 1 ? 1 : Math.max(0.05, v.duration / 2);
        if (Math.abs(v.currentTime - target) > 0.2) return;
        seekDone.current = true;
        v.pause();
    };

    return (
        <video
            key={src}
            src={src}
            muted
            playsInline
            preload="auto"
            className={className}
            onLoadedMetadata={trySeek}
            onProgress={trySeek}
            onSeeked={onSeeked}
        />
    );
}

const ACTION_META = {
    link:  { icon: ExternalLink, label: 'Visit',  colorCls: 'bg-[#b59100]/10 text-[#b59100] hover:bg-[#b59100]/20 border-[#b59100]/30' },
    email: { icon: Mail,         label: 'Email',  colorCls: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200' },
    phone: { icon: Phone,        label: 'Call',   colorCls: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200' },
};

function ActionButton({ action }) {
    const [copied, setCopied] = useState(false);

    const meta = ACTION_META[action.type] ?? ACTION_META.link;
    const Icon = meta.icon;

    const handleClick = (e) => {
        if (action.type === 'link') return;
        e.preventDefault();
        navigator.clipboard.writeText(action.value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const href =
        action.type === 'email' ? `mailto:${action.value}` :
        action.type === 'phone' ? `tel:${action.value.replace(/\s/g, '')}` :
        action.value.startsWith('http') ? action.value : `https://${action.value}`;

    const tooltipText = action.type === 'phone' ? 'Phone number copied!' : 'Email copied!';

    return (
        <span className="relative inline-flex">
            <a
                href={href}
                target={action.type === 'link' ? '_blank' : undefined}
                rel={action.type === 'link' ? 'noopener noreferrer' : undefined}
                onClick={handleClick}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#b59100]/30 ${meta.colorCls}`}
            >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {action.label?.trim() || meta.label}
            </a>

            {copied && (
                <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg">
                    {tooltipText}
                    <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </span>
            )}
        </span>
    );
}

function RetailersCard({ retailers }) {
    if (!Array.isArray(retailers) || retailers.length === 0) return null;

    return (
        <div className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-[#b59100]" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Where to Buy
                </h3>
            </div>

            <ul className="space-y-3">
                {retailers.map((retailer, i) => {
                    const actions = Array.isArray(retailer.actions) ? retailer.actions.filter(a => a?.value) : [];
                    return (
                        <li key={i} className="relative flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
                            <span className="min-w-0 flex-1 text-sm font-medium text-gray-800 truncate">
                                {retailer.name}
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {actions.map((action, j) => (
                                    <ActionButton key={j} action={action} />
                                ))}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default function ProductEnquiryShow({ slug, product }) {
    const images = product.signed_product_images ?? [];
    const videoUrl = product.signed_video_url ?? null;

    const mediaItems = useMemo(
        () => (images || []).map((src) => ({ type: isVideoUrl(src) ? 'video' : 'image', src })),
        [images],
    );

    const [activeIndex, setActiveIndex] = useState(0);

    const bannerThumbSeekDone = useRef(false);
    const bannerFirstPlayHandled = useRef(false);

    useEffect(() => {
        bannerThumbSeekDone.current = false;
        bannerFirstPlayHandled.current = false;
    }, [videoUrl]);

    const trySeekBannerThumb = (e) => {
        const v = e.currentTarget;
        if (!v || bannerThumbSeekDone.current || bannerFirstPlayHandled.current) return;
        if (!v.duration || !Number.isFinite(v.duration) || v.duration <= 0) return;
        const target = v.duration > VIDEO_THUMB_TIME ? VIDEO_THUMB_TIME : Math.max(0.05, v.duration / 2);
        let rangeEnd = 0;
        if (v.seekable && v.seekable.length > 0) rangeEnd = v.seekable.end(v.seekable.length - 1);
        if (rangeEnd < target - 0.15) return;
        try {
            if (Math.abs(v.currentTime - target) > 0.08) v.currentTime = target;
            else { bannerThumbSeekDone.current = true; v.pause(); }
        } catch { /* ignore */ }
    };

    const onBannerVideoSeeked = (e) => {
        const v = e.currentTarget;
        if (bannerThumbSeekDone.current) return;
        if (!v.duration || !Number.isFinite(v.duration)) return;
        const target = v.duration > VIDEO_THUMB_TIME ? VIDEO_THUMB_TIME : Math.max(0.05, v.duration / 2);
        if (Math.abs(v.currentTime - target) > 0.2) return;
        bannerThumbSeekDone.current = true;
        v.pause();
    };

    const onBannerPlay = (e) => {
        if (bannerFirstPlayHandled.current) return;
        bannerFirstPlayHandled.current = true;
        bannerThumbSeekDone.current = true;
        e.currentTarget.currentTime = 0;
    };

    useEffect(() => {
        if (mediaItems.length && activeIndex >= mediaItems.length) setActiveIndex(0);
    }, [mediaItems.length, activeIndex]);

    const activeItem = mediaItems.length
        ? mediaItems[Math.min(activeIndex, mediaItems.length - 1)]
        : null;

    const goPrev = () => {
        if (mediaItems.length < 2) return;
        setActiveIndex((i) => (i - 1 + mediaItems.length) % mediaItems.length);
    };

    const goNext = () => {
        if (mediaItems.length < 2) return;
        setActiveIndex((i) => (i + 1) % mediaItems.length);
    };

    return (
        <HomeLayout>
            <Head title={`Enquire — ${product.product_name}`} />

            <div className="relative mx-auto mt-0 w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 md:py-16 lg:px-8">
                <nav className="mb-8 text-sm text-gray-500">
                    <Link href={route('welcome')} className="font-medium text-[#b59100] hover:underline">
                        Home
                    </Link>
                    <span className="mx-2 text-gray-400" aria-hidden>/</span>
                    <span className="text-gray-700">Product enquiry</span>
                </nav>

                {videoUrl && (
                    <div className="mb-10 overflow-hidden rounded-2xl border border-gray-200 bg-transparent shadow-sm">
                        <video
                            key={videoUrl}
                            src={videoUrl}
                            controls
                            controlsList="nodownload"
                            playsInline
                            muted
                            preload="auto"
                            className="aspect-video h-auto w-full object-contain"
                            onLoadedMetadata={trySeekBannerThumb}
                            onProgress={trySeekBannerThumb}
                            onSeeked={onBannerVideoSeeked}
                            onPlay={onBannerPlay}
                        />
                    </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2 lg:gap-8 xl:gap-10">
                    {/* Product details */}
                    <section className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
                        <h1 className="barlow-condensed-semibold text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                            {product.product_name}
                        </h1>

                        <div className="mt-8 flex flex-col gap-4 md:mt-10 md:flex-row md:gap-5">
                            {mediaItems.length > 0 && (
                                <div className="order-2 flex shrink-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:order-1 md:w-[5.25rem] md:flex-col md:overflow-y-auto md:pb-0 p-1 md:max-h-[min(28rem,42vh)]">
                                    {mediaItems.map((item, i) => (
                                        <button
                                            key={`${item.type}-${i}`}
                                            type="button"
                                            onClick={() => setActiveIndex(i)}
                                            className={`relative shrink-0 overflow-hidden rounded-xl border-2 transition focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 focus:ring-offset-white ${
                                                i === activeIndex
                                                    ? 'border-[#b59100] ring-2 ring-[#ffde59]/40'
                                                    : 'border-gray-200 opacity-80 hover:opacity-100'
                                            }`}
                                            aria-label={`View ${item.type} ${i + 1}`}
                                        >
                                            {item.type === 'video' ? (
                                                <>
                                                    <GalleryVideoThumb
                                                        src={item.src}
                                                        className="h-16 w-16 object-cover md:h-20 md:w-full"
                                                    />
                                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55">
                                                            <Film className="h-4 w-4 text-white" />
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <img src={item.src} alt="" className="h-16 w-16 object-cover md:h-20 md:w-full" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="relative order-1 min-w-0 flex-1 md:order-2">
                                <div className="relative flex aspect-square w-full max-h-[min(24rem,70vw)] items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 md:max-h-[min(28rem,55vh)]">
                                    {activeItem?.type === 'video' ? (
                                        <video
                                            key={activeItem.src}
                                            src={activeItem.src}
                                            controls
                                            controlsList="nodownload"
                                            autoPlay
                                            playsInline
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    ) : activeItem?.type === 'image' ? (
                                        <img
                                            src={activeItem.src}
                                            alt=""
                                            className="max-h-full max-w-full object-contain object-center p-2"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-gray-400">
                                            <ImageIcon className="h-14 w-14" strokeWidth={1.25} />
                                            <span className="text-sm">No media for this product yet</span>
                                        </div>
                                    )}
                                    {mediaItems.length > 1 && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={goPrev}
                                                className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm transition hover:bg-black/60"
                                                aria-label="Previous"
                                            >
                                                <ChevronLeft className="h-6 w-6" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={goNext}
                                                className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white shadow-md backdrop-blur-sm transition hover:bg-black/60"
                                                aria-label="Next"
                                            >
                                                <ChevronRight className="h-6 w-6" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {product.product_description ? (
                            <div
                                className="long-description mt-8 max-w-none text-base leading-relaxed text-gray-800 [&_p]:mb-3 [&_p:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: product.product_description }}
                            />
                        ) : (
                            <p className="mt-8 text-sm text-gray-500">No description provided for this product.</p>
                        )}
                    </section>

                    {/* Right column: AI Concierge + Retailers */}
                    <div className="flex flex-col gap-4 lg:gap-6">
                        <AiConcierge product={product} />
                        <RetailersCard retailers={product.retailers} />
                    </div>
                </div>
            </div>

            <HeroNav position="top" />
        </HomeLayout>
    );
}
