import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import RichTextEditor from '@/Components/RichTextEditor';
import TextInput from '@/Components/TextInput';
import { Head, useForm } from '@inertiajs/react';
import axios from 'axios';
import * as tus from 'tus-js-client';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

const UPLOAD_STALL_TIMEOUT_MS = 90_000;
const stepOrder = ['create', 'upload', 'process', 'thumbnail', 'update'];
const initialSteps = {
    create: 'pending',
    upload: 'pending',
    process: 'pending',
    thumbnail: 'pending',
    update: 'pending',
};

function stepClass(status) {
    if (status === 'done') return 'text-green-600 dark:text-green-400';
    if (status === 'failed') return 'text-red-600 dark:text-red-400';
    if (status === 'in_progress') return 'text-indigo-600 dark:text-indigo-400';
    return 'text-gray-500 dark:text-slate-400';
}

function stepLabel(status) {
    if (status === 'done') return 'Done';
    if (status === 'failed') return 'Failed';
    if (status === 'in_progress') return 'In progress';
    return 'Pending';
}

function slugify(title) {
    if (!title || typeof title !== 'string') return '';
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function nowDateTimeISO() {
    return new Date().toISOString().slice(0, 16);
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Create({ brand }) {
    const { data, setData, errors, setError, clearErrors } = useForm({
        title: '',
        slug: '',
        short_description: '',
        long_description: '',
        created_at: nowDateTimeISO(),
    });

    const [videoFile, setVideoFile] = useState(null);
    const [videoPreview, setVideoPreview] = useState('');
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState('');

    const [showProcessingModal, setShowProcessingModal] = useState(false);
    const [workflowError, setWorkflowError] = useState('');
    const [workflowDone, setWorkflowDone] = useState(false);
    const [failedStep, setFailedStep] = useState('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [encodeProgress, setEncodeProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('Waiting to start...');
    const [steps, setSteps] = useState(initialSteps);
    const [workflowContext, setWorkflowContext] = useState({ videoId: null, session: null });

    const stepItems = useMemo(() => ([
        { key: 'create', label: 'Create sponsor video entry' },
        { key: 'upload', label: 'Upload video to Bunny' },
        { key: 'process', label: 'Wait for Bunny processing' },
        { key: 'thumbnail', label: 'Upload thumbnail to Bunny' },
        { key: 'update', label: 'Update sponsor video with Bunny data' },
    ]), []);

    const setStepStatus = (key, value) => setSteps((prev) => ({ ...prev, [key]: value }));

    const uploadWithTus = (file, session, title) => new Promise((resolve, reject) => {
        let settled = false;
        let lastProgressAt = Date.now();

        const fail = (error) => {
            if (settled) return;
            settled = true;
            clearInterval(stallTimer);
            reject(error);
        };

        const succeed = () => {
            if (settled) return;
            settled = true;
            clearInterval(stallTimer);
            resolve(true);
        };

        const upload = new tus.Upload(file, {
            endpoint: session.upload_endpoint,
            retryDelays: [0, 1000, 3000, 5000],
            metadata: { filename: file.name, filetype: file.type, title },
            headers: {
                AuthorizationSignature: session.signature,
                AuthorizationExpire: String(session.expires),
                VideoId: session.video_id,
                LibraryId: String(session.library_id),
            },
            onError: (error) => fail(error),
            onProgress: (bytesUploaded, bytesTotal) => {
                lastProgressAt = Date.now();
                const percentage = bytesTotal ? Math.floor((bytesUploaded / bytesTotal) * 100) : 0;
                setUploadProgress(percentage);
                setStatusMessage(`Uploading video... ${percentage}%`);
            },
            onSuccess: () => succeed(),
        });

        const stallTimer = setInterval(() => {
            if (Date.now() - lastProgressAt < UPLOAD_STALL_TIMEOUT_MS) return;
            upload.abort(true).catch(() => {});
            fail(new Error('Upload stalled. Please retry.'));
        }, 3000);

        upload.findPreviousUploads()
            .then((previousUploads) => {
                if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
                upload.start();
            })
            .catch((error) => fail(error));
    });

    const waitForBunnyProcessing = async (videoId, libraryId) => {
        const maxAttempts = 150;
        for (let i = 0; i < maxAttempts; i += 1) {
            const response = await axios.post(route('brands.videos.bunny.status', brand.id), {
                video_id: videoId,
                library_id: libraryId,
            });

            const state = response.data?.state;
            const progress = Number(response.data?.encode_progress || 0);
            setEncodeProgress(progress);

            if (state === 'ready') {
                setStatusMessage('Bunny processing complete.');
                return;
            }
            if (state === 'failed') {
                throw new Error('Bunny processing failed.');
            }

            setStatusMessage(`Bunny processing... ${progress}%`);
            await wait(2000);
        }

        throw new Error('Timed out waiting for Bunny processing.');
    };

    const runWorkflowFrom = async (startStep, seed = null) => {
        const context = seed || { ...workflowContext };
        const startIndex = stepOrder.indexOf(startStep);
        if (startIndex === -1) return;

        let currentStep = startStep;

        try {
            for (let i = startIndex; i < stepOrder.length; i += 1) {
                currentStep = stepOrder[i];
                setStepStatus(currentStep, 'in_progress');
                setFailedStep('');
                setWorkflowError('');

                if (currentStep === 'create') {
                    setStatusMessage('Creating sponsor video entry...');
                    const createResponse = await axios.post(route('brands.videos.store', brand.id), {
                        title: data.title,
                        slug: data.slug,
                        short_description: data.short_description,
                        long_description: data.long_description,
                        created_at: data.created_at,
                    }, { headers: { Accept: 'application/json' } });

                    const videoId = createResponse?.data?.video?.id;
                    if (!videoId) throw new Error('Sponsor video was created but ID was not returned.');

                    context.videoId = videoId;
                    setWorkflowContext({ ...context });
                    setStepStatus('create', 'done');
                    continue;
                }

                if (currentStep === 'upload') {
                    setStatusMessage('Initializing video upload...');
                    if (!context.session || context.session.expires < Math.floor(Date.now() / 1000) + 60) {
                        const initResponse = await axios.post(route('brands.videos.bunny.init', brand.id), { title: data.title });
                        const session = initResponse?.data;
                        if (!session?.video_id || !session?.library_id) throw new Error('Upload initialization failed.');
                        context.session = session;
                        setWorkflowContext({ ...context });
                    }

                    await uploadWithTus(videoFile, context.session, data.title || videoFile.name);
                    setStepStatus('upload', 'done');
                    continue;
                }

                if (currentStep === 'process') {
                    await waitForBunnyProcessing(context.session.video_id, context.session.library_id);
                    await axios.post(route('brands.videos.bunny.finalize', brand.id), {
                        video_id: context.session.video_id,
                        library_id: context.session.library_id,
                    });
                    setStepStatus('process', 'done');
                    continue;
                }

                if (currentStep === 'thumbnail') {
                    setStatusMessage('Uploading thumbnail...');
                    const formData = new FormData();
                    formData.append('thumbnail', thumbnailFile);
                    formData.append('video_id', context.session.video_id);
                    formData.append('library_id', context.session.library_id);
                    await axios.post(route('brands.videos.bunny.thumbnail', brand.id), formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                    setStepStatus('thumbnail', 'done');
                    continue;
                }

                if (currentStep === 'update') {
                    setStatusMessage('Updating sponsor video...');
                    await axios.patch(route('brands.videos.update', [brand.id, context.videoId]), {
                        title: data.title,
                        slug: data.slug,
                        short_description: data.short_description,
                        long_description: data.long_description,
                        created_at: data.created_at,
                        bunny_video_id: context.session.video_id,
                        bunny_library_id: context.session.library_id,
                    }, { headers: { Accept: 'application/json' } });
                    setStepStatus('update', 'done');
                }
            }

            setStatusMessage('Sponsor video created successfully. Redirecting...');
            setWorkflowDone(true);
            await wait(900);
            window.location.href = route('brands.videos.index', brand.id);
        } catch (err) {
            if (err?.response?.status === 422 && err?.response?.data?.errors) {
                Object.entries(err.response.data.errors).forEach(([key, value]) => {
                    setError(key, Array.isArray(value) ? value[0] : value);
                });
            }

            const message = err?.response?.data?.error || err?.message || 'Workflow failed.';
            setWorkflowError(message);
            setStatusMessage('Workflow stopped with an error.');
            setStepStatus(currentStep, 'failed');
            setFailedStep(currentStep);
            setWorkflowContext({ ...context });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        clearErrors();

        if (!data.title?.trim()) return setError('title', 'Title is required.');
        if (!data.created_at) return setError('created_at', 'Published date is required.');
        if (!data.short_description?.trim()) return setError('short_description', 'Short description is required.');
        if (!videoFile) return setError('video_file', 'Video file is required.');
        if (!thumbnailFile) return setError('thumbnail', 'Thumbnail is required.');

        setSteps(initialSteps);
        setWorkflowError('');
        setWorkflowDone(false);
        setFailedStep('');
        setUploadProgress(0);
        setEncodeProgress(0);
        setWorkflowContext({ videoId: null, session: null });
        setShowProcessingModal(true);

        await runWorkflowFrom('create');
    };

    const retryFailedStep = async (stepKey) => {
        await runWorkflowFrom(stepKey);
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">Add sponsor video</h2>}>
            <Head title="Add sponsor video" />

            <div className="mx-auto w-full max-w-6xl">
                <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-gray-800">
                    <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-slate-700 dark:bg-gray-800">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{brand.name} Video Upload</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Save starts upload, processing, thumbnailing and finalize steps.</p>
                    </div>

                    <div className="space-y-6 p-6 md:p-8">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <InputLabel htmlFor="video_file" value="Video file" />
                                <input
                                    id="video_file"
                                    type="file"
                                    accept="video/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setVideoFile(file);
                                        setVideoPreview(file ? URL.createObjectURL(file) : '');
                                    }}
                                    className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50 dark:text-gray-200 dark:file:border-gray-600 dark:file:bg-gray-700 dark:file:text-gray-200"
                                />
                                {videoPreview && <video src={videoPreview} controls className="mt-3 w-full rounded-lg border border-gray-200 bg-black dark:border-gray-700" />}
                                <InputError message={errors.video_file} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="thumbnail" value="Thumbnail image" />
                                <input
                                    id="thumbnail"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0] || null;
                                        setThumbnailFile(file);
                                        setThumbnailPreview(file ? URL.createObjectURL(file) : '');
                                    }}
                                    className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50 dark:text-gray-200 dark:file:border-gray-600 dark:file:bg-gray-700 dark:file:text-gray-200"
                                />
                                {thumbnailPreview && <img src={thumbnailPreview} alt="Thumbnail preview" className="mt-3 h-auto w-full rounded-lg border border-gray-200 object-cover dark:border-gray-700" />}
                                <InputError message={errors.thumbnail} className="mt-2" />
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
                            <PrimaryButton type="submit">Save video</PrimaryButton>
                        </div>
                    </div>
                </form>
            </div>

            <Modal show={showProcessingModal} onClose={() => {}} closeable={false} maxWidth="lg">
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Processing Sponsor Video</h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{statusMessage}</p>

                    <div className="mt-4">
                        <p className="mb-1 flex items-center justify-start gap-2 text-xs text-gray-500 dark:text-slate-400">
                            <Loader2 className={uploadProgress > 0 && uploadProgress < 100 ? 'h-4 w-4 animate-spin' : 'hidden'} />
                            Upload progress
                        </p>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
                            <div className="h-full bg-indigo-500 transition-all" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{uploadProgress}%</p>
                    </div>

                    <div className="mt-4">
                        <p className="mb-1 flex items-center justify-start gap-2 text-xs text-gray-500 dark:text-slate-400">
                            <Loader2 className={encodeProgress > 0 && encodeProgress < 100 ? 'h-4 w-4 animate-spin' : 'hidden'} />
                            Bunny processing progress
                        </p>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-700">
                            <div className="h-full bg-amber-500 transition-all" style={{ width: `${encodeProgress}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{encodeProgress}%</p>
                    </div>

                    <ul className="mt-5 space-y-2">
                        {stepItems.map((item) => (
                            <li key={item.key} className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm dark:border-slate-700">
                                <span className="text-gray-800 dark:text-slate-200">{item.label}</span>
                                <div className="flex items-center gap-2">
                                    <span className={`${stepClass(steps[item.key])} flex items-center gap-2`}>
                                        {stepLabel(steps[item.key]) === 'In progress' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                        {stepLabel(steps[item.key])}
                                    </span>
                                    {failedStep === item.key && (
                                        <button
                                            type="button"
                                            onClick={() => retryFailedStep(item.key)}
                                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                        >
                                            Retry
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>

                    {workflowError && (
                        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                            {workflowError}
                        </div>
                    )}

                    {workflowDone && (
                        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                            Sponsor video created successfully.
                        </div>
                    )}

                    {(workflowDone || workflowError) && (
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowProcessingModal(false)}
                                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
