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
    const [images, setImages] = useState([]); // File[]
    const [imagePreviews, setImagePreviews] = useState([]); // data URL[]
    const [video, setVideo] = useState(null);
    const [videoName, setVideoName] = useState('');
    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);
    const [draggingImages, setDraggingImages] = useState(false);
    const [draggingVideo, setDraggingVideo] = useState(false);

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

    const handleImagesChange = (e) => {
        const files = Array.from(e.target.files || []);
        const remaining = MAX_IMAGES - images.length;
        const toAdd = files.slice(0, remaining);
        if (!toAdd.length) return;

        const newImages = [...images, ...toAdd];
        setImages(newImages);

        toAdd.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) =>
                setImagePreviews((prev) => [...prev, ev.target.result]);
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const removeImage = (index) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
        setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    };

    const handleVideoChange = (e) => {
        const file = e.target.files?.[0] || null;
        setVideo(file);
        setVideoName(file?.name ?? '');
    };

    const handleImagesDrop = (e) => {
        e.preventDefault();
        setDraggingImages(false);
        if (images.length >= MAX_IMAGES) return;
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        const remaining = MAX_IMAGES - images.length;
        const toAdd = files.slice(0, remaining);
        setImages((prev) => [...prev, ...toAdd]);
        toAdd.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) => setImagePreviews((prev) => [...prev, ev.target.result]);
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
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (processing) return;

        if (!productName.trim()) {
            setErrors({ product_name: 'Product name is required.' });
            return;
        }
        if (!slug || slugStatus === 'checking') {
            setErrors({ slug: 'Wait for slug availability check.' });
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
        fd.append('product_name', productName.trim());
        fd.append('slug', slug);
        fd.append('product_description', description || '');
        if (qrBase64) fd.append('generated_qr_code_base64', qrBase64);
        images.forEach((file, i) => fd.append(`images[${i}]`, file));
        if (video) fd.append('video', video);

        router.post(route('product-qr-lists.store'), fd, {
            forceFormData: true,
            onError: (errs) => {
                setErrors(errs);
                setProcessing(false);
            },
            onFinish: () => setProcessing(false),
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
                    Add product QR
                </h2>
            }
        >
            <Head title="Add Product QR" />

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

                            {/* Inline QR — no inner card, just the code itself */}
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
                                    {images.length} / {MAX_IMAGES}
                                </span>
                            </div>

                            {imagePreviews.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-3">
                                    {imagePreviews.map((src, i) => (
                                        <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm dark:border-slate-600 dark:bg-slate-700">
                                            <img src={src} alt="" className="h-full w-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => removeImage(i)}
                                                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                                aria-label="Remove image"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {images.length < MAX_IMAGES && (
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
                                                Click or drag to add image{images.length < MAX_IMAGES - 1 ? 's' : ''}{' '}
                                                <span className="text-gray-400 dark:text-slate-500">· JPG, PNG, WebP · max 10 MB each</span>
                                            </>
                                        )}
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="sr-only"
                                        onChange={handleImagesChange}
                                    />
                                </label>
                            )}
                            <InputError message={errors.images} className="mt-1" />
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

                        <div className="flex justify-end pt-2">
                            <PrimaryButton disabled={processing || slugStatus === 'checking'}>
                                {processing ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving…
                                    </span>
                                ) : (
                                    'Save product QR'
                                )}
                            </PrimaryButton>
                        </div>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
