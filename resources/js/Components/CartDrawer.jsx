import { useCart } from '@/Context/CartContext';
import { Link } from '@inertiajs/react';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';

function formatPrice(cents) {
    return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

export default function CartDrawer({ open, onClose }) {
    const { items, removeItem, updateQty, clearCart, totalCount, totalPrice } = useCart();

    // Prevent body scroll when open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-50 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
                onClick={onClose}
                aria-hidden
            />

            {/* Drawer */}
            <div
                className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
                role="dialog"
                aria-modal="true"
                aria-label="Shopping cart"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-[#b59100]" />
                        <h2 className="text-lg font-semibold text-gray-900">
                            Your Cart{' '}
                            {totalCount > 0 && (
                                <span className="text-sm font-normal text-gray-500">({totalCount})</span>
                            )}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close cart"
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 pt-20 text-center">
                            <ShoppingBag className="h-12 w-12 text-gray-200" />
                            <p className="text-gray-500">Your cart is empty.</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="text-sm text-[#b59100] underline underline-offset-2 hover:text-[#a07e00]"
                            >
                                Continue shopping
                            </button>
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {items.map((item) => (
                                <li
                                    key={`${item.printify_product_id}-${item.printify_variant_id}`}
                                    className="flex gap-4"
                                >
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt={item.title}
                                            className="h-20 w-20 shrink-0 rounded-lg border border-gray-200 object-cover"
                                        />
                                    ) : (
                                        <div className="h-20 w-20 shrink-0 rounded-lg border border-gray-200 bg-gray-100" />
                                    )}
                                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                                        <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                                        {item.variant_title && (
                                            <p className="text-xs text-gray-500">{item.variant_title}</p>
                                        )}
                                        <p className="text-sm font-semibold text-gray-900">
                                            {formatPrice(item.our_price)}
                                        </p>
                                        <div className="mt-auto flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => updateQty(item.printify_product_id, item.printify_variant_id, item.quantity - 1)}
                                                className="flex h-7 w-7 items-center justify-center rounded border border-[#b59100] bg-[#b59100] text-white shadow-sm transition hover:border-[#a07e00] hover:bg-[#a07e00]"
                                                aria-label="Decrease quantity"
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                            </button>
                                            <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                                            <button
                                                type="button"
                                                onClick={() => updateQty(item.printify_product_id, item.printify_variant_id, item.quantity + 1)}
                                                className="flex h-7 w-7 items-center justify-center rounded border border-[#b59100] bg-[#b59100] text-white shadow-sm transition hover:border-[#a07e00] hover:bg-[#a07e00]"
                                                aria-label="Increase quantity"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeItem(item.printify_product_id, item.printify_variant_id)}
                                                className="ml-auto text-red-400 hover:text-red-600"
                                                aria-label="Remove item"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="border-t border-gray-200 px-5 py-4">
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-base font-medium text-gray-900">Subtotal</span>
                            <span className="text-base font-semibold text-gray-900">{formatPrice(totalPrice)}</span>
                        </div>
                        <p className="mb-4 text-xs text-gray-500">Shipping and taxes calculated at checkout.</p>
                        <div className="flex flex-col gap-2">
                            <Link
                                href={route('checkout.index')}
                                onClick={onClose}
                                className="flex w-full items-center justify-center rounded-lg bg-[#b59100] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#a07e00]"
                            >
                                Checkout
                            </Link>
                            <button
                                type="button"
                                onClick={clearCart}
                                className="flex w-full items-center justify-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Clear cart
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
