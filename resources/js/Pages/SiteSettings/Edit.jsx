import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm, usePage } from '@inertiajs/react';

export default function Edit({ page }) {
    const { flash } = usePage().props;
    const { data, setData, patch, processing, errors } = useForm({
        meta_title: page?.meta_title ?? '',
        meta_description: page?.meta_description ?? '',
        meta_keywords: page?.meta_keywords ?? '',
        og_image: page?.og_image ?? '',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        patch(route('site-settings.pages.update', page.id));
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Edit page meta — {page?.name}
                </h2>
            }
        >
            <Head title={`Edit ${page?.name} — Site settings`} />

            <div className="w-full py-6">
                {flash?.success && (
                    <div className="mb-4 rounded-md bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        {flash.success}
                    </div>
                )}
                <div className="mb-6">
                    <Link
                        href={route('site-settings.index')}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                        ← Back to Site settings
                    </Link>
                </div>
                <div className="w-full max-w-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white p-6 shadow dark:bg-slate-800">
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                            Meta for <strong>{page?.name}</strong> ({page?.route}). Used for SEO and social sharing.
                        </p>
                        <div>
                            <InputLabel htmlFor="meta_title" value="Meta title" />
                            <TextInput
                                id="meta_title"
                                type="text"
                                value={data.meta_title}
                                onChange={(e) => setData('meta_title', e.target.value)}
                                className="mt-1 block w-full"
                                placeholder="Page title for search and social"
                                autoFocus
                            />
                            <InputError message={errors.meta_title} className="mt-1" />
                        </div>
                        <div>
                            <InputLabel htmlFor="meta_description" value="Meta description" />
                            <textarea
                                id="meta_description"
                                value={data.meta_description}
                                onChange={(e) => setData('meta_description', e.target.value)}
                                rows={3}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                placeholder="Short description for search and social"
                            />
                            <InputError message={errors.meta_description} className="mt-1" />
                        </div>
                        <div>
                            <InputLabel htmlFor="meta_keywords" value="Meta keywords (optional)" />
                            <TextInput
                                id="meta_keywords"
                                type="text"
                                value={data.meta_keywords}
                                onChange={(e) => setData('meta_keywords', e.target.value)}
                                className="mt-1 block w-full"
                                placeholder="Comma-separated"
                            />
                            <InputError message={errors.meta_keywords} className="mt-1" />
                        </div>
                        <div>
                            <InputLabel htmlFor="og_image" value="Open Graph image URL (optional)" />
                            <TextInput
                                id="og_image"
                                type="url"
                                value={data.og_image}
                                onChange={(e) => setData('og_image', e.target.value)}
                                className="mt-1 block w-full"
                                placeholder="https://..."
                            />
                            <InputError message={errors.og_image} className="mt-1" />
                        </div>
                        <div className="flex items-center gap-4">
                            <PrimaryButton type="submit" disabled={processing}>
                                Save
                            </PrimaryButton>
                            <Link
                                href={route('site-settings.index')}
                                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                                Cancel
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
