import HeroVideoBackground from '@/Components/HeroVideoBackground';
import HeroNav from '@/Components/HeroNav';
import RecentVideos from '@/Components/RecentVideos';
import HomeLayout from '@/Layouts/HomeLayout';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Head, Link } from '@inertiajs/react';
import { motion } from 'framer-motion';

const heroTextVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.15 + 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    }),
};

export default function Welcome({ videos = [], current_time_and_date = null }) {
    console.log(current_time_and_date);

    const reduceMotion = useReduceMotion();
    const H2 = reduceMotion ? 'h2' : motion.h2;
    const H1 = reduceMotion ? 'h1' : motion.h1;

    return (
        <HomeLayout>
            <Head title="Welcome" />
            <section className="relative h-[75vh] md:h-screen overflow-hidden flex flex-col">
                <HeroVideoBackground parallax />
                <div className="absolute inset-0 w-full max-w-7xl mx-auto flex flex-col items-center justify-center gap-2 z-10 pointer-events-none mt-[-100px] pt-10 md:pt-0">
                    <H2
                        className="hero-top-text text-[#ffde59] plus-jakarta-sans-700"
                        {...(!reduceMotion && { custom: 0, variants: heroTextVariants, initial: 'hidden', animate: 'visible' })}
                    >
                        PODCAST
                    </H2>
                    <H1
                        className="text-5xl font-bold text-white drop-shadow-lg hero-main-text text-center max-w-4xl anton-regular"
                        {...(!reduceMotion && { custom: 1, variants: heroTextVariants, initial: 'hidden', animate: 'visible' })}
                    >
                        IN<br />CONVERSATION<br />WITH<br />BRUCE W. COLE
                    </H1>
                </div>

                <HeroNav />
            </section>

            {/* <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
                <p className="text-gray-700 text-lg leading-relaxed">
                    Explore the show:{' '}
                    <Link href={route('meet-bruce')} className="text-[#b59100] hover:text-[#ffde59] font-medium underline underline-offset-2 transition-colors">
                        meet host Bruce W. Cole
                    </Link>
                    ,{' '}
                    <Link href={route('guest-submissions')} className="text-[#b59100] hover:text-[#ffde59] font-medium underline underline-offset-2 transition-colors">
                        suggest a guest
                    </Link>
                    , or{' '}
                    <Link href={route('brand-partnerships')} className="text-[#b59100] hover:text-[#ffde59] font-medium underline underline-offset-2 transition-colors">
                        learn about brand partnerships
                    </Link>
                    .
                </p>
            </section> */}

            <RecentVideos episodes={videos} />
        </HomeLayout>
    );
}
