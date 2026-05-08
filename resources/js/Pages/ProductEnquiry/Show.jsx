import HeroNav from '@/Components/HeroNav';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import 'react-quill/dist/quill.snow.css';
import { ChevronLeft, ChevronRight, Film, ImageIcon } from 'lucide-react';
import { flushSync } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

/** Frame time (seconds) used as the banner video’s initial thumbnail frame. */
const VIDEO_THUMB_TIME = 4;

/** Detect whether a URL points to a video file by its extension (strips query strings). */
function isVideoUrl(url) {
    if (!url) return false;
    const path = url.split('?')[0].toLowerCase();
    return /\.(mp4|mov|avi|webm|mkv|m4v|ogv)(\b|$)/.test(path);
}

/**
 * Tiny video thumbnail that seeks to ~1 s (or midpoint for short clips) so a visible
 * frame is shown without autoplay. Mirrors the banner video seek technique exactly.
 */
function GalleryVideoThumb({ src, className }) {
    const seekDone = useRef(false);

    const trySeek = (e) => {
        const v = e.currentTarget;
        if (!v || seekDone.current) return;
        if (!v.duration || !Number.isFinite(v.duration) || v.duration <= 0) return;
        const target = v.duration > 1 ? 1 : Math.max(0.05, v.duration / 2);
        let rangeEnd = 0;
        if (v.seekable && v.seekable.length > 0) {
            rangeEnd = v.seekable.end(v.seekable.length - 1);
        }
        if (rangeEnd < target - 0.1) return;
        try {
            if (Math.abs(v.currentTime - target) > 0.05) {
                v.currentTime = target;
            } else {
                seekDone.current = true;
                v.pause();
            }
        } catch {
            // ignore seek errors
        }
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

const fieldClass =
    'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

const phoneFieldShell =
    'mt-1 flex min-h-[42px] rounded-md border border-gray-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500';

const phoneNationalInputClass =
    'min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0';

/**
 * Up to 10 NANP digits for the national portion only.
 * Strips a stored "+1 …" prefix first so the country code’s `1` is never counted as the first digit.
 * Then strips a leading `1` when 11 digits were pasted (e.g. 1xxxxxxxxxx).
 */
function digitsUsNational(value) {
    let s = String(value ?? '').trim();
    if (s.startsWith('+1')) {
        s = s.slice(2).trimStart();
    }
    let d = s.replace(/\D/g, '');
    if (d.length >= 11 && d.startsWith('1')) {
        d = d.slice(1);
    }
    return d.slice(0, 10);
}

/** Formats national digits as (123) 456-7890 for display and storage (after +1 ). */
function formatNationalForDisplay(digits) {
    const d = digitsUsNational(digits);
    if (!d) return '';
    if (d.length <= 3) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Full stored/submitted value: +1 (123) 456-7890 */
function fullPlusOnePhone(digits10) {
    const d = digitsUsNational(digits10);
    if (d.length !== 10) return '';
    return `+1 ${formatNationalForDisplay(d)}`;
}

/**
 * Client-side email check (no DNS). Kept conservative so it rarely disagrees with Laravel’s egulias rules.
 */
function isValidEmailAddress(value) {
    const s = String(value ?? '').trim();
    if (s.length === 0 || s.length > 255) {
        return false;
    }
    const at = s.lastIndexOf('@');
    if (at < 1 || at === s.length - 1) {
        return false;
    }
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    if (local.length > 64 || domain.length > 253) {
        return false;
    }
    if (!/^[\w+!#$%&'*+/=?^`{|}~-]+(?:\.[\w+!#$%&'*+/=?^`{|}~-]+)*$/i.test(local)) {
        return false;
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)) {
        return false;
    }
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) {
        return false;
    }
    return true;
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
    /** After first user play, do not jump to 0 again (pause/resume stays in the timeline). */
    const bannerFirstPlayHandled = useRef(false);

    useEffect(() => {
        bannerThumbSeekDone.current = false;
        bannerFirstPlayHandled.current = false;
    }, [videoUrl]);

    const trySeekBannerThumb = (e) => {
        const v = e.currentTarget;
        if (!v || bannerThumbSeekDone.current || bannerFirstPlayHandled.current) return;
        if (!v.duration || !Number.isFinite(v.duration) || v.duration <= 0) return;

        const target =
            v.duration > VIDEO_THUMB_TIME ? VIDEO_THUMB_TIME : Math.max(0.05, v.duration / 2);

        let rangeEnd = 0;
        if (v.seekable && v.seekable.length > 0) {
            rangeEnd = v.seekable.end(v.seekable.length - 1);
        }
        if (rangeEnd < target - 0.15) {
            return;
        }

        try {
            if (Math.abs(v.currentTime - target) > 0.08) {
                v.currentTime = target;
            } else {
                bannerThumbSeekDone.current = true;
                v.pause();
            }
        } catch {
            // ignore
        }
    };

    const onBannerVideoSeeked = (e) => {
        const v = e.currentTarget;
        if (bannerThumbSeekDone.current) {
            return;
        }
        if (!v.duration || !Number.isFinite(v.duration)) {
            return;
        }
        const target =
            v.duration > VIDEO_THUMB_TIME ? VIDEO_THUMB_TIME : Math.max(0.05, v.duration / 2);
        if (Math.abs(v.currentTime - target) > 0.2) {
            return;
        }
        bannerThumbSeekDone.current = true;
        v.pause();
    };

    const onBannerPlay = (e) => {
        const v = e.currentTarget;
        if (bannerFirstPlayHandled.current) {
            return;
        }
        bannerFirstPlayHandled.current = true;
        bannerThumbSeekDone.current = true;
        v.currentTime = 0;
    };

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        store_name: '',
        phone: '',
        email: '',
        message: '',
    });

    const phoneNationalInputRef = useRef(null);
    const emailInputRef = useRef(null);

    useEffect(() => {
        if (mediaItems.length && activeIndex >= mediaItems.length) {
            setActiveIndex(0);
        }
    }, [mediaItems.length, activeIndex]);

    const activeItem = mediaItems.length ? mediaItems[Math.min(activeIndex, mediaItems.length - 1)] : null;

    const goPrev = () => {
        if (mediaItems.length < 2) return;
        setActiveIndex((i) => (i - 1 + mediaItems.length) % mediaItems.length);
    };

    const goNext = () => {
        if (mediaItems.length < 2) return;
        setActiveIndex((i) => (i + 1) % mediaItems.length);
    };

    const nationalPhoneDisplay = useMemo(() => formatNationalForDisplay(data.phone), [data.phone]);

    const syncPhoneValidity = (el, digitCount) => {
        if (!el) return;
        if (digitCount === 0) {
            el.setCustomValidity('Phone is required.');
        } else if (digitCount < 10) {
            el.setCustomValidity('Enter a complete 10-digit US number.');
        } else {
            el.setCustomValidity('');
        }
    };

    const onPhoneNationalChange = (e) => {
        const el = e.target;
        const d = digitsUsNational(el.value);
        syncPhoneValidity(el, d.length);
        setData('phone', d.length ? `+1 ${formatNationalForDisplay(d)}` : '');
    };

    const syncEmailValidity = (el, emailValue) => {
        if (!el) return;
        const t = String(emailValue ?? '').trim();
        if (!t) {
            el.setCustomValidity('Email is required.');
        } else if (!isValidEmailAddress(t)) {
            el.setCustomValidity('Enter a valid email address.');
        } else {
            el.setCustomValidity('');
        }
    };

    const onEmailChange = (e) => {
        const el = e.target;
        setData('email', el.value);
        syncEmailValidity(el, el.value);
    };

    const submit = (e) => {
        e.preventDefault();
        const d = digitsUsNational(data.phone);
        const natEl = phoneNationalInputRef.current;
        if (natEl) {
            syncPhoneValidity(natEl, d.length);
            if (!natEl.checkValidity()) {
                natEl.reportValidity();
                return;
            }
        } else if (d.length !== 10) {
            toast.error('Please enter a complete 10-digit phone number.');
            return;
        }

        const formatted = fullPlusOnePhone(d);
        const emailTrimmed = String(data.email ?? '').trim();
        const emailEl = emailInputRef.current;

        if (emailEl) {
            syncEmailValidity(emailEl, emailTrimmed);
            if (!emailEl.checkValidity()) {
                emailEl.reportValidity();
                return;
            }
        } else if (!isValidEmailAddress(emailTrimmed)) {
            toast.error('Please enter a valid email address.');
            return;
        }

        flushSync(() => {
            setData('phone', formatted);
            setData('email', emailTrimmed);
        });

        post(route('product-enquiry.record-submission', slug), {
            preserveScroll: true,
            onSuccess: (page) => {
                const msg =
                    page.props.flash?.success ??
                    'Thank you! We have received your enquiry.';
                toast.success(msg, { duration: 6000 });
                reset();
            },
        });
    };

    return (
        <HomeLayout>
            <Head title={`Enquire — ${product.product_name}`} />

            <div className="relative mx-auto mt-0 w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 md:py-16 lg:px-8">
                <nav className="mb-8 text-sm text-gray-500">
                    <Link href={route('welcome')} className="font-medium text-[#b59100] hover:underline">
                        Home
                    </Link>
                    <span className="mx-2 text-gray-400" aria-hidden>
                        /
                    </span>
                    <span className="text-gray-700">Product enquiry</span>
                </nav>

                {videoUrl ? (
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
                ) : null}

                <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
                    {/* Product */}
                    <section className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
                        <h1 className="barlow-condensed-semibold text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                            {product.product_name}
                        </h1>

                        <div className="mt-8 flex flex-col gap-4 md:mt-10 md:flex-row md:gap-5">
                            {mediaItems.length > 0 ? (
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
                            ) : null}

                            <div className="relative order-1 min-w-0 flex-1 md:order-2">
                                <div
                                    className="relative flex aspect-square w-full max-h-[min(24rem,70vw)] items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 md:max-h-[min(28rem,55vh)]"
                                >
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
                                    {mediaItems.length > 1 ? (
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
                                    ) : null}
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

                    {/* Form */}
                    <section className="h-fit rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
                        <h2 className="barlow-condensed-semibold text-2xl font-bold text-gray-900">Send an enquiry</h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Tell us how we can help.
                        </p>

                    
                        <form className="mt-8 space-y-5" onSubmit={submit}>
                            <div>
                                <label htmlFor="enq_name" className="block text-sm font-medium text-gray-700">
                                    Your name *
                                </label>
                                <input
                                    id="enq_name"
                                    type="text"
                                    className={fieldClass}
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    required
                                    autoComplete="name"
                                />
                                {errors.name ? <p className="mt-1 text-sm text-red-600">{errors.name}</p> : null}
                            </div>
                            <div>
                                <label htmlFor="enq_store_name" className="block text-sm font-medium text-gray-700">
                                    Store name *
                                </label>
                                <input
                                    id="enq_store_name"
                                    type="text"
                                    className={fieldClass}
                                    value={data.store_name}
                                    onChange={(e) => setData('store_name', e.target.value)}
                                    required
                                    autoComplete="organization"
                                />
                                {errors.store_name ? (
                                    <p className="mt-1 text-sm text-red-600">{errors.store_name}</p>
                                ) : null}
                            </div>
                            <div>
                                <label htmlFor="enq_phone_national" className="block text-sm font-medium text-gray-700">
                                    Phone *
                                </label>
                                <div className={`overflow-hidden ${phoneFieldShell}`}>
                                    <span
                                        className="flex shrink-0 select-none items-center border-r border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium tabular-nums text-gray-700"
                                        aria-hidden
                                    >
                                        +1
                                    </span>
                                    <input
                                        ref={phoneNationalInputRef}
                                        id="enq_phone_national"
                                        type="tel"
                                        inputMode="numeric"
                                        autoComplete="tel-national"
                                        className={phoneNationalInputClass}
                                        placeholder="(555) 123-4567"
                                        value={nationalPhoneDisplay}
                                        onChange={onPhoneNationalChange}
                                    />
                                </div>
                                {/* <p id="enq_phone_hint" className="mt-1 text-xs text-gray-500">
                                    US / Canada (+1). Country code is fixed; enter 10 digits.
                                </p> */}
                                {errors.phone ? <p className="mt-1 text-sm text-red-600">{errors.phone}</p> : null}
                            </div>
                            <div>
                                <label htmlFor="enq_email" className="block text-sm font-medium text-gray-700">
                                    Email *
                                </label>
                                <input
                                    ref={emailInputRef}
                                    id="enq_email"
                                    type="text"
                                    inputMode="email"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className={fieldClass}
                                    value={data.email}
                                    onChange={onEmailChange}
                                    autoComplete="email"
                                    aria-describedby="enq_email_hint"
                                />
                                {/* <p id="enq_email_hint" className="mt-1 text-xs text-gray-500">
                                    Use a real address you check; we will reply there.
                                </p> */}
                                {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email}</p> : null}
                            </div>
                            <div>
                                <label htmlFor="enq_message" className="block text-sm font-medium text-gray-700">
                                    Message{' '}
                                    <span className="font-normal text-gray-500">(optional)</span>
                                </label>
                                <textarea
                                    id="enq_message"
                                    rows={5}
                                    className={fieldClass}
                                    value={data.message}
                                    onChange={(e) => setData('message', e.target.value)}
                                    placeholder="How can we help?"
                                />
                                {errors.message ? <p className="mt-1 text-sm text-red-600">{errors.message}</p> : null}
                            </div>

                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex w-full items-center justify-center rounded-xl bg-[#b59100] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9a7c00] focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                            >
                                {processing ? 'Sending…' : 'Submit enquiry'}
                            </button>
                        </form>
                    </section>
                </div>
            </div>

            <HeroNav position="top" />
        </HomeLayout>
    );
}
