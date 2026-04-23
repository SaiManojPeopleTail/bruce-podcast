import GalleryOfPersonalities from '@/Components/GalleryOfPersonalities';
import HeroVideoBackground from '@/Components/HeroVideoBackground';
import HeroNav from '@/Components/HeroNav';
import RecentVideos from '@/Components/RecentVideos';
import HomeLayout from '@/Layouts/HomeLayout';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Head, Link } from '@inertiajs/react';
import { motion } from 'framer-motion';

const quick = { duration: 0.2, ease: 'easeOut' };
const cardStagger = { staggerChildren: 0.05, delayChildren: 0.02 };
const cardItem = { in: { opacity: 0, y: 8 }, active: { opacity: 1, y: 0 } };

export default function BrandPartnerships({ brands = [], personalities = [] }) {
    const reduceMotion = useReduceMotion();
    const Div = reduceMotion ? 'div' : motion.div;
    const Card = reduceMotion ? 'div' : motion.div;

    return (
        <HomeLayout>
            <Head title="Brand Partnerships" />
            <section className="relative min-h-screen overflow-hidden flex flex-col items-center justify-start px-4 sm:px-6 lg:px-8 py-16 pb-28">
                <HeroVideoBackground />
                <div className="absolute inset-0 bg-black/50 z-0" />
                <Div
                    className="relative z-10 w-full max-w-7xl flex flex-col"
                    {...(!reduceMotion && { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25, ease: 'easeOut' } })}
                >
                    <Div
                        className="relative bg-white/95 backdrop-blur rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh] min-h-[400px]"
                        {...(!reduceMotion && { initial: { opacity: 0, scale: 0.99 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.2, delay: 0.05, ease: 'easeOut' } })}
                    >
                        <Link
                            href={route('welcome')}
                            className="absolute top-2 right-2 flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-[#ffde5950] border-2 border-[#ffde5970] hover:border-[#ffde59] hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 z-10"
                            aria-label="Close and return to home"
                        >
                            <span className="text-2xl font-medium leading-none" aria-hidden="true">×</span>
                        </Link>

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto min-h-0 px-6 sm:px-8 pt-6 sm:pt-8 pb-4">
                            {/* Hero */}
                            <div className="mb-8 pr-10">
                                <h1 className="text-3xl sm:text-4xl font-bold barlow-condensed-semibold text-gray-900 mb-2">
                                    Brand Partnerships
                                </h1>
                                <p className="text-base font-semibold text-[#b59100]">
                                    Put your brand in front of Canada's leading natural health retailers
                                </p>
                                <p className="mt-3 text-gray-700 leading-relaxed">
                                    The Retail Spotlight Series is a premium feature designed to introduce your product directly to over 1,000 natural health retailers across Canada through a coordinated, multi-channel approach.
                                </p>
                                <p className="mt-2 text-gray-700 leading-relaxed">
                                    Instead of a single ad, this is a complete brand story delivered across video, audio, written content, and social media.
                                </p>
                            </div>

                            {/* What You Get */}
                            <div className="mb-8">
                                <h2 className="text-2xl font-bold barlow-condensed-semibold text-gray-900 mb-5 pl-2">
                                    What You Get
                                </h2>

                                <div className="space-y-5">
                                    {/* Featured Brand Interview */}
                                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                                        <h3 className="text-base font-semibold text-gray-900 mb-2">Featured Brand Interview</h3>
                                        <p className="text-sm text-gray-700 mb-3">
                                            A professionally hosted 10-minute interview with one of our co-hosts, focused on:
                                        </p>
                                        <ul className="space-y-1 list-disc list-inside marker:text-[#b59100] text-sm text-gray-700 mb-3">
                                            <li>Who you are</li>
                                            <li>What your product does</li>
                                            <li>What makes it different</li>
                                            <li>Why retailers should carry it</li>
                                        </ul>
                                        <p className="text-sm text-gray-600 italic">
                                            This is your opportunity to clearly tell your story in a way retailers understand.
                                        </p>

                                        {/* Personality gallery */}
                                        <div className="mt-5 pt-4 border-t border-gray-100">
                                            {/* <p className="text-xs font-semibold uppercase tracking-wide text-[#b59100] mb-3">Our Co-Hosts</p> */}
                                            <GalleryOfPersonalities people={personalities} />
                                        </div>
                                    </div>

                                    {/* Podcast + Written + Social — combined */}
                                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
                                        <div>
                                            <h3 className="text-base font-semibold text-gray-900 mb-2">Podcast Exposure</h3>
                                            <p className="text-sm text-gray-700">
                                                Your interview is turned into a 30-second sponsored segment featured within the <em>In Conversation with Bruce W. Cole</em> podcast.
                                            </p>
                                            <p className="text-sm text-gray-700 mt-2">
                                                This ensures your brand is heard repeatedly by our audience of industry professionals.
                                            </p>
                                        </div>
                                        <div className="border-t border-gray-100 pt-5">
                                            <h3 className="text-base font-semibold text-gray-900 mb-2">Written Feature in Retail Mailer</h3>
                                            <p className="text-sm text-gray-700">
                                                Your content is developed into a written article and included in our <em>Insights and Learnings</em> mailer, distributed to over 1,000 retailers across Canada.
                                            </p>
                                            <p className="text-sm text-gray-700 mt-2">
                                                This gives retailers a clear, structured overview of your product and where they can buy it.
                                            </p>
                                        </div>
                                        <div className="border-t border-gray-100 pt-5">
                                            <h3 className="text-base font-semibold text-gray-900 mb-2">Social Media Distribution</h3>
                                            <p className="text-sm text-gray-700">
                                                Your feature is shared across our LinkedIn and social channels, reaching key decision-makers and leaders in the Canadian natural health industry.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Why it works */}
                            <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50/40 p-5">
                                <p className="text-sm font-semibold text-gray-900 mb-2">Help retailers discover, understand, and choose your brand.</p>
                                <p className="text-sm text-gray-700 mb-3">
                                    Retailers don't bring in products they don't understand. The Retail Spotlight Series ensures your brand is:
                                </p>
                                <ul className="space-y-1 list-disc list-inside marker:text-[#b59100] text-sm text-gray-700 mb-3">
                                    <li>Seen</li>
                                    <li>Heard</li>
                                    <li>Explained clearly</li>
                                    <li>Repeated across multiple touchpoints</li>
                                </ul>
                                <p className="text-sm text-gray-700">
                                    So retailers can confidently decide to carry your product.
                                </p>
                            </div>

                            {/* Pricing */}
                            <div className="mb-8">
                                <h2 className="text-xl font-bold barlow-condensed-semibold text-gray-900 mb-1">Pricing</h2>
                                <p className="text-xs text-gray-500 mb-4">Limited spots available each month.</p>
                                <Card
                                    className="grid gap-4 sm:grid-cols-2"
                                    {...(!reduceMotion && { variants: cardStagger, initial: 'in', animate: 'active' })}
                                >
                                    <Card
                                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:bg-amber-50/30 hover:border-amber-300 hover:shadow-md transition-all duration-300 hover:scale-[1.01]"
                                        {...(!reduceMotion && { variants: cardItem, transition: quick })}
                                    >
                                        <p className="text-sm font-semibold uppercase tracking-wide text-[#b59100]">Per Feature</p>
                                        <p className="mt-1 text-2xl font-bold text-gray-900">$3,000</p>
                                        <p className="mt-2 text-sm text-gray-600">Single feature</p>
                                    </Card>
                                    <Card
                                        className="rounded-xl border-2 border-amber-300 bg-amber-50/20 p-5 shadow-sm hover:bg-amber-50/40 hover:shadow-md transition-all duration-300 hover:scale-[1.01]"
                                        {...(!reduceMotion && { variants: cardItem, transition: quick })}
                                    >
                                        <p className="text-sm font-semibold uppercase tracking-wide text-[#b59100]">3+ Commitments</p>
                                        <p className="mt-1 text-2xl font-bold text-gray-900">$2,500<span className="text-sm font-normal text-gray-500">/feature</span></p>
                                        <p className="mt-2 text-sm text-gray-600">Best value — save $500 per feature</p>
                                    </Card>
                                </Card>
                            </div>

                            {/* Get Featured */}
                            <div className="mb-6 rounded-xl border border-gray-100 bg-white p-5">
                                <h2 className="text-lg font-bold barlow-condensed-semibold text-gray-900 mb-2">Get Featured</h2>
                                <p className="text-sm text-gray-700 mb-3">
                                    If you're ready to introduce your brand to retailers in a clear and consistent way, we'd be happy to connect.
                                </p>
                                {/* <p className="text-sm text-gray-600">
                                    Email our team to book your next campaign:&nbsp;
                                    <a
                                        href="mailto:brandpartnerships@brucewcole.com"
                                        className="text-[#b59100] hover:text-[#9a7d08] font-medium underline underline-offset-2 transition-colors"
                                    >
                                        brandpartnerships@brucewcole.com
                                    </a>
                                </p> */}
                            </div>
                        </div>

                        {/* Fixed footer bar */}
                        <Div
                            className="shrink-0 border-t border-gray-200 bg-gray-50/80 px-6 sm:px-8 py-4"
                            {...(!reduceMotion && { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25, delay: 0.15 } })}
                        >
                            {/* {brands.length > 0 && (
                                <p className="mb-2 text-xs text-gray-500">Active partner brands: {brands.length}</p>
                            )} */}
                            <p className="text-sm font-semibold text-gray-900 mb-1">Let's Start the Conversation</p>
                            <p className="text-sm text-gray-600">
                                Contact:&nbsp;&nbsp;
                                <a
                                    href="mailto:brandpartnerships@brucewcole.com"
                                    className="text-[#b59100] hover:text-[#ffde59] font-medium text-sm underline underline-offset-2 transition-colors"
                                >
                                    brandpartnerships@brucewcole.com
                                </a>
                            </p>
                        </Div>
                    </Div>
                </Div>

                <HeroNav />
            </section>

            <RecentVideos />
        </HomeLayout>
    );
}
