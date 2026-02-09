import HeroVideoBackground from '@/Components/HeroVideoBackground';
import HeroNav from '@/Components/HeroNav';
import RecentVideos from '@/Components/RecentVideos';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head } from '@inertiajs/react';
import { motion } from 'framer-motion';

export default function About() {
    return (
        <HomeLayout>
            <Head title="About" />
            {/* Hero section: content only inside a card, nav at bottom */}
            <section className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-16 pb-28">
                <HeroVideoBackground />
                <div className="absolute inset-0 bg-black/50 z-0" />
                <motion.div
                    className="relative z-10 w-full max-w-7xl"
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <motion.div
                        className="bg-white/95 backdrop-blur rounded-2xl shadow-2xl p-6 sm:p-8 lg:p-10"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-12">
                            {/* Left: title and text */}
                            <div className="flex-1 order-2 lg:order-1">
                                <h1 className="text-4xl sm:text-5xl font-bold barlow-condensed-semibold text-gray-900 mb-6">
                                    About Bruce W. Cole
                                </h1>
                                <div className="space-y-4 text-gray-700 text-lg leading-relaxed">
                                    <p>
                                        <span className="font-bold">Bruce W. Cole</span> has been in the world of journalism and communications since 1975, the year he enrolled in the Humber College School of Journalism.
                                    </p>
                                    <p>
                                        Over the past 50+ years, his journalistic journey has included working on numerous community newspapers, a stint as editor of a national magazine in the Canadian heating, plumbing, air conditioning and mechanical engineering, and into corporate communications in the manufacturing, distribution and finance and insurance sectors.
                                    </p>
                                    <p>
                                        In 1995, Bruce joined the natural health industry as communications and trade show manager for the Canadian Health Food Association.
                                    </p>
                                    <p>
                                        Two years later, in 1997, Bruce and his wife Donna founded CNHR, with the goal of helping Canadian natural and organic retailers improve every aspect of their business.
                                    </p>
                                    <p>
                                        Over the years, he has travelled the country from coast to coast, visiting stores, and sharing the stories of the growth, evolution, and the many successes of health food retailers.
                                    </p>
                                    <p>
                                        He was recognized for his contributions to the Canadian natural health industry when he was awarded the 2024 CHFA Willie Pelzer Hall of Fame Award.
                                    </p>
                                </div>
                            </div>
                            {/* Right: image */}
                            <div className="flex-1 w-full max-w-sm lg:max-w-md order-1 lg:order-2">
                                <div className="aspect-[4/5] rounded-xl overflow-hidden shadow-xl bg-gray-200">
                                    <img
                                        src="/assets/images/bruce.png"
                                        alt="Bruce W. Cole"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.target.src = 'https://placehold.co/600x750/1a1a2e/ffde59?text=Bruce+W.+Cole';
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                <HeroNav />
            </section>

            <RecentVideos />
        </HomeLayout>
    );
}
