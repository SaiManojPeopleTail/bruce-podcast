import { usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';

export function AdminFlashToasts() {
    const page = usePage();

    useEffect(() => {
        const f = page.props.flash;
        if (f?.success) {
            toast.success(f.success);
        }
        if (f?.error) {
            toast.error(f.error);
        }
    }, [page.props.flash]);

    return null;
}

export function AdminToaster() {
    return (
        <Toaster
            position="top-center"
            gutter={12}
            containerStyle={{ top: '4.5rem' }}
            toastOptions={{
                duration: 4500,
                className:
                    '!text-sm !font-medium !shadow-lg !border !px-4 !py-3 !rounded-lg !max-w-md ' +
                    '!bg-white !text-gray-900 !border-gray-200 ' +
                    'dark:!bg-slate-800 dark:!text-slate-100 dark:!border-slate-600',
                success: {
                    iconTheme: {
                        primary: '#22c55e',
                        secondary: '#ffffff',
                    },
                },
                error: {
                    iconTheme: {
                        primary: '#ef4444',
                        secondary: '#ffffff',
                    },
                },
            }}
        />
    );
}
