import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm } from '@inertiajs/react';
import { useMemo } from 'react';

function handleFromName(name) {
    const s = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return s || 'retailer';
}

const readOnlyHandleClass =
    'mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 py-2 font-mono text-sm text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400';

export default function Create() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
    });

    const previewHandle = useMemo(() => handleFromName(data.name.trim()), [data.name]);

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('retailer-profiles.retailers.store'));
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Add retailer
                </h2>
            }
        >
            <Head title="Add retailer" />

            <div className="mx-auto w-full max-w-2xl">
                <form
                    onSubmit={handleSubmit}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
                >
                    <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-gray-700 dark:bg-gray-800">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New retailer</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Enter a display name to create the profile. You can add departments, address, contacts, and
                            phone numbers on the next screen.
                        </p>
                    </div>

                    <div className="space-y-6 p-6 md:p-8">
                        <div>
                            <InputLabel htmlFor="name" value="Display name *" />
                            <TextInput
                                id="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                className="mt-1 block w-full"
                                placeholder="e.g. Green Leaf Market"
                                autoFocus
                            />
                            <InputError message={errors.name} className="mt-1" />
                        </div>

                        <div>
                            <InputLabel htmlFor="handle_preview" value="Handle (preview, read-only)" />
                            <input
                                id="handle_preview"
                                type="text"
                                readOnly
                                value={previewHandle}
                                className={readOnlyHandleClass}
                                tabIndex={-1}
                                aria-label="Handle preview"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                The saved handle is set when you continue; if it’s already taken, a number is added
                                automatically.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 border-t border-gray-200 px-6 py-5 dark:border-gray-700 md:px-8">
                        <PrimaryButton type="submit" disabled={processing || !data.name.trim()}>
                            Create &amp; continue
                        </PrimaryButton>
                        <Link
                            href={route('retailer-profiles.retailers.index')}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
