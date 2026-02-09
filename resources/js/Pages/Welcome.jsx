import HeroVideoBackground from '@/Components/HeroVideoBackground';
import HeroNav from '@/Components/HeroNav';
import RecentVideos from '@/Components/RecentVideos';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head } from '@inertiajs/react';
import { motion } from 'framer-motion';

const heroTextVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.15 + 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    }),
};

export default function Welcome() {
    return (
        <HomeLayout>
            <Head title="Welcome" />
            <section className="relative h-[75vh] md:h-screen overflow-hidden flex flex-col">
                <HeroVideoBackground parallax />
                <div className="absolute inset-0 w-full max-w-7xl mx-auto flex flex-col items-center justify-center gap-2 z-10 pointer-events-none mt-[-100px] pt-10 md:pt-0">
                    <motion.h3
                        className="hero-top-text text-[#ffde59] plus-jakarta-sans-700"
                        custom={0}
                        variants={heroTextVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        PODCAST
                    </motion.h3>
                    <motion.h1
                        className="text-5xl font-bold text-white drop-shadow-lg hero-main-text text-center max-w-4xl anton-regular"
                        custom={1}
                        variants={heroTextVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        IN<br />CONVERSATION<br />WITH
                    </motion.h1>
                    <motion.h3
                        className="barlow-condensed-semibold text-[#ffde59] text-center text-2xl hero-bottom-text"
                        custom={2}
                        variants={heroTextVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        BRUCE W. COLE
                    </motion.h3>
                </div>

                <HeroNav />
            </section>

            <RecentVideos />
        </HomeLayout>
    );
}
