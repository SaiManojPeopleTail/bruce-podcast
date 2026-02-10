import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import RichTextEditor from '@/Components/RichTextEditor';
import TextInput from '@/Components/TextInput';
import YouTubeVideoPreview from '@/Components/YouTubeVideoPreview';
import { Head, useForm } from '@inertiajs/react';

function slugify(title) {
    if (!title || typeof title !== 'string') return '';
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function todayISO() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

export default function Create() {
    const { data, setData, post, processing, errors } = useForm({
        title: '',
        slug: '',
        short_description: '',
        long_description: '',
        video_url: '',
        created_at: todayISO(),
    });

    const handleTitleChange = (value) => {
        setData({ title: value, slug: slugify(value) });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('episodes.store'));
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    New episode
                </h2>
            }
        >
            <Head title="New episode" />

            <div className="w-full py-6">
                <div className="w-full">
                    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white p-6 shadow dark:bg-slate-800">
                        <div>
                            <InputLabel htmlFor="title" value="Title" />
                            <TextInput
                                id="title"
                                type="text"
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
                                className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 py-2 text-gray-600 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400"
                                aria-label="Slug"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                                Special characters are removed; spaces become hyphens. This value is used in the episode URL.
                            </p>
                            <InputError message={errors.slug} className="mt-1" />
                        </div>

                        <div>
                            <InputLabel htmlFor="created_at" value="Published date" />
                            <input
                                id="created_at"
                                type="date"
                                value={data.created_at}
                                onChange={(e) => setData('created_at', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                                The episode will appear on the site on and after this date.
                            </p>
                            <InputError message={errors.created_at} className="mt-1" />
                        </div>

                        <div>
                            <InputLabel htmlFor="short_description" value="Short description" />
                            <textarea
                                id="short_description"
                                value={data.short_description}
                                onChange={(e) => setData('short_description', e.target.value)}
                                rows={2}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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

                        <div>
                            <InputLabel htmlFor="video_url" value="Video URL" />
                            <TextInput
                                id="video_url"
                                type="url"
                                value={data.video_url}
                                onChange={(e) => setData('video_url', e.target.value)}
                                className="mt-1 block w-full"
                                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                            />
                            <YouTubeVideoPreview videoUrl={data.video_url} />
                            <InputError message={errors.video_url} className="mt-1" />
                        </div>

                        <div className="flex items-center gap-4">
                            <PrimaryButton type="submit" disabled={processing}>
                                Save episode
                            </PrimaryButton>
                        </div>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
