import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import KnowledgeBaseCard from '@/Components/Admin/KnowledgeBaseCard';
import ProductContentExtractorModal from '@/Components/Admin/ProductContentExtractorModal';
import RetailersEditor, { resolveRetailerConflicts } from '@/Components/Admin/RetailersEditor';
import SocialPostsManager from '@/Components/Admin/SocialPostsManager';
import RichTextEditor from '@/Components/RichTextEditor';
import { Head, Link, router } from '@inertiajs/react';
import { ReactQRCode } from '@lglab/react-qr-code';
import axios from 'axios';
import { AlertTriangle, CheckCircle, CheckCircle2, Film, ImagePlus, Loader2, Video, X, XCircle } from 'lucide-react';
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

function isVideoUrl(url) {
    if (!url) return false;
    const path = url.split('?')[0].toLowerCase();
    return /\.(mp4|mov|avi|webm|mkv|m4v|ogv)(\b|$)/.test(path);
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
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
    });
}

function hydrateRetailers(raw) {
    return (raw ?? []).map((r) => ({
        ...r,
        _localId: crypto.randomUUID(),
        _originalActions: r.actions ? JSON.parse(JSON.stringify(r.actions)) : [],
    }));
}

export default function Edit({ product }) {
    const qrRef = useRef(null);
    const slugTimerRef = useRef(null);

    const [productName, setProductName] = useState(product.product_name ?? '');
    const [description, setDescription] = useState(product.product_description ?? '');
    const [retailers, setRetailers] = useState(() => hydrateRetailers(product.retailers));
    const [pendingConflict, setPendingConflict] = useState(null);

    // Canonical URLs stored in DB (sent back as existing_images on save)
    const [existingImages, setExistingImages] = useState(() => [...(product.product_images ?? [])]);
    // Signed URLs for <img src> (private S3), aligned by index with existingImages
    const [existingImageDisplaySrc, setExistingImageDisplaySrc] = useState(() => {
        const canonical = product.product_images ?? [];
        const signed = product.signed_product_images ?? [];
        return canonical.map((url, i) => (typeof signed[i] === 'string' ? signed[i] : url));
    });
    const [pendingRemoveIdx, setPendingRemoveIdx] = useState(null);
    const [shopifyImageUrls, setShopifyImageUrls] = useState([]); // external CDN URLs from Shopify picker
    // New files to upload
    const [newMediaFiles, setNewMediaFiles] = useState([]); // File[]
    const [newMediaPreviews, setNewMediaPreviews] = useState([]); // {url, type}[]
    const newMediaObjectUrlsRef = useRef([]);

    // Revoke new-file object URLs on unmount
    useEffect(() => () => { newMediaObjectUrlsRef.current.forEach(URL.revokeObjectURL); }, []);

    const existingVideoUrl = product.video_url ?? null;
    /** True after user confirms delete; video is removed from S3 on save unless a new file is uploaded. */
    const [videoRemovedPending, setVideoRemovedPending] = useState(false);
    const [pendingVideoDelete, setPendingVideoDelete] = useState(false);
    const [video, setVideo] = useState(null);
    const [videoName, setVideoName] = useState('');
    const [notificationEmail, setNotificationEmail] = useState(product.notification_email ?? '');

    const [socialPosts, setSocialPosts] = useState(() =>
        (product.social_posts ?? []).map((p) => ({ ...p, active: p.active ?? true }))
    );
    const [firstMessage, setFirstMessage] = useState(product.first_message ?? '');
    const [voiceId, setVoiceId] = useState(product.voice_id ?? '');
    const [pendingKbText, setPendingKbText] = useState('');
    const [pendingKbName, setPendingKbName] = useState('');
    const kbCardRef = useRef(null);

    // Save progress modal
    const [saveProgress, setSaveProgress] = useState(null);
    // null = closed | { steps: [{label, status}], error: string|null }

    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [draggingMedia, setDraggingMedia] = useState(false);
    const [draggingVideo, setDraggingVideo] = useState(false);
    const [showAutoModal, setShowAutoModal] = useState(false);

    const [slug, setSlug] = useState(product.slug ?? '');
    const [slugStatus, setSlugStatus] = useState(() => (product.slug ? 'available' : 'empty'));

    const qrUrl = slug ? `${window.location.origin}/product/${slug}` : '';

    const checkSlug = useCallback(
        async (rawSlug) => {
            if (!rawSlug?.trim()) {
                setSlugStatus('empty');
                setSlug('');
                return;
            }
            setSlugStatus('checking');
            try {
                const { data } = await axios.get(route('product-qr-lists.check-slug'), {
                    params: { slug: rawSlug, ignore_id: product.id },
                });
                setSlug(data.slug);
                setSlugStatus(data.available ? 'available' : 'taken');
                if (!data.available) {
                    toast(`Slug adjusted to: ${data.slug}`, { icon: 'ℹ️', duration: 3000 });
                }
            } catch {
                setSlugStatus('idle');
            }
        },
        [product.id],
    );

    const handleSlugChange = (e) => {
        const v = e.target.value;
        setSlug(v);
        if (!v.trim()) {
            setSlugStatus('empty');
            if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
            return;
        }
        setSlugStatus('checking');
        if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
        slugTimerRef.current = setTimeout(() => checkSlug(v), 450);
    };

    useEffect(
        () => () => {
            if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
        },
        [],
    );

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

    const totalMedia = existingImages.length + newMediaFiles.length;

    const addNewMediaFiles = (files) => {
        const remaining = MAX_MEDIA - totalMedia;
        const toAdd = files.slice(0, remaining);
        if (!toAdd.length) return;
        const previews = toAdd.map((file) => {
            const url = URL.createObjectURL(file);
            newMediaObjectUrlsRef.current.push(url);
            return { url, type: isVideoFile(file) ? 'video' : 'image' };
        });
        setNewMediaFiles((prev) => [...prev, ...toAdd]);
        setNewMediaPreviews((prev) => [...prev, ...previews]);
    };

    const handleNewMediaChange = (e) => {
        addNewMediaFiles(Array.from(e.target.files || []));
        e.target.value = '';
    };

    const removeExistingImage = (index) => {
        setExistingImages((prev) => prev.filter((_, i) => i !== index));
        setExistingImageDisplaySrc((prev) => prev.filter((_, i) => i !== index));
        setPendingRemoveIdx(null);
    };

    const removeNewMedia = (index) => {
        setNewMediaFiles((prev) => prev.filter((_, i) => i !== index));
        setNewMediaPreviews((prev) => {
            const removed = prev[index];
            if (removed?.url) URL.revokeObjectURL(removed.url);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleVideoChange = (e) => {
        const file = e.target.files?.[0] || null;
        setVideo(file);
        setVideoName(file?.name ?? '');
        if (file) {
            setVideoRemovedPending(false);
        }
    };

    const handleMediaDrop = (e) => {
        e.preventDefault();
        setDraggingMedia(false);
        if (totalMedia >= MAX_MEDIA) return;
        const files = Array.from(e.dataTransfer.files).filter(
            (f) => f.type.startsWith('image/') || isVideoFile(f),
        );
        addNewMediaFiles(files);
    };

    const handleVideoDrop = (e) => {
        e.preventDefault();
        setDraggingVideo(false);
        const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('video/'));
        if (!file) return;
        setVideo(file);
        setVideoName(file.name);
        setVideoRemovedPending(false);
    };

    const handleSubmit = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (processing) return;

        if (!productName.trim()) {
            setErrors({ product_name: 'Name is required.' });
            return;
        }
        if (!slug || slugStatus === 'checking') {
            setErrors({ slug: slugStatus === 'checking' ? 'Wait for slug availability check.' : 'Slug is required.' });
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
        fd.append('_method', 'PATCH');
        fd.append('product_name', productName.trim());
        fd.append('slug', slug);
        fd.append('notification_email', notificationEmail.trim());
        fd.append('product_description', description || '');
        fd.append('first_message', firstMessage.trim());
        fd.append('voice_id', voiceId.trim());
        if (socialPosts.length > 0) {
            fd.append('social_posts', JSON.stringify(socialPosts));
        }
        if (qrBase64) fd.append('generated_qr_code_base64', qrBase64);
        if (resolvedRetailers.length > 0) {
            fd.append('retailers', JSON.stringify(resolvedRetailers));
        }

        existingImages.forEach((url, i) => fd.append(`existing_images[${i}]`, url));
        newMediaFiles.forEach((file, i) => fd.append(`images[${i}]`, file));
        shopifyImageUrls.forEach((url, i) => fd.append(`shopify_image_urls[${i}]`, url));
        if (video) {
            fd.append('video', video);
        } else if (videoRemovedPending) {
            fd.append('remove_video', '1');
        }

        const hasKb = kbCardRef.current?.hasPendingContent() ?? false;

        const steps = [
            { id: 'save', label: 'Saving company details…', status: 'active' },
            ...(hasKb ? [{ id: 'kb', label: 'Uploading knowledge base…', status: 'pending' }] : []),
        ];
        setSaveProgress({ steps, error: null });

        router.post(route('product-qr-lists.update', product.id), fd, {
            forceFormData: true,
            onError: (errs) => {
                setErrors(errs);
                setProcessing(false);
                setSaveProgress((p) => p ? {
                    ...p,
                    steps: p.steps.map((s) => s.id === 'save' ? { ...s, status: 'error' } : s),
                    error: 'Failed to save. Please check the form and try again.',
                } : null);
            },
            onFinish: () => setProcessing(false),
            onSuccess: async () => {
                // Mark save step done
                setSaveProgress((p) => p ? {
                    ...p,
                    steps: p.steps.map((s) => s.id === 'save' ? { ...s, status: 'done' } : s),
                } : null);

                if (hasKb && kbCardRef.current) {
                    setSaveProgress((p) => p ? {
                        ...p,
                        steps: p.steps.map((s) => s.id === 'kb' ? { ...s, status: 'active' } : s),
                    } : null);
                    try {
                        await kbCardRef.current.upload();
                        setSaveProgress((p) => p ? {
                            ...p,
                            steps: p.steps.map((s) => s.id === 'kb' ? { ...s, status: 'done' } : s),
                        } : null);
                    } catch (err) {
                        setSaveProgress((p) => p ? {
                            ...p,
                            steps: p.steps.map((s) => s.id === 'kb' ? { ...s, status: 'error' } : s),
                            error: `Knowledge base upload failed: ${err?.message ?? 'Unknown error'}`,
                        } : null);
                        return;
                    }
                }

                // All done — short pause then go to index
                setTimeout(() => {
                    setSaveProgress(null);
                    router.visit(route('product-qr-lists.index'));
                }, 1200);
            },
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Edit QR Company
                </h2>
            }
        >
            <Head title="Edit QR Company" />

            <div className="w-full pb-24">
                <form id="product-qr-form" onSubmit={handleSubmit}>
                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
                    <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-600 dark:bg-slate-800 md:p-8">
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-900/20">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                        Start manually or generate from product URL
                                    </h3>
                                    <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">
                                        Automatic opens a temporary GPT web-search modal. Nothing is saved until you submit this product form.
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAutoModal(true)}
                                        className="rounded-lg bg-[#b59100] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#9a7c00]"
                                    >
                                        Automatic
                                    </button>
                                </div>
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
                                        onChange={(e) => setProductName(e.target.value)}
                                        placeholder="e.g. Omega-3 Fish Oil 1000mg"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                                        autoFocus
                                    />
                                    <InputError message={errors.product_name} className="mt-1" />
                                </div>

                                <div>
                                    <InputLabel htmlFor="slug" value="Slug *" />
                                    <div className="mt-1 flex items-center gap-2">
                                        <input
                                            id="slug"
                                            type="text"
                                            value={slug}
                                            onChange={handleSlugChange}
                                            placeholder="e.g. omega-3-fish-oil"
                                            className="block w-full rounded-md border-gray-300 font-mono text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                                        />
                                        <div className="shrink-0">{slugIndicator()}</div>
                                    </div>
                                    {slugStatus === 'available' && slug ? (
                                        <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Slug is available.</p>
                                    ) : null}
                                    {slugStatus === 'taken' ? (
                                        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                            Slug taken — auto-adjusted.
                                        </p>
                                    ) : null}
                                    <InputError message={errors.slug} className="mt-1" />
                                    <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                                        Used in the public URL and QR code. Changing it moves files on storage and updates the
                                        link — reprint QR codes that are already in the field.
                                    </p>
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
                                        <p className="text-[9px] text-gray-400 dark:text-slate-500">Enter a slug</p>
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

                        {/* Social posts */}
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

                        {/* Product Media (images + videos) */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <InputLabel value={`Product Media (up to ${MAX_MEDIA})`} />
                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                    {totalMedia} / {MAX_MEDIA}
                                </span>
                            </div>

                            {(existingImages.length > 0 || newMediaPreviews.length > 0) && (
                                <div className="mb-3 flex flex-wrap gap-3">
                                    {existingImages.map((canonicalUrl, i) => {
                                        const displaySrc = existingImageDisplaySrc[i] ?? canonicalUrl;
                                        const isVid = isVideoUrl(displaySrc);
                                        return (
                                            <div key={canonicalUrl || `existing-${i}`} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm dark:border-slate-600 dark:bg-slate-700">
                                                {isVid ? (
                                                    <>
                                                        <video src={displaySrc} muted preload="metadata" className="h-full w-full object-cover" />
                                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55">
                                                                <Film className="h-4 w-4 text-white" />
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <img src={displaySrc} alt="" className="h-full w-full object-cover" />
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setPendingRemoveIdx(i)}
                                                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                                    aria-label="Remove"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {newMediaPreviews.map((item, i) => (
                                        <div key={`new-${i}`} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-indigo-200 bg-gray-50 shadow-sm dark:border-indigo-700 dark:bg-slate-700">
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
                                            <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/70 py-0.5 text-center text-[9px] text-white">new</span>
                                            <button
                                                type="button"
                                                onClick={() => removeNewMedia(i)}
                                                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                                aria-label="Remove"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {totalMedia < MAX_MEDIA && (
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
                                        onChange={handleNewMediaChange}
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

                            {existingVideoUrl && !videoRemovedPending && !video ? (
                                <div className="mt-1 space-y-3">
                                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-700/40">
                                        <Video className="h-5 w-5 shrink-0 text-gray-400 dark:text-slate-400" />
                                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-600 dark:text-slate-300">
                                            {existingVideoUrl.split('/').pop()?.split('?')[0]}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setPendingVideoDelete(true)}
                                            className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                        >
                                            Delete video
                                        </button>
                                    </div>
                                    {product.signed_video_url && (
                                        <video
                                            src={product.signed_video_url}
                                            controls
                                            className="max-h-52 w-full rounded-lg border border-gray-200 dark:border-slate-600"
                                        />
                                    )}
                                </div>
                            ) : (
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
                                    <span className="min-w-0 flex-1 text-sm text-gray-600 dark:text-slate-300">
                                        {draggingVideo ? (
                                            'Drop video here'
                                        ) : videoName ? (
                                            <span className="block truncate">{videoName}</span>
                                        ) : (
                                            <>
                                                {videoRemovedPending && (
                                                    <span className="mb-1 block text-xs font-medium text-amber-600 dark:text-amber-400">
                                                        Current video will be removed when you save. Add a new file (optional).
                                                    </span>
                                                )}
                                                <span>
                                                    Click or drag to upload video{' '}
                                                    <span className="text-gray-400 dark:text-slate-500">· MP4, MOV, WebM · max 512 MB</span>
                                                </span>
                                            </>
                                        )}
                                    </span>
                                    {video ? (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setVideo(null);
                                                setVideoName('');
                                            }}
                                            className="shrink-0"
                                            aria-label="Clear selected video"
                                        >
                                            <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
                                        </button>
                                    ) : null}
                                    <input
                                        type="file"
                                        accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska"
                                        className="sr-only"
                                        onChange={handleVideoChange}
                                    />
                                </label>
                            )}
                            <InputError message={errors.video} className="mt-1" />
                        </div>

                    </div>{/* end left column card */}

                    {/* Right column — Retailers + Knowledge Base (sticky) */}
                    <div className="space-y-6 lg:sticky lg:top-6">
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

                        <KnowledgeBaseCard
                            ref={kbCardRef}
                            product={product}
                            initialText={pendingKbText || undefined}
                            initialKbName={pendingKbName || undefined}
                            hideUploadButton
                            onTextChange={setPendingKbText}
                        />
                    </div>

                    </div>{/* end grid */}
                </form>
            </div>

            {/* Sticky bottom action bar */}
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
                <div className="flex w-full items-center justify-end gap-3 px-4 py-3 lg:px-8">
                    <Link
                        href={route('product-qr-lists.index')}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        form="product-qr-form"
                        disabled={processing}
                        className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                    >
                        {processing ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Saving…
                            </>
                        ) : (
                            'Update QR Company'
                        )}
                    </button>
                </div>
            </div>
            {/* ── Confirm remove existing image ── */}
            {pendingRemoveIdx !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                            <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-slate-100">
                            Remove this file?
                        </h3>
                        <p className="mb-5 text-sm text-gray-500 dark:text-slate-400">
                            This file will be <strong className="text-gray-700 dark:text-slate-200">permanently deleted from storage</strong> when you save the form. This cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setPendingRemoveIdx(null)}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => removeExistingImage(pendingRemoveIdx)}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                            >
                                Yes, remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pendingVideoDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                            <Video className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-slate-100">
                            Delete this video?
                        </h3>
                        <p className="mb-5 text-sm text-gray-500 dark:text-slate-400">
                            The video file will be <strong className="text-gray-700 dark:text-slate-200">permanently removed from storage</strong> when you save. You can upload a new one afterward if you like.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setPendingVideoDelete(false)}
                                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setVideoRemovedPending(true);
                                    setVideo(null);
                                    setVideoName('');
                                    setPendingVideoDelete(false);
                                }}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                            >
                                Yes, delete video
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ProductContentExtractorModal
                show={showAutoModal}
                onClose={() => setShowAutoModal(false)}
                onApply={(result) => {
                    // Company name → fills the QR listing name
                    if (result?.name?.company_name) setProductName(result.name.company_name);
                    // Company description → fills the description field
                    if (result?.description) setDescription(result.description);
                    // Social posts — merge with existing, skip duplicates
                    if (result?.social_links?.length) {
                        setSocialPosts((prev) => {
                            const existingUrls = new Set(prev.map((p) => p.post_url));
                            const newPosts = result.social_links
                                .filter((p) => !existingUrls.has(p.post_url))
                                .map((p) => ({ ...p, active: true }));
                            return [...prev, ...newPosts];
                        });
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
                            Saving changes
                        </h3>

                        {/* Warning */}
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-900/20">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                Do not refresh the page — please wait until all steps complete.
                            </p>
                        </div>

                        {/* Steps */}
                        <ul className="mt-5 space-y-3">
                            {saveProgress.steps.map((step) => (
                                <li key={step.id} className="flex items-center gap-3">
                                    {step.status === 'active' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" />}
                                    {step.status === 'done'   && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />}
                                    {step.status === 'error'  && <XCircle className="h-4 w-4 shrink-0 text-red-500" />}
                                    {step.status === 'pending' && <span className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300 dark:border-slate-600" />}
                                    <span className={`text-sm ${
                                        step.status === 'active'  ? 'font-medium text-gray-900 dark:text-slate-100' :
                                        step.status === 'done'    ? 'text-emerald-700 dark:text-emerald-400' :
                                        step.status === 'error'   ? 'text-red-600 dark:text-red-400' :
                                        'text-gray-400 dark:text-slate-500'
                                    }`}>
                                        {step.status === 'done'
                                            ? step.label.replace('…', ' ✓').replace('Saving company details…', 'Company details saved').replace('Uploading knowledge base…', 'Knowledge base uploaded')
                                            : step.label}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        {/* All done */}
                        {!saveProgress.error && saveProgress.steps.every((s) => s.status === 'done') && (
                            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                                All done — redirecting…
                            </p>
                        )}

                        {/* Error */}
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
