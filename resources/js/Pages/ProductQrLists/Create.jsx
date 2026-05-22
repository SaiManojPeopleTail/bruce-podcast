import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import ProductContentExtractorModal from '@/Components/Admin/ProductContentExtractorModal';
import RetailersEditor, { resolveRetailerConflicts } from '@/Components/Admin/RetailersEditor';
import SocialPostsManager from '@/Components/Admin/SocialPostsManager';
import PrimaryButton from '@/Components/PrimaryButton';
import RichTextEditor from '@/Components/RichTextEditor';
import { Head, router } from '@inertiajs/react';
import { ReactQRCode } from '@lglab/react-qr-code';
import axios from 'axios';
import { AlertTriangle, BookOpen, CheckCircle, CheckCircle2, Film, ImagePlus, Loader2, Video, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const QR_SETTINGS = {
    dataModulesSettings: { style: 'rounded' },
    finderPatternOuterSettings: { style: 'rounded-sm' },
    finderPatternInnerSettings: { style: 'rounded-sm' },
};
const MAX_MEDIA = 20;
const GALLERY_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];

function isVideoFile(file) {
    return GALLERY_VIDEO_TYPES.includes(file.type) || /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(file.name);
}

function toSlug(str) {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function captureQrAsPng(svgEl) {
    if (!svgEl) return null;
    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            canvas.getContext('2d').drawImage(img, 0, 0, 512, 512);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        img.src = url;
    });
}

export default function Create() {
    const qrRef = useRef(null);
    const slugTimerRef = useRef(null);

    const [productName, setProductName] = useState('');
    const [slug, setSlug] = useState('');
    const [slugStatus, setSlugStatus] = useState('idle'); // idle | checking | available | taken | empty
    const [description, setDescription] = useState('');
    const [retailers, setRetailers] = useState([]);
    const [pendingConflict, setPendingConflict] = useState(null);
    const [socialPosts, setSocialPosts] = useState([]);
    const [pendingKbText, setPendingKbText] = useState('');
    const [pendingKbName, setPendingKbName] = useState('');
    const [firstMessage, setFirstMessage] = useState('');
    const [voiceId, setVoiceId] = useState('');
    const [shopifyImageUrls, setShopifyImageUrls] = useState([]); // external CDN URLs from Shopify picker
    // Gallery media: parallel arrays of File and {url, type}
    const [mediaFiles, setMediaFiles] = useState([]); // File[]
    const [mediaPreviews, setMediaPreviews] = useState([]); // {url: string, type: 'image'|'video'}[]
    const mediaObjectUrlsRef = useRef([]);
    const [video, setVideo] = useState(null);
    const [videoName, setVideoName] = useState('');
    const [notificationEmail, setNotificationEmail] = useState('');
    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [saveProgress, setSaveProgress] = useState(null);
    const [draggingMedia, setDraggingMedia] = useState(false);
    const [draggingVideo, setDraggingVideo] = useState(false);
    const [showAutoModal, setShowAutoModal] = useState(false);

    // Revoke object URLs on unmount
    useEffect(() => () => { mediaObjectUrlsRef.current.forEach(URL.revokeObjectURL); }, []);

    const qrUrl = slug
        ? `${window.location.origin}/product/${slug}`
        : '';

    const checkSlug = useCallback(async (rawSlug) => {
        if (!rawSlug) {
            setSlugStatus('empty');
            setSlug('');
            return;
        }
        setSlugStatus('checking');
        try {
            const { data } = await axios.get(route('product-qr-lists.check-slug'), {
                params: { slug: rawSlug },
            });
            setSlug(data.slug);
            setSlugStatus(data.available ? 'available' : 'taken');
            if (!data.available) {
                toast(`Slug adjusted to: ${data.slug}`, { icon: 'ℹ️', duration: 3000 });
            }
        } catch {
            setSlugStatus('idle');
        }
    }, []);

    const handleNameChange = (e) => {
        const name = e.target.value;
        setProductName(name);
        const raw = toSlug(name);
        setSlug(raw);
        setSlugStatus(raw ? 'checking' : 'empty');
        if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
        if (raw) {
            slugTimerRef.current = setTimeout(() => checkSlug(raw), 450);
        }
    };

    useEffect(() => () => {
        if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    }, []);

    const addMediaFiles = (files) => {
        const remaining = MAX_MEDIA - mediaFiles.length;
        const toAdd = files.slice(0, remaining);
        if (!toAdd.length) return;
        const newPreviews = toAdd.map((file) => {
            const url = URL.createObjectURL(file);
            mediaObjectUrlsRef.current.push(url);
            return { url, type: isVideoFile(file) ? 'video' : 'image' };
        });
        setMediaFiles((prev) => [...prev, ...toAdd]);
        setMediaPreviews((prev) => [...prev, ...newPreviews]);
    };

    const handleMediaChange = (e) => {
        addMediaFiles(Array.from(e.target.files || []));
        e.target.value = '';
    };

    const removeMediaItem = (index) => {
        setMediaFiles((prev) => prev.filter((_, i) => i !== index));
        setMediaPreviews((prev) => {
            const removed = prev[index];
            if (removed?.url) URL.revokeObjectURL(removed.url);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleVideoChange = (e) => {
        const file = e.target.files?.[0] || null;
        setVideo(file);
        setVideoName(file?.name ?? '');
    };

    const handleMediaDrop = (e) => {
        e.preventDefault();
        setDraggingMedia(false);
        if (mediaFiles.length >= MAX_MEDIA) return;
        const files = Array.from(e.dataTransfer.files).filter(
            (f) => f.type.startsWith('image/') || isVideoFile(f),
        );
        addMediaFiles(files);
    };

    const handleVideoDrop = (e) => {
        e.preventDefault();
        setDraggingVideo(false);
        const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('video/'));
        if (!file) return;
        setVideo(file);
        setVideoName(file.name);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (processing) return;

        if (!productName.trim()) {
            setErrors({ product_name: 'Name is required.' });
            return;
        }
        if (!slug || slugStatus === 'checking') {
            setErrors({ slug: 'Wait for slug availability check.' });
            return;
        }

        setProcessing(true);
        setErrors({});

        let resolvedRetailers;
        try {
            resolvedRetailers = await resolveRetailerConflicts(retailers, setPendingConflict);
        } catch {
            setProcessing(false);
            return;
        }

        let qrBase64 = null;
        try {
            qrBase64 = await captureQrAsPng(qrRef.current?.svg);
        } catch {
            toast.error('Could not capture QR code. Please try again.');
            setProcessing(false);
            return;
        }

        const fd = new FormData();
        fd.append('product_name', productName.trim());
        fd.append('slug', slug);
        fd.append('notification_email', notificationEmail.trim());
        fd.append('product_description', description || '');
        fd.append('first_message', firstMessage.trim());
        fd.append('voice_id', voiceId.trim());
        if (pendingKbText.trim()) {
            fd.append('kb_text', pendingKbText.trim());
            fd.append('kb_name', pendingKbName.trim() || `${productName.trim()} — Knowledge Base`);
        }
        if (socialPosts.length > 0) {
            fd.append('social_posts', JSON.stringify(socialPosts));
        }
        if (qrBase64) fd.append('generated_qr_code_base64', qrBase64);
        if (resolvedRetailers.length > 0) {
            fd.append('retailers', JSON.stringify(resolvedRetailers));
        }
        mediaFiles.forEach((file, i) => fd.append(`images[${i}]`, file));
        shopifyImageUrls.forEach((url, i) => fd.append(`shopify_image_urls[${i}]`, url));
        if (video) fd.append('video', video);

        const hasShopifyImages = shopifyImageUrls.length > 0;
        const hasKb = pendingKbText.trim().length >= 100;

        const steps = [
            { id: 'save', label: 'Creating QR Company…', status: 'active' },
            ...(hasShopifyImages ? [{ id: 'images', label: `Uploading ${shopifyImageUrls.length} product image${shopifyImageUrls.length > 1 ? 's' : ''} to S3…`, status: 'active' }] : []),
            ...(hasKb ? [{ id: 'kb', label: 'Uploading knowledge base…', status: 'active' }] : []),
        ];
        setSaveProgress({ steps, error: null });

        router.post(route('product-qr-lists.store'), fd, {
            forceFormData: true,
            onError: (errs) => {
                setErrors(errs);
                setProcessing(false);
                setSaveProgress((p) => p ? {
                    ...p,
                    steps: p.steps.map((s) => ({ ...s, status: s.status === 'active' ? 'error' : s.status })),
                    error: 'Failed to save. Please check the form and try again.',
                } : null);
            },
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setSaveProgress((p) => p ? {
                    ...p,
                    steps: p.steps.map((s) => ({ ...s, status: 'done' })),
                } : null);
                setTimeout(() => {
                    setSaveProgress(null);
                    router.visit(route('product-qr-lists.index'));
                }, 1200);
            },
        });
    };

    const slugIndicator = () => {
        if (!slug) return null;
        if (slugStatus === 'checking')
            return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
        if (slugStatus === 'available')
            return <CheckCircle className="h-4 w-4 text-emerald-500" />;
        if (slugStatus === 'taken')
            return <XCircle className="h-4 w-4 text-amber-500" />;
        return null;
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Add QR Company
                </h2>
            }
        >
            <Head title="Add QR Company" />

            <div className="w-full pb-24">
                <form id="create-qr-form" onSubmit={handleSubmit}>
                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">

                    {/* ── Left column ── */}
                    <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-600 dark:bg-slate-800 md:p-8">
                        {/* AI banner */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-900/20">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                        Generate from product URL
                                    </h3>
                                    <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">
                                        Opens a GPT web-search modal. Nothing is saved until you submit this form.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAutoModal(true)}
                                    className="shrink-0 rounded-lg bg-[#b59100] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#9a7c00]"
                                >
                                    Automatic
                                </button>
                            </div>
                        </div>

                        {/* ── Top row: Name + Slug | inline QR ── */}
                        <div className="grid grid-cols-[1fr_auto] items-start gap-5">
                            <div className="space-y-5">
                                <div>
                                    <InputLabel htmlFor="product_name" value="Name *" />
                                    <input
                                        id="product_name"
                                        type="text"
                                        value={productName}
                                        onChange={handleNameChange}
                                        placeholder="e.g. Omega-3 Fish Oil 1000mg"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                                        autoFocus
                                    />
                                    <InputError message={errors.product_name} className="mt-1" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="slug" value="Slug" />
                                    <div className="mt-1 flex items-center gap-2">
                                        <input
                                            id="slug"
                                            type="text"
                                            readOnly
                                            value={slug}
                                            className="block w-full rounded-md border-gray-300 bg-gray-50 font-mono text-sm text-gray-600 shadow-sm dark:border-slate-500 dark:bg-slate-900/60 dark:text-slate-300"
                                        />
                                        <div className="shrink-0">{slugIndicator()}</div>
                                    </div>
                                    {slugStatus === 'available' && (
                                        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Slug is available.</p>
                                    )}
                                    {slugStatus === 'taken' && (
                                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                            Slug taken — auto-adjusted.
                                        </p>
                                    )}
                                    <InputError message={errors.slug} className="mt-1" />
                                </div>
                            </div>

                            {/* Inline QR */}
                            <div className="flex flex-col items-center gap-1 pt-6">
                                {qrUrl ? (
                                    <>
                                        <div className="rounded-md bg-white p-1.5">
                                            <ReactQRCode
                                                ref={qrRef}
                                                value={qrUrl}
                                                size={110}
                                                level="M"
                                                background="#ffffff"
                                                {...QR_SETTINGS}
                                            />
                                        </div>
                                        <p className="mt-0.5 text-[9px] text-gray-400 dark:text-slate-500">512 × 512 on save</p>
                                    </>
                                ) : (
                                    <div className="flex h-[110px] w-[110px] flex-col items-center justify-center gap-1 rounded-md border border-dashed border-gray-200 bg-gray-50 dark:border-slate-600 dark:bg-slate-700/30">
                                        <svg className="h-6 w-6 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                        </svg>
                                        <p className="text-[9px] text-gray-300 dark:text-slate-600">QR</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <div>
                            <InputLabel value="Description" />
                            <div className="mt-1">
                                <RichTextEditor
                                    value={description}
                                    onChange={setDescription}
                                    placeholder="Describe the company and its products — mission, product range, key benefits…"
                                />
                            </div>
                            <InputError message={errors.product_description} className="mt-1" />
                        </div>

                        {/* Social posts (populated from AI modal) */}
                        {socialPosts.length > 0 && (
                            <SocialPostsManager posts={socialPosts} onChange={setSocialPosts} />
                        )}

                        <div>
                            <InputLabel htmlFor="notification_email" value="Notification email (optional)" />
                            <input
                                id="notification_email"
                                type="email"
                                value={notificationEmail}
                                onChange={(e) => setNotificationEmail(e.target.value)}
                                placeholder="staff@example.com — receives an email when someone submits an enquiry"
                                autoComplete="email"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                            />
                            <InputError message={errors.notification_email} className="mt-1" />
                        </div>

                        {/* Product Media */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <InputLabel value={`Product Media (up to ${MAX_MEDIA})`} />
                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                    {mediaFiles.length} / {MAX_MEDIA}
                                </span>
                            </div>

                            {mediaPreviews.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-3">
                                    {mediaPreviews.map((item, i) => (
                                        <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm dark:border-slate-600 dark:bg-slate-700">
                                            {item.type === 'video' ? (
                                                <>
                                                    <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
                                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55">
                                                            <Film className="h-4 w-4 text-white" />
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <img src={item.url} alt="" className="h-full w-full object-cover" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => removeMediaItem(i)}
                                                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                                aria-label="Remove"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {mediaFiles.length < MAX_MEDIA && (
                                <label
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 transition ${
                                        draggingMedia
                                            ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-900/20'
                                            : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-slate-500 dark:bg-slate-700/50 dark:hover:border-indigo-400 dark:hover:bg-slate-700'
                                    }`}
                                    onDragOver={(e) => { e.preventDefault(); setDraggingMedia(true); }}
                                    onDragEnter={(e) => { e.preventDefault(); setDraggingMedia(true); }}
                                    onDragLeave={() => setDraggingMedia(false)}
                                    onDrop={handleMediaDrop}
                                >
                                    <ImagePlus className={`h-5 w-5 shrink-0 ${draggingMedia ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-300'}`} />
                                    <span className="text-sm text-gray-600 dark:text-slate-300">
                                        {draggingMedia ? 'Drop files here' : (
                                            <>
                                                Click or drag to add images or videos{' '}
                                                <span className="text-gray-400 dark:text-slate-500">· JPG, PNG, MP4, MOV, WebM · images max 10 MB, videos max 200 MB</span>
                                            </>
                                        )}
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska"
                                        multiple
                                        className="sr-only"
                                        onChange={handleMediaChange}
                                    />
                                </label>
                            )}
                            <InputError message={errors.images} className="mt-1" />

                            {/* Shopify images preview */}
                            {shopifyImageUrls.length > 0 && (
                                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                                            {shopifyImageUrls.length} Shopify image{shopifyImageUrls.length > 1 ? 's' : ''} will be saved
                                        </span>
                                        <button type="button" onClick={() => setShopifyImageUrls([])} className="text-xs text-emerald-600 hover:text-emerald-800 dark:text-emerald-400">
                                            Clear
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {shopifyImageUrls.map((url, i) => (
                                            <div key={i} className="group relative h-12 w-12 shrink-0">
                                                <img src={url} alt="" className="h-full w-full rounded object-cover" loading="lazy" />
                                                <button
                                                    type="button"
                                                    onClick={() => setShopifyImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                                                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow group-hover:flex"
                                                >
                                                    <span className="text-[9px] font-bold leading-none">✕</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Video */}
                        <div>
                            <InputLabel value="Product Video" />
                            <label
                                className={`mt-1 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 transition ${
                                    draggingVideo
                                        ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-900/20'
                                        : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-slate-500 dark:bg-slate-700/50 dark:hover:border-indigo-400 dark:hover:bg-slate-700'
                                }`}
                                onDragOver={(e) => { e.preventDefault(); setDraggingVideo(true); }}
                                onDragEnter={(e) => { e.preventDefault(); setDraggingVideo(true); }}
                                onDragLeave={() => setDraggingVideo(false)}
                                onDrop={handleVideoDrop}
                            >
                                <Video className={`h-5 w-5 shrink-0 ${draggingVideo ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-300'}`} />
                                <span className="min-w-0 flex-1 truncate text-sm text-gray-600 dark:text-slate-300">
                                    {draggingVideo ? 'Drop video here' : videoName || (
                                        <>
                                            Click or drag to upload video{' '}
                                            <span className="text-gray-400 dark:text-slate-500">· MP4, MOV, WebM · max 512 MB</span>
                                        </>
                                    )}
                                </span>
                                {video && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setVideo(null);
                                            setVideoName('');
                                        }}
                                        className="shrink-0"
                                        aria-label="Remove video"
                                    >
                                        <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                    </button>
                                )}
                                <input
                                    type="file"
                                    accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska"
                                    className="sr-only"
                                    onChange={handleVideoChange}
                                />
                            </label>
                            <InputError message={errors.video} className="mt-1" />
                        </div>
                    </div>{/* end left column */}

                    {/* ── Right column ── */}
                    <div className="space-y-6 lg:sticky lg:top-6">

                        {/* Retailers */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-600 dark:bg-slate-800">
                            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                Retailers
                            </h3>
                            <RetailersEditor
                                retailers={retailers}
                                onChange={setRetailers}
                                pendingConflict={pendingConflict}
                                setPendingConflict={setPendingConflict}
                            />
                        </div>

                        {/* Agent overrides */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-600 dark:bg-slate-800">
                            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                Agent overrides
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
                                        First message
                                    </label>
                                    <textarea
                                        value={firstMessage}
                                        onChange={(e) => setFirstMessage(e.target.value)}
                                        rows={3}
                                        maxLength={1000}
                                        placeholder="Override the agent's opening message for this product…"
                                        className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                                    />
                                    <InputError message={errors.first_message} className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
                                        Voice ID
                                    </label>
                                    <input
                                        type="text"
                                        value={voiceId}
                                        onChange={(e) => setVoiceId(e.target.value)}
                                        placeholder="ElevenLabs voice ID override"
                                        className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                                    />
                                    <InputError message={errors.voice_id} className="mt-1" />
                                </div>
                            </div>
                        </div>

                        {/* KB card — shows generated content or empty prompt */}
                        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-600 dark:bg-slate-800">
                            <div className="mb-3 flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-indigo-400" />
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                    Agent Knowledge Base
                                </h3>
                            </div>

                            {pendingKbText ? (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                                            KB content ready — will be uploaded to ElevenLabs automatically when you save.
                                        </p>
                                    </div>
                                    {pendingKbName && (
                                        <p className="font-mono text-[10px] text-gray-400 dark:text-slate-500">
                                            {pendingKbName}
                                        </p>
                                    )}
                                    <textarea
                                        readOnly
                                        value={pendingKbText}
                                        rows={5}
                                        className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setPendingKbText(''); setPendingKbName(''); }}
                                        className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                                    >
                                        Remove KB content
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400 dark:text-slate-500">
                                    Use <strong className="text-amber-700 dark:text-amber-400">Automatic</strong> above to generate KB content. It will be uploaded to ElevenLabs when you save the product.
                                </p>
                            )}
                        </div>

                    </div>{/* end right column */}

                    </div>{/* end grid */}
                </form>
            </div>

            {/* Sticky bottom action bar */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
                <div className="flex w-full items-center justify-end gap-3 px-4 py-3 lg:px-8">
                    <PrimaryButton
                        form="create-qr-form"
                        type="submit"
                        disabled={processing || slugStatus === 'checking'}
                    >
                        {processing ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving…
                            </span>
                        ) : (
                            'Save QR Company'
                        )}
                    </PrimaryButton>
                </div>
            </div>

            <ProductContentExtractorModal
                show={showAutoModal}
                onClose={() => setShowAutoModal(false)}
                onApply={(result) => {
                    // Company name → fills the QR listing name
                    if (result?.name?.company_name) {
                        const name = result.name.company_name;
                        setProductName(name);
                        const raw = toSlug(name);
                        setSlug(raw);
                        if (raw) { setSlugStatus('checking'); checkSlug(raw); }
                    }
                    // Company description → fills the description field
                    if (result?.description) setDescription(result.description);
                    // Social posts
                    if (result?.social_links?.length) {
                        setSocialPosts(result.social_links.map((p) => ({ ...p, active: true })));
                    }
                    // Knowledge base content
                    if (result?.about) {
                        setPendingKbText(result.about);
                        const slugPart = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                        const now = new Date();
                        const date = now.toISOString().slice(0, 10);
                        const time = now.toTimeString().slice(0, 5).replace(':', '-');
                        setPendingKbName(`${slugPart(result.name?.company_name)}-KB-${date}-${time}`);
                    }
                    // Shopify selected images
                    if (result?.shopify_image_urls?.length) {
                        setShopifyImageUrls(result.shopify_image_urls);
                    }
                }}
            />

            {/* ── Save progress modal ── */}
            {saveProgress && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                            Creating QR Company
                        </h3>

                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-900/20">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                Do not refresh the page — please wait until all steps complete.
                            </p>
                        </div>

                        <ul className="mt-5 space-y-3">
                            {saveProgress.steps.map((step) => (
                                <li key={step.id} className="flex items-center gap-3">
                                    {step.status === 'active'  && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" />}
                                    {step.status === 'done'    && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                                    {step.status === 'error'   && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                                    {step.status === 'pending' && <span className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300 dark:border-slate-600" />}
                                    <span className={`text-sm ${
                                        step.status === 'active'  ? 'font-medium text-gray-900 dark:text-slate-100' :
                                        step.status === 'done'    ? 'text-emerald-700 dark:text-emerald-400' :
                                        step.status === 'error'   ? 'text-red-600 dark:text-red-400' :
                                        'text-gray-400 dark:text-slate-500'
                                    }`}>
                                        {step.status === 'done' ? step.label.replace('…', ' ✓') : step.label}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {!saveProgress.error && saveProgress.steps.every((s) => s.status === 'done') && (
                            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                                All done — redirecting…
                            </p>
                        )}

                        {saveProgress.error && (
                            <div className="mt-4 space-y-3">
                                <p className="text-sm text-red-600 dark:text-red-400">{saveProgress.error}</p>
                                <button
                                    type="button"
                                    onClick={() => setSaveProgress(null)}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                >
                                    Dismiss
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
