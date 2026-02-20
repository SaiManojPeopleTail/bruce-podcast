import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import RichTextEditor from '@/Components/RichTextEditor';
import TextInput from '@/Components/TextInput';
import { Head, useForm } from '@inertiajs/react';
import axios from 'axios';
import * as tus from 'tus-js-client';
import { useRef, useState } from 'react';

const UPLOAD_STALL_TIMEOUT_MS = 90_000;

function slugify(title) {
    if (!title || typeof title !== 'string') return '';
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function formatDateTimeForInput(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 16);
}

function nowDateTimeISO() {
    return new Date().toISOString().slice(0, 16);
}

export default function Edit({ brand, video }) {
    const { data, setData, patch, errors, setError, clearErrors } = useForm({
        title: video?.title ?? '',
        slug: video?.slug ?? '',
        short_description: video?.short_description ?? '',
        long_description: video?.long_description ?? '',
        bunny_video_id: video?.bunny_video_id ?? '',
        bunny_library_id: video?.bunny_library_id ?? '',
        created_at: (video?.created_at && formatDateTimeForInput(video.created_at)) || nowDateTimeISO(),
    });

    const [uploadState, setUploadState] = useState({ status: 'idle', progress: 0, error: '' });
    const [uploadSession, setUploadSession] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState('');
    const [thumbnailPreview, setThumbnailPreview] = useState(video?.thumbnail_url ?? '');
    const [thumbnailState, setThumbnailState] = useState({ status: 'idle', error: '' });
    const videoInputRef = useRef(null);

    const startUpload = async (file) => {
        if (!file) return;
        setUploadFile(file);
        setUploadState({ status: 'starting', progress: 0, error: '' });

        const title = data.title?.trim() || file.name;
        const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
        let session = uploadSession;

        if (!session || session.fileKey !== fileKey || session.expires < Math.floor(Date.now() / 1000) + 60) {
            let initResponse;
            try {
                initResponse = await axios.post(route('brands.videos.bunny.init', brand.id), { title });
            } catch (err) {
                const message = err?.response?.data?.error || 'Unable to start upload. Try again.';
                setUploadState({ status: 'error', progress: 0, error: message });
                return;
            }

            const { video_id, library_id, expires, signature, upload_endpoint } = initResponse.data;
            if (!video_id || !library_id || !expires || !signature || !upload_endpoint) {
                setUploadState({ status: 'error', progress: 0, error: 'Upload initialization failed.' });
                return;
            }

            session = { video_id, library_id, expires, signature, upload_endpoint, fileKey };
            setUploadSession(session);
        }

        setData('bunny_video_id', session.video_id);
        setData('bunny_library_id', session.library_id);

        let settled = false;
        let lastProgressAt = Date.now();

        const fail = (message) => {
            if (settled) return;
            settled = true;
            clearInterval(stallTimer);
            setUploadState({ status: 'error', progress: 0, error: message });
        };

        const finish = () => {
            if (settled) return;
            settled = true;
            clearInterval(stallTimer);
        };

        const upload = new tus.Upload(file, {
            endpoint: session.upload_endpoint,
            retryDelays: [0, 1000, 3000, 5000],
            metadata: {
                filename: file.name,
                filetype: file.type,
                title,
            },
            headers: {
                AuthorizationSignature: session.signature,
                AuthorizationExpire: String(session.expires),
                VideoId: session.video_id,
                LibraryId: String(session.library_id),
            },
            onError: () => fail('Upload failed. Please retry.'),
            onProgress: (bytesUploaded, bytesTotal) => {
                lastProgressAt = Date.now();
                const percentage = bytesTotal ? Math.floor((bytesUploaded / bytesTotal) * 100) : 0;
                setUploadState({ status: 'uploading', progress: percentage, error: '' });
            },
            onSuccess: async () => {
                setUploadState({ status: 'finalizing', progress: 100, error: '' });
                try {
                    await axios.post(route('brands.videos.bunny.finalize', brand.id), {
                        video_id: session.video_id,
                        library_id: session.library_id,
                    });
                    finish();
                    setUploadState({ status: 'done', progress: 100, error: '' });
                } catch (err) {
                    const message = err?.response?.data?.error || 'Upload finished, but finalize failed.';
                    fail(message);
                }
            },
        });

        const stallTimer = setInterval(() => {
            if (Date.now() - lastProgressAt < UPLOAD_STALL_TIMEOUT_MS) return;
            upload.abort(true).catch(() => {});
            fail('Upload stalled. Please retry.');
        }, 3000);

        try {
            const previousUploads = await upload.findPreviousUploads();
            if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
            upload.start();
        } catch {
            fail('Unable to resume previous upload. Retry.');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        clearErrors();

        if (!data.title?.trim()) return setError('title', 'Title is required.');
        if (!data.created_at) return setError('created_at', 'Published date is required.');
        if (!data.short_description?.trim()) return setError('short_description', 'Short description is required.');

        patch(route('brands.videos.update', [brand.id, video.id]));
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">Edit sponsor video</h2>}>
            <Head title="Edit sponsor video" />

            <div className="mx-auto w-full max-w-6xl">
                <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-gray-800">
                    <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-slate-700 dark:bg-gray-800">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{brand.name} Video Studio</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update metadata, upload a new file optionally, and save.</p>
                    </div>

                    <div className="space-y-6 p-6 md:p-8">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <InputLabel htmlFor="video_file" value="Video file (optional)" />
                                <input
                                    id="video_file"
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setVideoPreview(file ? URL.createObjectURL(file) : '');
                                        startUpload(file);
                                    }}
                                    ref={videoInputRef}
                                    className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50 dark:text-gray-200 dark:file:border-gray-600 dark:file:bg-gray-700 dark:file:text-gray-200"
                                    disabled={uploadState.status === 'uploading' || uploadState.status === 'finalizing'}
                                />
                                {videoPreview && <video src={videoPreview} controls className="mt-3 w-full rounded-lg border border-gray-200 bg-black dark:border-gray-700" />}
                                {data.bunny_video_id && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current video ID: {data.bunny_video_id}</p>}

                                {uploadState.status !== 'idle' && (
                                    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                                        <div className="flex items-center justify-between gap-2">
                                            <span>
                                                {uploadState.status === 'uploading' && 'Uploading video... Do not refresh.'}
                                                {uploadState.status === 'finalizing' && 'Finalizing upload...'}
                                                {uploadState.status === 'done' && 'Upload complete.'}
                                                {uploadState.status === 'error' && uploadState.error}
                                                {uploadState.status === 'starting' && 'Starting upload...'}
                                            </span>
                                            {uploadState.status === 'error' && (
                                                <button
                                                    type="button"
                                                    onClick={() => startUpload(uploadFile || videoInputRef.current?.files?.[0])}
                                                    className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                                                >
                                                    Retry
                                                </button>
                                            )}
                                        </div>
                                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${uploadState.progress}%` }} />
                                        </div>
                                    </div>
                                )}
                                <InputError message={errors.bunny_video_id || errors.bunny_library_id} className="mt-1" />
                            </div>

                            <div>
                                <InputLabel htmlFor="thumbnail" value="Thumbnail image (optional)" />
                                <input
                                    id="thumbnail"
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0] || null;
                                        if (!file) return;
                                        if (!data.bunny_video_id || !data.bunny_library_id) {
                                            setThumbnailState({ status: 'error', error: 'Upload video first.' });
                                            return;
                                        }

                                        setThumbnailState({ status: 'uploading', error: '' });
                                        const formData = new FormData();
                                        formData.append('thumbnail', file);
                                        formData.append('video_id', data.bunny_video_id);
                                        formData.append('library_id', data.bunny_library_id);

                                        try {
                                            const res = await axios.post(route('brands.videos.bunny.thumbnail', brand.id), formData, {
                                                headers: { 'Content-Type': 'multipart/form-data' },
                                            });
                                            const url = res.data?.thumbnail_url || '';
                                            setThumbnailPreview(url || URL.createObjectURL(file));
                                            setThumbnailState({ status: 'done', error: '' });
                                        } catch (err) {
                                            const message = err?.response?.data?.error || 'Thumbnail upload failed.';
                                            setThumbnailState({ status: 'error', error: message });
                                        }
                                    }}
                                    className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50 dark:text-gray-200 dark:file:border-gray-600 dark:file:bg-gray-700 dark:file:text-gray-200"
                                    disabled={!data.bunny_video_id || thumbnailState.status === 'uploading'}
                                />
                                {thumbnailState.status === 'error' && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{thumbnailState.error}</p>}
                                {thumbnailPreview && <img src={thumbnailPreview} alt="Thumbnail preview" className="mt-3 h-52 w-full rounded-lg border border-gray-200 object-cover dark:border-gray-700" />}
                                <InputError message={errors.thumbnail} className="mt-1" />
                            </div>
                        </div>

                        <div>
                            <InputLabel htmlFor="title" value="Title *" />
                            <TextInput id="title" value={data.title} onChange={(e) => { setData('title', e.target.value); setData('slug', slugify(e.target.value)); }} className="mt-1 block w-full" />
                            <InputError message={errors.title} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="slug" value="Slug *" />
                            <TextInput id="slug" value={data.slug} onChange={(e) => setData('slug', slugify(e.target.value))} className="mt-1 block w-full" />
                            <InputError message={errors.slug} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="created_at" value="Published date and time *" />
                            <TextInput id="created_at" type="datetime-local" value={data.created_at} onChange={(e) => setData('created_at', e.target.value)} className="mt-1 block w-full" />
                            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Content is shown after this date and time.</p>
                            <InputError message={errors.created_at} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="short_description" value="Short description *" />
                            <textarea
                                id="short_description"
                                rows={4}
                                value={data.short_description}
                                onChange={(e) => setData('short_description', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                            />
                            <InputError message={errors.short_description} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel value="Long description" />
                            <div className="mt-1 rounded-md border border-gray-300 dark:border-slate-600">
                                <RichTextEditor value={data.long_description} onChange={(value) => setData('long_description', value)} />
                            </div>
                            <InputError message={errors.long_description} className="mt-2" />
                        </div>

                        <div className="flex justify-end">
                            <PrimaryButton>Update video</PrimaryButton>
                        </div>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
