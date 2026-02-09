import GalleryOfPersonalities from '@/Components/GalleryOfPersonalities';
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
const cardStagger = { staggerChildren: 0.04, delayChildren: 0.02 };
const cardItem = { in: { opacity: 0, y: 8 }, active: { opacity: 1, y: 0 } };

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'investment', label: 'Rates' },
    { id: 'emerging', label: 'Emerging Brands' },
];

export default function BrandPartnerships() {
    const [activeTab, setActiveTab] = useState('overview');

    return (
        <HomeLayout>
            <Head title="Brand Partnerships" />
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
                        className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh] min-h-[400px]"
                        initial={{ opacity: 0, scale: 0.99 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: 0.05, ease: 'easeOut' }}
                    >
                        {/* Header */}
                        <div className="p-6 sm:p-8 pb-4 shrink-0">
                            <h1 className="text-3xl sm:text-4xl font-bold barlow-condensed-semibold text-gray-900 mb-4">
                                Brand Partnerships
                            </h1>
                            {/* <p className="text-base text-gray-600 mb-4">
                                Limited to a small number of category partners each year
                            </p> */}
                            {/* Tabs */}
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
                            {activeTab === 'overview' && (
                                <motion.div
                                    key="overview"
                                    className="space-y-6 text-gray-700 leading-relaxed"
                                    variants={tabVariants}
                                    initial="in"
                                    animate="active"
                                    exit="out"
                                    transition={quick}
                                >
                                    <div>
                                        <h2 className="text-lg font-bold barlow-condensed-semibold text-gray-900 mb-3">
                                            Where the Industry Comes to Listen
                                        </h2>
                                        <p>
                                            Every week, more than a thousand retailers across Canada open their shelves, stores, and communities to the natural health products shaping consumer well-being.
                                        </p>
                                        <p>
                                            In Conversation with Bruce W. Cole was created to unite this ecosystem through thoughtful dialogue, shared intelligence, and meaningful storytelling.
                                        </p>
                                        <p>
                                            When a brand partners with the podcast, it does more than advertise. It enters a national conversation that is advancing the collective knowledge of retailers, distributors, and innovators across the industry.
                                        </p>
                                        <p className='mt-2'>
                                            Your message becomes part of a platform designed to inform, inspire, and move the natural products community forward.
                                        </p>
                                        <p className='mt-2'>This is not simply media placement. It is participation in the voice of the industry</p>
                                    </div>
                                    <div className="pt-2 border-t border-gray-100">
                                        <h2 className="text-lg font-bold barlow-condensed-semibold text-gray-900 mb-3">
                                            Sponsored Recognition Segments
                                        </h2>
                                        <p>
                                            Each episode features a dedicated sponsor recognition segment acknowledging the brands that help make these important industry conversations possible.
                                        </p>
                                        <p>
                                            Rather than relying on a single placement, sponsors are woven naturally into the rhythm of the podcast through brief, professionally delivered messages that ensure your brand is consistently heard and remembered.
                                        </p>
                                        <p className='mt-2'>
                                            We produce at least one episode every week, with additional recordings scheduled throughout the year to support seasonal moments and key industry events. Your sponsor recognition will appear in every episode released during your sponsored month, creating strong frequency, sustained presence, and deeper listener familiarity.
                                        </p>
                                        <p>
                                            In addition, partners receive a premium 30-second brand feature introducing your organization in a credible, highly contextual environment aligned with the tone of the show.
                                        </p>
                                        <p className="mt-2">
                                            Brands may run the same creative throughout the month or refresh their message across episodes to highlight different products, initiatives, or campaigns.
                                        </p>
                                        <p>Professional production support ensures your brand is represented at the highest standard.</p>
                                        <div className="rounded-lg bg-gray-100 px-0 py-3 text-gray-800 font-medium mt-3">
                                            Commercial Production — $350 per spot
                                        </div>
                                        <p className="text-md text-gray-600 mt-1">Includes scripting support, personality selection, and polished video ready for broadcast.</p>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'investment' && (
                                <motion.div
                                    key="investment"
                                    className="space-y-6"
                                    variants={tabVariants}
                                    initial="in"
                                    animate="active"
                                    exit="out"
                                    transition={quick}
                                >
                                    <div>
                                        <h2 className="text-lg font-bold barlow-condensed-semibold text-gray-900 mb-4 ml-1">
                                            2026 Rates
                                        </h2>
                                        <motion.div
                                            className="grid gap-4 sm:grid-cols-2"
                                            variants={cardStagger}
                                            initial="in"
                                            animate="active"
                                        >
                                            <motion.div variants={cardItem} transition={quick} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:bg-amber-50/30 hover:border-amber-300 hover:shadow-md transition-all duration-300 hover:scale-[1.01]">
                                                <p className="text-sm font-semibold uppercase tracking-wide text-[#b59100]">1 Month</p>
                                                <p className="mt-1 text-2xl font-bold text-gray-900">$3,500<span className="text-sm font-normal text-gray-500">/mo</span></p>
                                                <p className="mt-2 text-sm text-gray-600">—</p>
                                                <p className="mt-2 text-sm text-gray-700">Product launches, announcements, short-term visibility</p>
                                            </motion.div>
                                            <motion.div variants={cardItem} transition={quick} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:bg-amber-50/30 hover:border-amber-300 hover:shadow-md transition-all duration-300 hover:scale-[1.01]">
                                                <p className="text-sm font-semibold uppercase tracking-wide text-[#b59100]">3 Months</p>
                                                <p className="mt-1 text-2xl font-bold text-gray-900">$3,250<span className="text-sm font-normal text-gray-500">/mo</span></p>
                                                <p className="mt-2 text-sm text-gray-600">$9,750 annual equivalent</p>
                                                <p className="mt-2 text-sm text-gray-700">Sustained awareness and retailer familiarity</p>
                                            </motion.div>
                                            <motion.div variants={cardItem} transition={quick} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:bg-amber-50/30 hover:border-amber-300 hover:shadow-md transition-all duration-300 hover:scale-[1.01]">
                                                <p className="text-sm font-semibold uppercase tracking-wide text-[#b59100]">6 Months</p>
                                                <p className="mt-1 text-2xl font-bold text-gray-900">$3,000<span className="text-sm font-normal text-gray-500">/mo</span></p>
                                                <p className="mt-2 text-sm text-gray-600">$18,000 annual equivalent</p>
                                                <p className="mt-2 text-sm text-gray-700">Strong market presence and brand reinforcement</p>
                                            </motion.div>
                                            <motion.div variants={cardItem} transition={quick} className="rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm hover:bg-amber-50/30 hover:border-amber-300 hover:shadow-md transition-all duration-300 hover:scale-[1.01]">
                                                <p className="text-sm font-semibold uppercase tracking-wide text-[#b59100]">12 Months</p>
                                                <p className="mt-1 text-2xl font-bold text-gray-900">$2,500<span className="text-sm font-normal text-gray-500">/mo</span></p>
                                                <p className="mt-2 text-sm text-gray-600">$30,000 annual equivalent</p>
                                                <p className="mt-2 text-sm text-gray-700">Category leadership and long-term industry positioning</p>
                                            </motion.div>
                                        </motion.div>
                                        <p className="mt-4 text-gray-700 text-md leading-relaxed">
                                            A one-year partnership offers the greatest strategic advantage, positioning your brand as a consistent and trusted voice within the retail community.
                                        </p>
                                    </div>
                                    <div className="pt-2 border-t border-gray-100">
                                        <h2 className="text-lg font-bold barlow-condensed-semibold text-gray-900 mb-2">
                                            Bring Your Brand to Life Through Trusted Video Personalities
                                        </h2>
                                        <p className="text-gray-700 mb-3">Great brands deserve exceptional storytelling.</p>
                                        <p className="text-gray-700 mb-4">
                                            Our podcast is supported by a curated roster of respected personalities who understand the natural health space and communicate product value with authenticity and authority.
                                        </p>
                                        <GalleryOfPersonalities />
                                    </div>
                                    <div className="pt-4 border-t border-gray-100">
                                        <h3 className="text-base font-semibold text-gray-900 mb-2">Why Brands Partner With Us</h3>
                                        <p className="text-gray-700 mb-2">Brands join the podcast to:</p>
                                        <ul className="space-y-1 list-disc list-inside marker:text-[#b59100] text-gray-700">
                                            <li>Reach a concentrated audience of natural health retailers across Canada</li>
                                            <li>Build credibility through association with a trusted industry voice</li>
                                            <li>Educate the market in a format designed for attention and retention</li>
                                            <li>Support a platform committed to elevating the entire ecosystem</li>
                                            <li>Maintain consistent presence through weekly exposure</li>
                                        </ul>
                                        <p className="mt-3 text-gray-700 leading-relaxed">
                                            Most importantly, partners help fuel a knowledge-driven community where better information leads to stronger retail outcomes.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'emerging' && (
                                <motion.div
                                    key="emerging"
                                    className="space-y-6 text-gray-700 leading-relaxed"
                                    variants={tabVariants}
                                    initial="in"
                                    animate="active"
                                    exit="out"
                                    transition={quick}
                                >
                                    <div>
                                        <h2 className="text-lg font-bold barlow-condensed-semibold text-gray-900 mb-3">
                                            Advertising Opportunities for New and Emerging Brands
                                        </h2>
                                        <p>
                                            Innovation often begins with smaller companies bringing fresh ideas to market. These voices deserve a platform.
                                        </p>
                                        <p>
                                            To support the next generation of leaders, we offer a dedicated partnership tier for early-stage brands.
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-900 mb-2">Eligibility Criteria</h3>
                                        <ul className="space-y-1 list-disc list-inside marker:text-[#b59100]">
                                            <li>In business two years or less</li>
                                            <li>Under $50,000 in revenue in the previous fiscal year</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-900 mb-3">Emerging Brand Rate Card</h3>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <motion.div
                                                variants={cardItem}
                                                initial="in"
                                                animate="active"
                                                transition={quick}
                                                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:bg-amber-50/30 hover:border-amber-300 hover:shadow-md transition-all duration-300 hover:scale-[1.01]"
                                            >
                                                <p className="text-sm font-semibold uppercase tracking-wide text-[#b59100]">Month-to-Month</p>
                                                <p className="mt-1 text-2xl font-bold text-gray-900">$1,500<span className="text-sm font-normal text-gray-500">/mo</span></p>
                                                <p className="mt-2 text-sm text-gray-700">Early exposure and initial retailer awareness</p>
                                            </motion.div>
                                            <motion.div
                                                variants={cardItem}
                                                initial="in"
                                                animate="active"
                                                transition={quick}
                                                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:bg-amber-50/30 hover:border-amber-300 hover:shadow-md transition-all duration-300 hover:scale-[1.01]"
                                            >
                                                <p className="text-sm font-semibold uppercase tracking-wide text-[#b59100]">6+ Month Commitment</p>
                                                <p className="mt-1 text-2xl font-bold text-gray-900">$1,000<span className="text-sm font-normal text-gray-500">/mo</span></p>
                                                <p className="mt-2 text-sm text-gray-700">Building recognition and long-term credibility</p>
                                            </motion.div>
                                        </div>
                                        <p className="mt-4 text-sm text-gray-700 leading-relaxed">
                                            Availability within this tier is intentionally limited to preserve category quality and ensure meaningful exposure for participating brands.
                                        </p>
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
                            <p className="text-sm font-semibold text-gray-900 mb-1">Let's Start the Conversation</p>
                            <p className="text-sm text-gray-600 mb-1">Contact:&nbsp;&nbsp;
                            <a
                                href="mailto:brandpartnerships@brucewcole.com"
                                className="text-[#b59100] hover:text-[#ffde59] font-medium text-sm underline underline-offset-2 transition-colors"
                            >
                                brandpartnerships@brucewcole.com
                            </a></p>
                        </motion.div>
                    </motion.div>
                </motion.div>

                <HeroNav />
            </section>

            <RecentVideos />
        </HomeLayout>
    );
}
