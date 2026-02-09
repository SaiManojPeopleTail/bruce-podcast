import Footer from '@/Components/Footer';

export default function HomeLayout({ children }) {
    return (
        <div className="min-h-screen flex flex-col">
            <div className="flex-1 flex flex-col gap-10">
                {children}
            </div>
            <Footer />
        </div>
    );
}
