import Footer from '@/Components/Footer';
import Newsletter from '@/Components/Newsletter';
import { Toaster } from 'react-hot-toast';

export default function HomeLayout({ children }) {
    return (
        <div className="min-h-screen flex flex-col">
            <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
            <div className="flex-1 flex flex-col gap-10">
                {children}
            </div>
            <Newsletter />
            <Footer />
        </div>
    );
}
