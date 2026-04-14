import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm } from '@inertiajs/react';

export default function Edit({ department }) {
    const { data, setData, patch, processing, errors } = useForm({
        name: department?.name ?? '',
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        patch(route('retailer-profiles.departments.update', department.id));
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Edit department
                </h2>
            }
        >
            <Head title="Edit department" />

            <div className="mx-auto w-full max-w-2xl">
                <form
                    onSubmit={handleSubmit}
                    className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800 md:p-8"
                >
                    <div>
                        <InputLabel htmlFor="name" value="Department name *" />
                        <TextInput
                            id="name"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            className="mt-1 block w-full"
                            autoFocus
                        />
                        <InputError message={errors.name} className="mt-2" />
                    </div>

                    <div className="flex justify-between gap-3">
                        <Link
                            href={route('retailer-profiles.departments.index')}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Cancel
                        </Link>
                        <PrimaryButton disabled={processing}>Update department</PrimaryButton>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
