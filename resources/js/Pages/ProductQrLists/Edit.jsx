import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import RichTextEditor from '@/Components/RichTextEditor';
import { Head, router } from '@inertiajs/react';
import { ReactQRCode } from '@lglab/react-qr-code';
import axios from 'axios';
import { CheckCircle, ImagePlus, Loader2, Video, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const QR_SETTINGS = {
    dataModulesSettings: { style: 'rounded' },
    finderPatternOuterSettings: { style: 'rounded-sm' },
    finderPatternInnerSettings: { style: 'rounded-sm' },
};
const MAX_IMAGES = 5;

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

export default function Edit({ product }) {
    const qrRef = useRef(null);
    const slugTimerRef = useRef(null);

    const [productName, setProductName] = useState(product.product_name ?? '');
    const [description, setDescription] = useState(product.product_description ?? '');

    // Canonical URLs stored in DB (sent back as existing_images on save)
    const [existingImages, setExistingImages] = useState(() => [...(product.product_images ?? [])]);
    // Signed URLs for <img src> (private S3), aligned by index with existingImages
    const [existingImageDisplaySrc, setExistingImageDisplaySrc] = useState(() => {
        const canonical = product.product_images ?? [];
        const signed = product.signed_product_images ?? [];
        return canonical.map((url, i) => (typeof signed[i] === 'string' ? signed[i] : url));
    });
    const [pendingRemoveIdx, setPendingRemoveIdx] = useState(null);
    // New files to upload
    const [newImages, setNewImages] = useState([]);
    const [newImagePreviews, setNewImagePreviews] = useState([]);

    const existingVideoUrl = product.video_url ?? null;
    /** True after user confirms delete; video is removed from S3 on save unless a new file is uploaded. */
    const [videoRemovedPending, setVideoRemovedPending] = useState(false);
    const [pendingVideoDelete, setPendingVideoDelete] = useState(false);
    const [video, setVideo] = useState(null);
    const [videoName, setVideoName] = useState('');

    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [draggingImages, setDraggingImages] = useState(false);
    const [draggingVideo, setDraggingVideo] = useState(false);

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

    const totalImages = existingImages.length + newImages.length;

    const handleNewImagesChange = (e) => {
        const files = Array.from(e.target.files || []);
        const remaining = MAX_IMAGES - totalImages;
        const toAdd = files.slice(0, remaining);
        if (!toAdd.length) return;

        setNewImages((prev) => [...prev, ...toAdd]);
        toAdd.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) =>
                setNewImagePreviews((prev) => [...prev, ev.target.result]);
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const removeExistingImage = (index) => {
        setExistingImages((prev) => prev.filter((_, i) => i !== index));
        setExistingImageDisplaySrc((prev) => prev.filter((_, i) => i !== index));
        setPendingRemoveIdx(null);
    };

    const removeNewImage = (index) => {
        setNewImages((prev) => prev.filter((_, i) => i !== index));
        setNewImagePreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleVideoChange = (e) => {
        const file = e.target.files?.[0] || null;
        setVideo(file);
        setVideoName(file?.name ?? '');
        if (file) {
            setVideoRemovedPending(false);
        }
    };

    const handleImagesDrop = (e) => {
        e.preventDefault();
        setDraggingImages(false);
        if (totalImages >= MAX_IMAGES) return;
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        const remaining = MAX_IMAGES - totalImages;
        const toAdd = files.slice(0, remaining);
        setNewImages((prev) => [...prev, ...toAdd]);
        toAdd.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) => setNewImagePreviews((prev) => [...prev, ev.target.result]);
            reader.readAsDataURL(file);
        });
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
        e.preventDefault();
        if (processing) return;

        if (!productName.trim()) {
            setErrors({ product_name: 'Product name is required.' });
            return;
        }
        if (!slug || slugStatus === 'checking') {
            setErrors({ slug: slugStatus === 'checking' ? 'Wait for slug availability check.' : 'Slug is required.' });
            return;
        }

        setProcessing(true);
        setErrors({});

        let qrBase64 = null;
        try {
            qrBase64 = await captureQrAsPng(qrRef.current?.svg);
        } catch {
            toast.error('Could not capture QR code. Please try again.');
            setProcessing(false);
            return;
        }

        const fd = new FormData();
        fd.append('_method', 'PUT');
        fd.append('product_name', productName.trim());
        fd.append('slug', slug);
        fd.append('product_description', description || '');
        if (qrBase64) fd.append('generated_qr_code_base64', qrBase64);

        existingImages.forEach((url, i) => fd.append(`existing_images[${i}]`, url));
        newImages.forEach((file, i) => fd.append(`images[${i}]`, file));
        if (video) {
            fd.append('video', video);
        } else if (videoRemovedPending) {
            fd.append('remove_video', '1');
        }

        router.post(route('product-qr-lists.update', product.id), fd, {
            forceFormData: true,
            onError: (errs) => {
                setErrors(errs);
                setProcessing(false);
            },
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Edit product QR
                </h2>
            }
        >
            <Head title="Edit Product QR" />

            <div className="mx-auto w-full max-w-4xl">
                <form onSubmit={handleSubmit}>
                    <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-600 dark:bg-slate-800 md:p-8">

                        {/* ── Top row: Name + Slug | inline QR ── */}
                        <div className="grid grid-cols-[1fr_auto] items-start gap-5">
                            <div className="space-y-5">
                                <div>
                                    <InputLabel htmlFor="product_name" value="Product Name *" />
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
                            <InputLabel value="Product Description" />
                            <div className="mt-1">
                                <RichTextEditor
                                    value={description}
                                    onChange={setDescription}
                                    placeholder="Describe the product — ingredients, benefits, retailer notes…"
                                />
                            </div>
                            <InputError message={errors.product_description} className="mt-1" />
                        </div>

                        {/* Product Images */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <InputLabel value={`Product Images (up to ${MAX_IMAGES})`} />
                                <span className="text-xs text-gray-500 dark:text-slate-400">
                                    {totalImages} / {MAX_IMAGES}
                                </span>
                            </div>

                            {(existingImages.length > 0 || newImagePreviews.length > 0) && (
                                <div className="mb-3 flex flex-wrap gap-3">
                                    {existingImages.map((canonicalUrl, i) => (
                                        <div key={canonicalUrl || `existing-${i}`} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm dark:border-slate-600 dark:bg-slate-700">
                                            <img src={existingImageDisplaySrc[i] ?? canonicalUrl} alt="" className="h-full w-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setPendingRemoveIdx(i)}
                                                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                                aria-label="Remove image"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {newImagePreviews.map((src, i) => (
                                        <div key={`new-${i}`} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-indigo-200 bg-gray-50 shadow-sm dark:border-indigo-700 dark:bg-slate-700">
                                            <img src={src} alt="" className="h-full w-full object-cover" />
                                            <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/70 py-0.5 text-center text-[9px] text-white">new</span>
                                            <button
                                                type="button"
                                                onClick={() => removeNewImage(i)}
                                                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                                aria-label="Remove image"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {totalImages < MAX_IMAGES && (
                                <label
                                    className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 transition ${
                                        draggingImages
                                            ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-900/20'
                                            : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-slate-500 dark:bg-slate-700/50 dark:hover:border-indigo-400 dark:hover:bg-slate-700'
                                    }`}
                                    onDragOver={(e) => { e.preventDefault(); setDraggingImages(true); }}
                                    onDragEnter={(e) => { e.preventDefault(); setDraggingImages(true); }}
                                    onDragLeave={() => setDraggingImages(false)}
                                    onDrop={handleImagesDrop}
                                >
                                    <ImagePlus className={`h-5 w-5 ${draggingImages ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-300'}`} />
                                    <span className="text-sm text-gray-600 dark:text-slate-300">
                                        {draggingImages ? 'Drop images here' : (
                                            <>
                                                Click or drag to add image{totalImages < MAX_IMAGES - 1 ? 's' : ''}{' '}
                                                <span className="text-gray-400 dark:text-slate-500">· JPG, PNG, WebP · max 10 MB each</span>
                                            </>
                                        )}
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="sr-only"
                                        onChange={handleNewImagesChange}
                                    />
                                </label>
                            )}
                            <InputError message={errors.images} className="mt-1" />
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

                        <div className="flex justify-end pt-2">
                            <PrimaryButton disabled={processing}>
                                {processing ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving…
                                    </span>
                                ) : (
                                    'Update product QR'
                                )}
                            </PrimaryButton>
                        </div>
                    </div>
                </form>
            </div>
            {/* ── Confirm remove existing image ── */}
            {pendingRemoveIdx !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
                        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                            <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                        </div>
                        <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-slate-100">
                            Remove this image?
                        </h3>
                        <p className="mb-5 text-sm text-gray-500 dark:text-slate-400">
                            This image will be <strong className="text-gray-700 dark:text-slate-200">permanently deleted from storage</strong> when you save the form. This cannot be undone.
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
        </AuthenticatedLayout>
    );
}
