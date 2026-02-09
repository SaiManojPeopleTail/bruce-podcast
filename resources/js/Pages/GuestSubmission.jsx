import HeroVideoBackground from '@/Components/HeroVideoBackground';
import HeroNav from '@/Components/HeroNav';
import RecentVideos from '@/Components/RecentVideos';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head } from '@inertiajs/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

const quick = { duration: 0.2, ease: 'easeOut' };
const tabVariants = {
    in: { opacity: 0, y: 6 },
    active: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -4 },
};

const TABS = [
    { id: 'submission', label: 'Guest Submissions' },
    { id: 'lorrie', label: 'Meet Lorrie' },
];

export default function GuestSubmission() {
    const [activeTab, setActiveTab] = useState('submission');

    return (
        <HomeLayout>
            <Head title="Guest Submission" />
            <section className="relative min-h-screen overflow-hidden flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-16 pb-28">
                <HeroVideoBackground />
                <div className="absolute inset-0 bg-black/50 z-0" />
                <motion.div
                    className="relative z-10 w-full max-w-7xl flex flex-col"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                    <motion.div
                        className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] md:max-h-[80vh] min-h-[400px]"
                        initial={{ opacity: 0, scale: 0.99 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: 0.05, ease: 'easeOut' }}
                    >
                        {/* Header */}
                        <div className="p-6 sm:p-8 pb-4 shrink-0">
                            <h1 className="text-3xl sm:text-4xl font-bold barlow-condensed-semibold text-gray-900 mb-4">
                                Guest Submissions
                            </h1>
                            <div className="flex gap-1 border-b border-gray-200">
                                {TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors -mb-px ${
                                            activeTab === tab.id
                                                ? 'bg-gray-100 border border-amber-300 border-b-white text-amber-800'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tab content - scrollable */}
                        <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-4 min-h-0">
                            <AnimatePresence mode="wait">
                                {activeTab === 'submission' && (
                                    <motion.div
                                        key="submission"
                                        className="space-y-6 text-gray-700 leading-relaxed"
                                        variants={tabVariants}
                                        initial="in"
                                        animate="active"
                                        exit="out"
                                        transition={quick}
                                    >
                                        <div>
                                            <h2 className="text-lg font-bold barlow-condensed-semibold text-gray-900 mb-3">
                                                Celebrating the Voices Moving Our Industry Forward
                                            </h2>
                                            <p>
                                                Guest coordination is led by Lorrie Ingram, who works closely with our team to identify meaningful conversations and ensure each episode reflects the depth, expertise, and diversity of the community we serve.
                                            </p>
                                            <p className="mt-3">
                                                Canada's natural health industry is vibrant, dynamic, and continually evolving. Its progress is powered by the people behind it—retailers guiding customers toward better choices, buyers shaping assortments, product specialists educating teams, sales representatives building trusted relationships, and the brand partners, distributors, and brokers bringing innovation to market.
                                            </p>
                                            <p className="mt-3">
                                                At In Conversation with Bruce W. Cole, we believe the future of the industry is shaped by individuals willing to share their knowledge and experience. The podcast was created to spotlight these voices and capture the perspectives helping move natural health forward across Canada.
                                            </p>
                                            <p className="mt-3">
                                                If there is someone you believe the industry would benefit from hearing, we welcome your recommendation. Whether you are proposing a respected leader, an emerging voice, a valued colleague, or even yourself, we are always seeking thoughtful conversations that inform, inspire, and strengthen our ecosystem.
                                            </p>
                                            <p className="mt-3">
                                                To submit a guest idea, please share the individual's name along with a brief note outlining what makes their perspective valuable.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}

                                {activeTab === 'lorrie' && (
                                    <motion.div
                                        key="lorrie"
                                        className="space-y-6 text-gray-700 leading-relaxed"
                                        variants={tabVariants}
                                        initial="in"
                                        animate="active"
                                        exit="out"
                                        transition={quick}
                                    >
                                        <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-12">
                                            <div className="flex-1 order-2 lg:order-1">
                                                <h2 className="text-lg font-bold barlow-condensed-semibold text-gray-900 mb-4">
                                                    Meet Lorrie
                                                </h2>
                                                <p>
                                                    With more than 20 years of experience in the natural health industry, Lorrie brings both credibility and firsthand insight to her role as Show Booking Coordinator. A graduate of the Canadian School of Natural Nutrition (CSNN), she began her career as a Registered Holistic Nutritionist before owning and operating a Nutrition House health food store for eight years, where she developed a deep understanding of retail operations and customer care. During this time, she also became a published author of <span className="font-semibold">The Power of Maca</span>.
                                                </p>
                                                <p className="mt-4">
                                                    Over the past 13 years, Lorrie has held Account Management and Senior Account Management roles with leading natural health companies, including Renew Life and Healthology. She is passionate about supporting retailers, educating consumers, and making a meaningful impact across the industry.
                                                </p>
                                            </div>
                                            <div className="flex-1 w-full max-h-96 overflow-y-hidden rounded-xl max-w-sm lg:max-w-sm order-1 lg:order-2 shrink-0">
                                                <div className="aspect-[2/3] rounded-xl overflow-hidden shadow-xl bg-gray-200">
                                                    <img
                                                        src="/assets/images/lorrie.png"
                                                        alt="Lorrie Ingram"
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.target.src = 'https://placehold.co/600x750/f5f5f5/1a1a2e?text=Lorrie+Ingram';
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Fixed contact bar at bottom of card */}
                        <motion.div
                            className="shrink-0 border-t border-gray-200 bg-gray-50/80 px-6 sm:px-8 py-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.25, delay: 0.15 }}
                        >
                            <p className="text-sm font-semibold text-gray-900 mb-1">Submit a Guest</p>
                            <p className="text-sm text-gray-600 mb-1">
                                Contact:&nbsp;&nbsp;
                                <a
                                    href="mailto:guests@brucewcole.com"
                                    className="text-[#b59100] hover:text-[#ffde59] font-medium text-sm underline underline-offset-2 transition-colors"
                                >
                                    guests@brucewcole.com
                                </a>
                            </p>
                        </motion.div>
                    </motion.div>
                </motion.div>

                <HeroNav />
            </section>

            <RecentVideos />
        </HomeLayout>
    );
}
