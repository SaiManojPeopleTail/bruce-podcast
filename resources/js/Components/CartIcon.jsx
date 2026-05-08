import { useCart } from '@/Context/CartContext';
import { usePage } from '@inertiajs/react';
import { ShoppingCart } from 'lucide-react';

export default function CartIcon({ onOpen }) {
    const { totalCount } = useCart();
    const { url } = usePage();

    const onCheckout = url.startsWith('/checkout');
    if (onCheckout || totalCount === 0) return null;

    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label={`Open cart — ${totalCount} item${totalCount !== 1 ? 's' : ''}`}
            className="fixed top-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#b59100] text-white shadow-lg transition hover:bg-[#a07e00] active:scale-95"
        >
            <ShoppingCart className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#b59100]">
                {totalCount > 99 ? '99+' : totalCount}
            </span>
        </button>
    );
}
