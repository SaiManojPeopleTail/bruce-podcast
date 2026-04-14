import Footer from '@/Components/Footer';
import Newsletter from '@/Components/Newsletter';

export default function HomeLayout({ children }) {
    return (
        <div className="min-h-screen flex flex-col">
            <div className="flex-1 flex flex-col gap-10">
                {children}
            </div>
            <Newsletter />
            <Footer />
        </div>
    );
}
