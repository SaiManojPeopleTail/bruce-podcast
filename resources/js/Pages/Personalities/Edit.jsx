import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, useForm } from '@inertiajs/react';

export default function Edit({ personality }) {
    const { data, setData, post, processing, errors } = useForm({
        name: personality?.name ?? '',
        video: null,
        status: Boolean(personality?.status),
        _method: 'patch',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('personalities.update', personality.id), { forceFormData: true });
    };

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">Edit personality</h2>}>
            <Head title="Edit personality" />

            <div className="mx-auto w-full max-w-4xl">
                <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800 md:p-8">
                    <div>
                        <InputLabel htmlFor="name" value="Name" />
                        <TextInput id="name" value={data.name} onChange={(e) => setData('name', e.target.value)} className="mt-1 block w-full" />
                        <InputError message={errors.name} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="video" value="Replace video" />
                        <input
                            id="video"
                            type="file"
                            accept="video/*"
                            onChange={(e) => setData('video', e.target.files?.[0] || null)}
                            className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50 dark:text-gray-200 dark:file:border-gray-600 dark:file:bg-gray-700 dark:file:text-gray-200"
                        />
                        <InputError message={errors.video} className="mt-2" />
                        {personality?.video_url && !data.video && (
                            <video src={personality.video_url} controls className="mt-3 w-full rounded-lg border border-gray-200 dark:border-gray-700" />
                        )}
                    </div>

                    <div className="flex justify-end">
                        <PrimaryButton disabled={processing}>{processing ? 'Please wait...' : 'Update personality'}</PrimaryButton>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
