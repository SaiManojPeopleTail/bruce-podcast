import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import RichTextEditor from '@/Components/RichTextEditor';
import TextInput from '@/Components/TextInput';
import { Head, useForm } from '@inertiajs/react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

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
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm for datetime-local
}

function nowDateTimeISO() {
    return new Date().toISOString().slice(0, 16);
}

export default function Edit({ episode }) {
    const { data, setData, patch, processing, errors, setError, clearErrors } = useForm({
        title: episode?.title ?? '',
        slug: episode?.slug ?? '',
        short_description: episode?.short_description ?? '',
        long_description: episode?.long_description ?? '',
        bunny_video_id: episode?.bunny_video_id ?? '',
        bunny_library_id: episode?.bunny_library_id ?? '',
        created_at: (episode?.created_at && formatDateTimeForInput(episode.created_at)) || nowDateTimeISO(),
    });
    const [thumbnailPreview, setThumbnailPreview] = useState(episode?.thumbnail_url ?? '');
    const [thumbnailState, setThumbnailState] = useState({ status: 'idle', error: '' });

    const handleTitleChange = (value) => {
        setData('title', value);
        setData('slug', slugify(value));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        clearErrors();

        if (!data.title?.trim()) {
            setError('title', 'Title is required.');
            return;
        }

        if (!data.created_at) {
            setError('created_at', 'Published date is required.');
            return;
        }

        if (!data.short_description?.trim()) {
            setError('short_description', 'Short description is required.');
            return;
        }

        patch(route('episodes.update', episode.id));
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Edit episode
                </h2>
            }
        >
            <Head title="Edit episode" />

            
            <div className="mx-auto w-full max-w-6xl">
                    <form
                        onSubmit={handleSubmit}
                        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-gray-800"
                        >
                        <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-slate-700 dark:bg-gray-800">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Episode Studio</h3>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Update metadata and publish changes. Video cannot be changed; delete and create a new entry to use a different video.
                            </p>
                        </div>
                        <div className="space-y-6 p-6 md:p-8">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <InputLabel value="Video" />
                                <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                                    Video cannot be changed here. To use a different video, please delete this episode and create a new entry.
                                </div>
                                {data.bunny_video_id && (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        Current video ID: {data.bunny_video_id}
                                    </p>
                                )}
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
                                            const res = await axios.post(route('episodes.bunny.thumbnail'), formData, {
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
                                {thumbnailState.status === 'error' && (
                                    <p className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center justify-start gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {thumbnailState.error}</p>
                                )}
                                {thumbnailPreview && (
                                    <img
                                        src={thumbnailPreview}
                                        alt="Thumbnail preview"
                                        className="mt-3 h-auto w-full rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                                    />
                                )}
                                <InputError message={errors.thumbnail} className="mt-1" />
                            </div>
                        </div>

                        <div>
                            <InputLabel htmlFor="title" value="Title *" />
                            <TextInput
                                id="title"
                                type="text"
                                required
                                value={data.title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                className="mt-1 block w-full"
                                placeholder="Episode title"
                                autoFocus
                            />
                            <InputError message={errors.title} className="mt-1" />
                        </div>

                        <div>
                            <InputLabel value="Slug (generated from title, read-only)" />
                            <input
                                type="text"
                                readOnly
                                value={data.slug}
                                className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 py-2 text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
                                aria-label="Slug"
                            />
                            <InputError message={errors.slug} className="mt-1" />
                        </div>

                        <div>
                            <InputLabel htmlFor="created_at" value="Published date and time *" />
                            <input
                                id="created_at"
                                type="datetime-local"
                                required
                                value={data.created_at}
                                onChange={(e) => setData('created_at', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Content is shown after this date and time.</p>
                            <InputError message={errors.created_at} className="mt-1" />
                        </div>

                        <div>
                            <InputLabel htmlFor="short_description" value="Short description *" />
                            <textarea
                                id="short_description"
                                required
                                value={data.short_description}
                                onChange={(e) => setData('short_description', e.target.value)}
                                rows={2}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                                placeholder="Brief description for cards and lists"
                            />
                            <InputError message={errors.short_description} className="mt-1" />
                        </div>

                        <div>
                            <InputLabel htmlFor="long_description" value="Long description" />
                            <div className="mt-1">
                                <RichTextEditor
                                    id="long_description"
                                    value={data.long_description}
                                    onChange={(html) => setData('long_description', html)}
                                    placeholder="Full description for the episode page"
                                />
                            </div>
                            <InputError message={errors.long_description} className="mt-1" />
                        </div>

                        <div className="flex items-center gap-4">
                            <PrimaryButton
                                type="submit"
                                disabled={processing}
                            >
                                Update episode
                            </PrimaryButton>
                        </div>
                        </div>
                    </form>
                </div>
        </AuthenticatedLayout>
    );
}
