import VideoCard from '@/Components/VideoCard';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { useCallback, useState } from 'react';

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
};

export default function RecentVideos({ title = 'EPISODES', episodes = [] }) {
    const reduceMotion = useReduceMotion();
    const { props } = usePage();
    const Section = reduceMotion ? 'section' : motion.section;
    const Div = reduceMotion ? 'div' : motion.div;
    const H2 = reduceMotion ? 'h2' : motion.h2;
    const initialVideos = props.videos || [];
    const initialNextPage = props.nextPage ?? null;
    const initialHasMore = props.hasMore ?? false;

    const [videos, setVideos] = useState(() => (Array.isArray(episodes) && episodes.length > 0 ? episodes : initialVideos));
    const [nextPage, setNextPage] = useState(initialNextPage);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [loading, setLoading] = useState(false);

    const loadMore = useCallback(async () => {
        if (!nextPage || loading) return;
        setLoading(true);
        try {
            const url = `${route('api.videos.more')}?page=${nextPage}`;
            const res = await fetch(url);
            const data = await res.json();
            if (res.ok && data.videos?.length) {
                setVideos((prev) => [...prev, ...data.videos]);
                setNextPage(data.next_page ?? null);
                setHasMore(data.has_more ?? false);
            }
        } catch {
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, [nextPage, loading]);

    return (
        <Section
            className="relative h-auto overflow-hidden w-full max-w-7xl mx-auto flex flex-col items-center justify-center py-6 px-4 sm:px-6 lg:px-8 mb-12"
            id="episodes"
            {...(!reduceMotion && { initial: 'hidden', whileInView: 'visible', viewport: { once: true, amount: 0.12, margin: '60px 0px' }, variants: containerVariants })}
        >
            <H2
                className="text-4xl md:text-5xl font-bold barlow-condensed-semibold mb-12 w-full text-center"
                {...(!reduceMotion && { variants: itemVariants })}
            >
                {title}
            </H2>

            {videos.length === 0 ? (
                <Div
                    className="flex flex-col items-center justify-center py-16 px-6 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/30 max-w-xl mx-auto w-full"
                    {...(!reduceMotion && { variants: itemVariants })}
                >
                    <p className="text-2xl md:text-3xl font-semibold barlow-condensed-semibold text-gray-600 tracking-wide">
                        Launching Soon
                    </p>
                    <p className="mt-3 text-gray-600 text-center text-sm md:text-base leading-relaxed max-w-sm">New episodes are on the way. Check back soon.</p>
                </Div>
            ) : (
                <>
                    <Div
                        className="grid grid-cols-1 gap-6 w-full max-w-full"
                        {...(!reduceMotion && { variants: containerVariants })}
                    >
                        {videos.map((video, index) => (
                            <Div key={video.id ?? video.slug ?? index} {...(!reduceMotion && { variants: itemVariants })}>
                                <VideoCard video_data={video} />
                            </Div>
                        ))}
                    </Div>

                    {hasMore && (
                        <Div className="mt-10 flex flex-col items-center gap-4" {...(!reduceMotion && { variants: itemVariants })}>
                            {loading ? (
                                <div className="flex flex-col items-center gap-3 text-gray-600">
                                    <div className="h-10 w-10 border-2 border-[#ffde59] border-t-transparent rounded-full animate-spin" />
                                    <p className="text-sm font-medium">Please wait</p>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={loadMore}
                                    className="rounded-lg bg-[#b59100] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#ffde59] hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2"
                                >
                                    Load more
                                </button>
                            )}
                        </Div>
                    )}
                </>
            )}
        </Section>
    );
}
