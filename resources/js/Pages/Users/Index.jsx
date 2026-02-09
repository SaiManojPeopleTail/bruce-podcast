import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function Index({ users }) {
    const { flash, auth } = usePage().props;
    const currentUserId = auth?.user?.id;
    const [deleteUser, setDeleteUser] = useState(null);
    const [passwordUser, setPasswordUser] = useState(null);
    const passwordForm = useForm({
        password: '',
        password_confirmation: '',
    });

    const confirmDelete = () => {
        if (deleteUser) {
            router.delete(route('users.destroy', deleteUser.id), {
                preserveScroll: true,
                onSuccess: () => setDeleteUser(null),
            });
        }
    };

    const submitPassword = (e) => {
        e.preventDefault();
        passwordForm.patch(route('users.update-password', passwordUser.id), {
            preserveScroll: true,
            onSuccess: () => {
                setPasswordUser(null);
                passwordForm.reset();
            },
        });
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    User management
                </h2>
            }
        >
            <Head title="User management" />

            <div className="w-full py-6">
                {flash?.success && (
                    <div className="mb-4 rounded-md bg-green-100 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {flash.success}
                    </div>
                )}

                <div className="mb-6 flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                        Add and delete users, or change their passwords.
                    </p>
                    <Link href={route('users.create')}>
                        <PrimaryButton>Add user</PrimaryButton>
                    </Link>
                </div>

                <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
                    <ul className="divide-y divide-gray-200 dark:divide-slate-700">
                        {users.map((u) => (
                            <li key={u.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6">
                                <div>
                                    <p className="font-medium text-gray-900 dark:text-slate-100">{u.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-slate-400">{u.email}</p>
                                    <p className="text-xs text-gray-400 dark:text-slate-500">
                                        ID {u.id} · Joined {new Date(u.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPasswordUser(u)}
                                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                    >
                                        Change password
                                    </button>
                                    {u.id !== currentUserId && (
                                        <button
                                            type="button"
                                            onClick={() => setDeleteUser(u)}
                                            className="rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <Modal show={!!deleteUser} onClose={() => setDeleteUser(null)} maxWidth="sm">
                <div className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                        Delete user
                    </h3>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
                        Are you sure you want to delete {deleteUser?.name} ({deleteUser?.email})? This cannot be undone.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setDeleteUser(null)}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                        <DangerButton onClick={confirmDelete}>Delete</DangerButton>
                    </div>
                </div>
            </Modal>

            <Modal show={!!passwordUser} onClose={() => { setPasswordUser(null); passwordForm.reset(); }} maxWidth="sm">
                <form onSubmit={submitPassword} className="p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                        Change password for {passwordUser?.name}
                    </h3>
                    <div className="mt-4">
                        <InputLabel htmlFor="password" value="New password" />
                        <TextInput
                            id="password"
                            type="password"
                            value={passwordForm.data.password}
                            onChange={(e) => passwordForm.setData('password', e.target.value)}
                            className="mt-1 block w-full"
                            autoComplete="new-password"
                        />
                        <InputError message={passwordForm.errors.password} className="mt-1" />
                    </div>
                    <div className="mt-4">
                        <InputLabel htmlFor="password_confirmation" value="Confirm password" />
                        <TextInput
                            id="password_confirmation"
                            type="password"
                            value={passwordForm.data.password_confirmation}
                            onChange={(e) => passwordForm.setData('password_confirmation', e.target.value)}
                            className="mt-1 block w-full"
                            autoComplete="new-password"
                        />
                        <InputError message={passwordForm.errors.password_confirmation} className="mt-1" />
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => { setPasswordUser(null); passwordForm.reset(); }}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                        <PrimaryButton type="submit" disabled={passwordForm.processing}>
                            Update password
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
