import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import RichTextEditor from '@/Components/RichTextEditor';
import TextInput from '@/Components/TextInput';
import { Head, useForm } from '@inertiajs/react';
import axios from 'axios';
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

    const [thumbnailPreview, setThumbnailPreview] = useState(video?.thumbnail_url ?? '');
    const [thumbnailState, setThumbnailState] = useState({ status: 'idle', error: '' });

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
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update metadata and save. Video cannot be changed; delete and create a new entry to use a different video.</p>
                    </div>

                    <div className="space-y-6 p-6 md:p-8">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <InputLabel value="Video" />
                                <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                                    Video cannot be changed here. To use a different video, please delete this sponsor video and create a new entry.
                                </div>
                                {data.bunny_video_id && (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current video ID: {data.bunny_video_id}</p>
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
