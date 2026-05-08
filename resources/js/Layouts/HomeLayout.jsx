import CartDrawer from '@/Components/CartDrawer';
import CartIcon from '@/Components/CartIcon';
import Footer from '@/Components/Footer';
import Newsletter from '@/Components/Newsletter';
import { CartProvider } from '@/Context/CartContext';
import { usePage } from '@inertiajs/react';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';

export default function HomeLayout({ children }) {
    const [cartOpen, setCartOpen] = useState(false);
    const { url } = usePage();

    useEffect(() => {
        if (url.startsWith('/checkout')) setCartOpen(false);
    }, [url]);

    return (
        <CartProvider>
            <div className="min-h-screen flex flex-col">
                <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
                <div className="flex-1 flex flex-col gap-10">
                    {children}
                </div>
                <Newsletter />
                <Footer />
            </div>
            <CartIcon onOpen={() => setCartOpen(true)} />
            <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
        </CartProvider>
    );
}
