import AiConcierge from '@/Components/AiConcierge';
import HeroNav from '@/Components/HeroNav';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link } from '@inertiajs/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowRight,
    BookOpen,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Film,
    ImageIcon,
    Instagram,
    Linkedin,
    Mail,
    MessageCircle,
    MessageSquare,
    Phone,
    Share2,
    ShoppingBag,
    Sparkles,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const VIDEO_THUMB_TIME = 1;

/* ── Utilities ───────────────────────────────────────────────────────────── */

function stripHtml(html) {
    if (!html) return '';
    if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function truncatePreview(text, maxChars = 220) {
    if (!text) return '';
    if (text.length <= maxChars) return text;
    const slice = text.slice(0, maxChars);
    const lastBreak = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
    if (lastBreak > maxChars * 0.6) return slice.slice(0, lastBreak + 1);
    return slice.trimEnd() + '…';
}

function isVideoUrl(url) {
    if (!url) return false;
    const path = url.split('?')[0].toLowerCase();
    return /\.(mp4|mov|avi|webm|mkv|m4v|ogv)(\b|$)/.test(path);
}

/* ── Gallery video thumbnail (identical to v1) ───────────────────────────── */

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

/* ── Retailers (with copy-to-clipboard tooltips, reused) ─────────────────── */

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
                <h3 className="barlow-condensed-semibold text-2xl font-bold leading-tight text-gray-900">Where to Buy</h3>
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

/* ── AI Concierge inline CTA — sits inside the description area ──────────── */

function ConciergeCta({ productName, onAskQuestion, onPickMode }) {
    const suggestions = useMemo(() => ([
        `Tell me about ${productName}`,
        `Where can I buy ${productName}?`,
        `What makes ${productName} special?`,
    ]), [productName]);

    return (
        <motion.div
            key="cta"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm"
        >
            <span aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-44 w-44 rounded-full bg-[#b59100]/5 blur-3xl" />

            <div className="relative flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#b59100] text-white shadow-md ring-4 ring-[#b59100]/15">
                    <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                    {/* <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b59100]/80">
                        Connect with Allison
                    </p> */}
                    <h3 className="barlow-condensed-semibold mt-0 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
                        Know more about <span className="text-[#b59100]">{productName}</span>
                    </h3>
                    {/* <p className="mt-2 text-sm leading-relaxed text-gray-600">
                        I'm The Concierge — your AI guide for this product. Ask me about <strong className="text-gray-800">features</strong>, <strong className="text-gray-800">availability</strong>, or anything else.
                    </p> */}
                </div>
            </div>

            {/* Suggested-question chips — click instantly starts text chat and asks the question */}
            <div className="relative mt-4 flex flex-wrap gap-2">
                {suggestions.map((q) => (
                    <button
                        key={q}
                        type="button"
                        onClick={() => onAskQuestion(q)}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-[#b59100]/30 bg-gradient-to-br from-[#fff8e0] via-white to-[#fff4cc] px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-[#b59100] hover:from-[#fff4cc] hover:to-[#ffe9a3] hover:text-[#b59100] focus:outline-none focus:ring-2 focus:ring-[#b59100]/30"
                    >
                        <MessageSquare className="h-3 w-3 opacity-70 group-hover:opacity-100" />
                        {q}
                    </button>
                ))}
            </div>

            {/* Fake chat-starter input — click opens the voice/text mode picker */}
            <button
                type="button"
                onClick={onPickMode}
                className="group relative mt-4 flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition hover:border-[#b59100]/60 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#b59100]/30"
            >
                <span className="flex-1 text-sm text-gray-400 transition group-hover:text-gray-600">
                    Ask anything about <span className="font-medium text-gray-500">{productName}</span>…
                </span>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#b59100] text-white shadow-md transition group-hover:bg-[#9a7c00]">
                    <ArrowRight className="h-4 w-4" />
                </span>
            </button>

            <p className="relative mt-3 text-center text-[11px] text-gray-400">
                Powered by <strong className="text-[#b59100] font-bold">VoiceModel</strong>
            </p>
        </motion.div>
    );
}

/* ── Social Posts — Instagram embed carousel ─────────────────────────────── */

function useInstagramEmbed(dep) {
    useEffect(() => {
        const process = () => {
            if (window.instgrm?.Embeds?.process) {
                window.instgrm.Embeds.process();
            }
        };

        if (window.instgrm?.Embeds?.process) {
            // Script already loaded — re-process after a tick so the new blockquote is in DOM
            const t = setTimeout(process, 100);
            return () => clearTimeout(t);
        }

        if (!document.getElementById('ig-embed-script')) {
            const s = document.createElement('script');
            s.id = 'ig-embed-script';
            s.async = true;
            s.src = 'https://www.instagram.com/embed.js';
            // Process after load
            s.onload = process;
            document.body.appendChild(s);
        }
    }, [dep]);
}

function LinkedInCard({ post }) {
    return (
        <a
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-4 rounded-2xl border border-[#0a66c2]/20 bg-[#f3f8ff] p-6 text-center transition hover:border-[#0a66c2]/40 hover:shadow-md"
        >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0a66c2]">
                <Linkedin className="h-6 w-6 text-white" />
            </span>
            {post.description && (
                <p className="line-clamp-4 text-sm leading-relaxed text-gray-700">{post.description}</p>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0a66c2] px-4 py-1.5 text-xs font-semibold text-white">
                View on LinkedIn <ExternalLink className="h-3 w-3" />
            </span>
        </a>
    );
}

function InstagramEmbed({ post }) {
    useInstagramEmbed(post.post_url);
    return (
        // overflow-hidden stops the iframe Instagram injects from escaping the card
        <div className="w-full overflow-hidden">
            <blockquote
                className="instagram-media"
                data-instgrm-permalink={`${post.post_url}?utm_source=ig_embed&utm_campaign=loading`}
                data-instgrm-version="14"
                style={{
                    background: '#FFF', border: 0, borderRadius: '3px',
                    boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
                    margin: '0', width: '100%', minWidth: 'unset', maxWidth: 'unset', padding: 0,
                }}
            >
                <div style={{ padding: '12px' }}>
                    <a href={`${post.post_url}?utm_source=ig_embed&utm_campaign=loading`} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#3897f0', fontFamily: 'Arial,sans-serif', fontSize: '12px', fontWeight: 550, lineHeight: '16px', textDecoration: 'none' }}>
                        View this post on Instagram
                    </a>
                </div>
            </blockquote>
        </div>
    );
}

function SocialPostsGallery({ posts }) {
    const activePosts = (posts ?? []).filter((p) => p.active !== false);
    if (activePosts.length === 0) return null;

    const [active, setActive] = useState(0);
    const total = activePosts.length;
    const touchStartX = useRef(null);

    const prev = () => setActive((i) => (i - 1 + total) % total);
    const next = () => setActive((i) => (i + 1) % total);

    const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const onTouchEnd   = (e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) < 40) return;
        dx < 0 ? next() : prev();
    };

    // Center card takes 68% on desktop, full width on mobile
    const CENTER_W = 68; // %
    const PEEK_W   = (100 - CENTER_W) / 2; // ~16% each side

    return (
        <div className="rounded-2xl border border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-[#b59100]" />
                    <h3 className="barlow-condensed-semibold text-2xl font-bold leading-tight text-gray-900">Social Media</h3>
                </div>
                {total > 1 && <span className="text-xs text-gray-400">{active + 1} / {total}</span>}
            </div>

            {/* Carousel track */}
            <div
                className="relative py-6"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                {/* Left arrow */}
                {total > 1 && (
                    <button
                        type="button"
                        onClick={prev}
                        aria-label="Previous"
                        className="absolute left-2 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md border border-gray-100 transition hover:bg-gray-50 active:scale-95 focus:outline-none"
                    >
                        <ChevronLeft className="h-4 w-4 text-gray-700" />
                    </button>
                )}

                {/* Right arrow */}
                {total > 1 && (
                    <button
                        type="button"
                        onClick={next}
                        aria-label="Next"
                        className="absolute right-2 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md border border-gray-100 transition hover:bg-gray-50 active:scale-95 focus:outline-none"
                    >
                        <ChevronRight className="h-4 w-4 text-gray-700" />
                    </button>
                )}

                {/* Overflow clip wrapper — clips side peek but not vertical */}
                <div className="overflow-hidden">
                    {/* Slide strip */}
                    <div
                        className="flex items-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                        style={{
                            transform: `translateX(calc(${PEEK_W}% - ${active * CENTER_W}% + ${active * 30}px))`,
                            paddingLeft: 0,
                        }}
                    >
                        {activePosts.map((post, i) => {
                            const isCenter = i === active;
                            return (
                                <div
                                    key={post.post_url}
                                    onClick={() => !isCenter && setActive(i)}
                                    className="flex-shrink-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                    style={{
                                        width: `${CENTER_W}%`,
                                        marginRight: -30,
                                        opacity: isCenter ? 1 : 0.4,
                                        cursor: isCenter ? 'default' : 'pointer',
                                        pointerEvents: isCenter ? 'auto' : 'none',
                                    }}
                                >
                                    <div className={`rounded-2xl overflow-hidden border transition-all duration-500 max-h-[430px] md:max-h-[645px] ${isCenter ? 'border-gray-200 shadow-lg' : 'border-gray-100 shadow-sm scale-[0.75]'}`}>
                                        {post.platform === 'linkedin'
                                            ? <LinkedInCard post={post} />
                                            : <InstagramEmbed post={post} />
                                        }
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Dot indicators — below the carousel */}
                {total > 1 && (
                    <div className="mt-4 flex justify-center items-center gap-1.5">
                        {activePosts.map((_, i) => (
                            <button key={i} type="button" onClick={() => setActive(i)} aria-label={`Post ${i + 1}`}
                                className={`rounded-full transition-all duration-300 ${i === active ? 'h-2 w-5 bg-gray-600' : 'h-2 w-2 bg-gray-300 hover:bg-gray-400'}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── About ↔ AI Concierge flip card ──────────────────────────────────────── */

const flipVariants = {
    enter: { rotateY: -90, opacity: 0 },
    center: { rotateY: 0,  opacity: 1 },
    exit:  { rotateY:  90, opacity: 0 },
};
const flipTransition = { duration: 0.38, ease: [0.22, 1, 0.36, 1] };

function AboutConciergeCard({ product }) {
    const [flipped, setFlipped] = useState(false);

    return (
        <div style={{ perspective: '1200px' }}>
            <AnimatePresence mode="wait" initial={false}>
                {!flipped ? (
                    <motion.div
                        key="about"
                        variants={flipVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={flipTransition}
                        style={{ transformOrigin: 'center center' }}
                        className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-sm"
                    >
                        <div className="mb-4 flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-[#b59100]" />
                            <h2 className="barlow-condensed-semibold font-bold leading-tight text-gray-900 text-2xl">About</h2>
                        </div>
                        {product.product_description ? (
                            <div
                                className="long-description max-w-none text-base leading-relaxed text-gray-800 [&_p]:mb-3 [&_p:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: product.product_description }}
                            />
                        ) : (
                            <p className="text-sm italic text-gray-400">No description yet — ask The Concierge.</p>
                        )}
                        <button
                            type="button"
                            onClick={() => setFlipped(true)}
                            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#b59100]/40 bg-[#fffbe6] px-4 py-2 text-sm font-medium text-[#8a6d00] transition hover:bg-[#fff3b0] hover:border-[#b59100]"
                        >
                            <MessageCircle className="h-4 w-4" />
                            Want to know more? Ask a question
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="concierge"
                        variants={flipVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={flipTransition}
                        style={{ transformOrigin: 'center center' }}
                    >
                        <AiConcierge product={product} autoStart="mode" onBack={() => setFlipped(false)} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function ProductEnquiryShowV2({ slug, product }) {
    const images = product.signed_product_images ?? [];
    const videoUrl = product.signed_video_url ?? null;


    const mediaItems = useMemo(
        () => (images || []).map((src) => ({ type: isVideoUrl(src) ? 'video' : 'image', src })),
        [images],
    );

    const [activeIndex, setActiveIndex]     = useState(0);
    const [chatOpen, setChatOpen]           = useState(false);
    const [autoStartMode, setAutoStartMode]   = useState(null);   // 'mode' | 'text' | 'voice' | null
    const [autoInitialMessage, setAutoInitialMessage] = useState(null);

    const handleAskQuestion = (question) => {
        setAutoStartMode('text');
        setAutoInitialMessage(question);
        setChatOpen(true);
    };

    const handlePickMode = () => {
        setAutoStartMode('mode');
        setAutoInitialMessage(null);
        setChatOpen(true);
    };

    const handleCloseChat = () => {
        setChatOpen(false);
        setAutoStartMode(null);
        setAutoInitialMessage(null);
    };


    const bannerThumbSeekDone     = useRef(false);
    const bannerFirstPlayHandled  = useRef(false);

    useEffect(() => {
        bannerThumbSeekDone.current    = false;
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

    // When opening the chat, smoothly scroll it into view
    const chatRef = useRef(null);
    const activeThumbRef = useRef(null);

    useEffect(() => {
        activeThumbRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, [activeIndex]);
    useEffect(() => {
        if (chatOpen && chatRef.current) {
            setTimeout(() => chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
        }
    }, [chatOpen]);

    return (
        <HomeLayout>
            <Head title={product.product_name} />

            <div className="relative mx-auto mt-0 w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 md:py-16 lg:px-8">
                <nav aria-label="Breadcrumb" className="mb-8 text-sm text-gray-500">
                    <ol className="flex items-center gap-1" itemScope itemType="https://schema.org/BreadcrumbList">
                        <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                            <Link href={route('welcome')} className="font-medium text-[#b59100] hover:underline" itemProp="item">
                                <span itemProp="name">Home</span>
                            </Link>
                            <meta itemProp="position" content="1" />
                        </li>
                        <li className="mx-2 text-gray-400" aria-hidden>/</li>
                        <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                            <span className="text-gray-700" itemProp="name">{product.product_name}</span>
                            <meta itemProp="position" content="2" />
                        </li>
                    </ol>
                </nav>

                {videoUrl && (
                    <div className="mb-10 overflow-hidden rounded-2xl border border-gray-200 bg-transparent shadow-sm">
                        <video
                            key={videoUrl}
                            src={videoUrl}
                            controls
                            controlsList="nodownload"
                            playsInline
                            // muted
                            preload="auto"
                            className="aspect-video h-auto w-full object-contain"
                            onLoadedMetadata={trySeekBannerThumb}
                            onProgress={trySeekBannerThumb}
                            onSeeked={onBannerVideoSeeked}
                            onPlay={onBannerPlay}
                        />
                    </div>
                )}

                <div className="grid gap-2 lg:grid-cols-2 lg:items-start lg:gap-4 xl:gap-6 [&>*:last-child]:overflow-x-hidden ">
                    {/* ── LEFT COLUMN: sticky — sized by content, right column scrolls past it ── */}
                    <section aria-label="Media gallery" className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8 lg:sticky lg:top-24 lg:self-start">
                        <h1 className="barlow-condensed-semibold text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                            {product.product_name}
                        </h1>

                        {/* Gallery — identical structure to v1 */}
                        <div className="mt-8 flex flex-col gap-4 md:mt-10 md:flex-row md:gap-5">
                            {mediaItems.length > 0 && (
                                <div className="order-2 flex shrink-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:order-1 md:w-[5.25rem] md:flex-col md:overflow-y-auto md:pb-0 p-1 md:max-h-[min(28rem,52vh)]">
                                    {mediaItems.map((item, i) => (
                                        <button
                                            key={`${item.type}-${i}`}
                                            ref={i === activeIndex ? activeThumbRef : null}
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

                    </section>

                    {/* ── RIGHT COLUMN: About/Concierge flip card + Social Posts + Retailers ── */}
                    <section aria-label="Company details" className="flex flex-col gap-4 lg:gap-6">
                        <AboutConciergeCard product={product} />
                        <SocialPostsGallery posts={product.social_posts} />
                        <RetailersCard retailers={product.retailers} />
                    </section>
                </div>
            </div>

            <HeroNav position="top" />
        </HomeLayout>
    );
}
