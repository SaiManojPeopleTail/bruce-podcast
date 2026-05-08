import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'merch_cart_v1';

const CartContext = createContext(null);

function loadCart() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveCart(items) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
}

export function CartProvider({ children }) {
    const [items, setItems] = useState(loadCart);

    useEffect(() => {
        saveCart(items);
    }, [items]);

    const addItem = useCallback((item) => {
        setItems((prev) => {
            const idx = prev.findIndex(
                (i) =>
                    i.printify_product_id === item.printify_product_id &&
                    i.printify_variant_id === item.printify_variant_id,
            );
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], quantity: next[idx].quantity + (item.quantity ?? 1) };
                return next;
            }
            return [...prev, { ...item, quantity: item.quantity ?? 1 }];
        });
    }, []);

    const removeItem = useCallback((printifyProductId, printifyVariantId) => {
        setItems((prev) =>
            prev.filter(
                (i) =>
                    !(i.printify_product_id === printifyProductId && i.printify_variant_id === printifyVariantId),
            ),
        );
    }, []);

    const updateQty = useCallback((printifyProductId, printifyVariantId, qty) => {
        if (qty < 1) {
            removeItem(printifyProductId, printifyVariantId);
            return;
        }
        setItems((prev) =>
            prev.map((i) =>
                i.printify_product_id === printifyProductId && i.printify_variant_id === printifyVariantId
                    ? { ...i, quantity: qty }
                    : i,
            ),
        );
    }, [removeItem]);

    const clearCart = useCallback(() => setItems([]), []);

    const totalCount = items.reduce((s, i) => s + i.quantity, 0);
    const totalPrice = items.reduce((s, i) => s + i.our_price * i.quantity, 0);

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, totalCount, totalPrice }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error('useCart must be used inside CartProvider');
    return ctx;
}
