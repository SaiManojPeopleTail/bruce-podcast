import HeroNav from '@/Components/HeroNav';
import VideoCard from '@/Components/VideoCard';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 350;
const SORT_OPTIONS = [
    { value: 'latest', label: 'Latest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'title_asc', label: 'Title A-Z' },
    { value: 'title_desc', label: 'Title Z-A' },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.06, delayChildren: 0.05 },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

function isPreviousLink(link) {
    const label = (link.label || '').toString();
    return /previous|&laquo;|«/i.test(label);
}
function isNextLink(link) {
    const label = (link.label || '').toString();
    return /next|&raquo;|»/i.test(label);
}
function paginationLinkContent(link) {
    if (isPreviousLink(link)) return <ChevronLeft className="w-5 h-5" />;
    if (isNextLink(link)) return <ChevronRight className="w-5 h-5" />;
    return link.label;
}

export default function BrandShow({ brand, videos, filters = {} }) {
    const searchFromServer = filters.search || '';
    const sortFromServer = filters.sort || 'latest';

    const [searchInput, setSearchInput] = useState(searchFromServer);
    const debounceRef = useRef(null);

    useEffect(() => {
        setSearchInput(searchFromServer);
    }, [searchFromServer]);

    const applySearch = useCallback(
        (value) => {
            const search = (value || '').trim();
            router.get(
                route('our-brands-show', brand.id),
                { search: search || undefined, sort: sortFromServer, page: 1 },
                { preserveState: false }
            );
        },
        [brand.id, sortFromServer]
    );

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (searchInput === searchFromServer) return;
        debounceRef.current = setTimeout(() => applySearch(searchInput), DEBOUNCE_MS);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [searchInput, searchFromServer, applySearch]);

    const handleSortChange = useCallback(
        (e) => {
            const value = e.target?.value || 'latest';
            router.get(
                route('our-brands-show', brand.id),
                { search: searchFromServer || undefined, sort: value, page: 1 },
                { preserveState: false }
            );
        },
        [brand.id, searchFromServer]
    );

    const list = videos?.data || [];
    const links = videos?.links || [];

    return (
        <HomeLayout>
            <Head title={`${brand?.name || 'Brand'} | Our Brands`} />

            <div className="relative min-h-screen w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 py-16 md:py-20 mt-0 md:mt-8">
                <motion.section className="flex flex-col gap-4 md:gap-8" initial="hidden" animate="visible" variants={containerVariants}>
                    <motion.div className="flex items-center justify-between gap-3" variants={itemVariants}>
                        <Link
                            href={route('our-brands-list')}
                            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900 transition-colors"
                        >
                            <span aria-hidden>←</span>
                            Back to brands
                        </Link>
                    </motion.div>

                    <motion.div className="rounded-2xl bg-white" variants={itemVariants}>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr] md:gap-8 items-start">
                            <div className="w-full overflow-hidden rounded-xl border border-gray-200 p-1 hidden md:block">
                                {brand?.image_url ? (
                                    <img src={brand.image_url} alt={brand.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-56 w-full items-center justify-center text-sm text-gray-500">No image</div>
                                )}
                            </div>
                            <div>
                                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 barlow-condensed-semibold">{brand?.name}</h1>
                                <p className="mt-4 text-gray-700 leading-relaxed">{brand?.description || 'No description available.'}</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between" variants={itemVariants}>
                        <div className="relative flex-1 max-w-md">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="search"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search sponsor videos..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50 focus:border-[#ffde59]/40 transition-colors"
                                aria-label="Search sponsor videos"
                            />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <label htmlFor="brand-videos-sort" className="text-sm font-medium text-gray-600 whitespace-nowrap">
                                Sort by
                            </label>
                            <select
                                id="brand-videos-sort"
                                value={sortFromServer}
                                onChange={handleSortChange}
                                className="min-w-[150px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50 focus:border-[#ffde59]/40"
                            >
                                {SORT_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </motion.div>

                    {list.length === 0 ? (
                        <motion.div
                            className="mt-4 flex flex-col items-center justify-center py-20 px-6 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/30 max-w-xl mx-auto w-full"
                            variants={itemVariants}
                        >
                            <p className="text-xl md:text-2xl font-semibold barlow-condensed-semibold text-amber-900 tracking-wide">
                                {searchFromServer ? 'No results' : 'Coming soon'}
                            </p>
                            <p className="mt-2 text-gray-600 text-center text-sm md:text-base">
                                {searchFromServer ? 'No sponsor videos match your search. Try different keywords.' : 'No sponsor videos yet. Check back soon.'}
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div className="grid grid-cols-1 gap-6 w-full max-w-full" variants={containerVariants}>
                            {list.map((video) => (
                                <motion.div key={video.id} variants={itemVariants}>
                                    <VideoCard
                                        video_data={video}
                                        href={route('sponsor-video-show', { slug: video.slug })}
                                        actionLabel="View Sponsor"
                                    />
                                </motion.div>
                            ))}
                        </motion.div>
                    )}

                    {links.length > 1 && (
                        <motion.nav className="flex flex-wrap items-center justify-center gap-2 pt-2 pb-4" variants={itemVariants} aria-label="Sponsor videos pagination">
                            {links.map((link, i) => {
                                const isActive = link.active;
                                const isDisabled = !link.url;
                                const isPrev = isPreviousLink(link);
                                const isNext = isNextLink(link);

                                if (isDisabled) {
                                    return (
                                        <span key={i} className="inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg border border-gray-200 bg-gray-100 px-3 text-sm font-medium text-gray-400">
                                            {paginationLinkContent(link)}
                                        </span>
                                    );
                                }

                                return (
                                    <Link
                                        key={i}
                                        href={link.url}
                                        className={`inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 ${
                                            isActive
                                                ? 'border-[#b59100] bg-[#b59100] text-white'
                                                : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900'
                                        }`}
                                        aria-label={isPrev ? 'Previous page' : isNext ? 'Next page' : `Page ${link.label}`}
                                    >
                                        {paginationLinkContent(link)}
                                    </Link>
                                );
                            })}
                        </motion.nav>
                    )}
                </motion.section>
            </div>

            <HeroNav position="top" />
        </HomeLayout>
    );
}
