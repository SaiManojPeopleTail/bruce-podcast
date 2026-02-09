import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';

export default function Index({ pages }) {
    const { flash } = usePage().props;

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    Site settings
                </h2>
            }
        >
            <Head title="Site settings" />

            <div className="w-full py-6">
                {flash?.success && (
                    <div className="mb-4 rounded-md bg-green-100 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {flash.success}
                    </div>
                )}

                <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
                    Edit meta (title, description, keywords, OG image) for each page. Home (/) is the default when a page has no meta. Episode pages use the episode title and description automatically.
                </p>

                <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
                    <ul className="divide-y divide-gray-200 dark:divide-slate-700">
                        {pages.map((page) => (
                            <li
                                key={page.id}
                                className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-gray-900 dark:text-slate-100">{page.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-slate-400">{page.route}</p>
                                    {page.meta_title && (
                                        <p className="mt-1 truncate text-sm text-gray-600 dark:text-slate-400">
                                            {page.meta_title}
                                        </p>
                                    )}
                                </div>
                                <div className="flex shrink-0">
                                    <Link
                                        href={route('site-settings.pages.edit', page.id)}
                                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                                    >
                                        Edit
                                    </Link>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
