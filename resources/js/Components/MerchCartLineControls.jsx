import { useCart } from '@/Context/CartContext';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

function lineMatches(item, productId, variantId) {
    return (
        String(item.printify_product_id) === String(productId)
        && String(item.printify_variant_id) === String(variantId)
    );
}

/**
 * Add to cart, or quantity stepper when this line is already in the cart.
 * @param {'compact'|'full'} props.size — compact for grid cards, full for PDP
 */
export default function MerchCartLineControls({
    printifyProductId,
    printifyVariantId,
    title,
    variantTitle,
    image,
    ourPrice,
    size = 'compact',
    toastOnAdd = true,
}) {
    const { items, addItem, updateQty } = useCart();
    const line = items.find((i) => lineMatches(i, printifyProductId, printifyVariantId));
    const qty = line?.quantity ?? 0;

    const payload = {
        printify_product_id: printifyProductId,
        printify_variant_id: printifyVariantId,
        title,
        variant_title: variantTitle ?? '',
        our_price: ourPrice,
        image: image ?? null,
    };

    const stop = (e) => {
        e.stopPropagation();
        e.preventDefault();
    };

    const handleAdd = (e) => {
        stop(e);
        addItem(payload);
        if (toastOnAdd) toast.success('Added to cart');
    };

    const dec = (e) => {
        stop(e);
        updateQty(printifyProductId, printifyVariantId, qty - 1);
    };

    const inc = (e) => {
        stop(e);
        updateQty(printifyProductId, printifyVariantId, qty + 1);
    };

    const isFull = size === 'full';

    if (qty < 1) {
        return (
            <button
                type="button"
                onClick={handleAdd}
                className={
                    isFull
                        ? 'flex w-full items-center justify-center gap-2 rounded-xl bg-[#b59100] px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#a07e00] active:scale-[0.98]'
                        : 'flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#b59100] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a07e00] active:scale-[0.98]'
                }
            >
                <ShoppingCart className={isFull ? 'h-5 w-5' : 'h-4 w-4'} />
                Add to cart
            </button>
        );
    }

    return (
        <div
            className={
                isFull
                    ? 'flex w-full items-center justify-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm'
                    : 'flex w-full items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 shadow-sm'
            }
            role="group"
            aria-label="Quantity in cart"
        >
            <button
                type="button"
                onClick={dec}
                aria-label="Decrease quantity"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#b59100] bg-[#b59100] text-white shadow-sm transition hover:border-[#a07e00] hover:bg-[#a07e00] active:scale-95"
            >
                <Minus className="h-4 w-4" />
            </button>
            <span
                className={`min-w-[2rem] text-center font-semibold tabular-nums text-gray-900 ${isFull ? 'text-base' : 'text-sm'}`}
            >
                {qty}
            </span>
            <button
                type="button"
                onClick={inc}
                aria-label="Increase quantity"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#b59100] bg-[#b59100] text-white shadow-sm transition hover:border-[#a07e00] hover:bg-[#a07e00] active:scale-95"
            >
                <Plus className="h-4 w-4" />
            </button>
        </div>
    );
}
