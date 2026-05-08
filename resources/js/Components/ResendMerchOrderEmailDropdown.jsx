import Dropdown from '@/Components/Dropdown';
import { router } from '@inertiajs/react';
import { ChevronDown, Mail } from 'lucide-react';

export default function ResendMerchOrderEmailDropdown({ orderId, align = 'right' }) {
    const post = (target) => {
        router.post(
            route('merch-orders.resend-email', orderId),
            { target },
            { preserveScroll: true },
        );
    };

    return (
        <Dropdown>
            <Dropdown.Trigger>
                <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                    Resend email
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                </button>
            </Dropdown.Trigger>
            <Dropdown.Content align={align} contentClasses="py-1 bg-white ring-1 ring-black ring-opacity-5 dark:bg-slate-800 dark:ring-white/10">
                <button
                    type="button"
                    className="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 transition hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-slate-300 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                    onClick={() => post('customer')}
                >
                    Customer confirmation
                </button>
                <button
                    type="button"
                    className="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 transition hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-slate-300 dark:hover:bg-slate-700 dark:focus:bg-slate-700"
                    onClick={() => post('admin')}
                >
                    Admin notification
                </button>
            </Dropdown.Content>
        </Dropdown>
    );
}
