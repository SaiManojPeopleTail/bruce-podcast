import VideoCard from '@/Components/VideoCard';
import HeroNav from '@/Components/HeroNav';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const DEBOUNCE_MS = 350;
const SORT_OPTIONS = [
    { value: 'latest', label: 'Latest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'title_asc', label: 'Title A–Z' },
    { value: 'title_desc', label: 'Title Z–A' },
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

function buildListUrl(tab, params = {}) {
    const name = tab === 'all'
        ? 'all-episodes-list'
        : tab === 'sponsor-videos'
        ? 'sponsor-videos-list'
        : tab === 'clips'
            ? 'episodes-clips-list'
            : 'episodes-list';
    const url = route(name);
    const search = params.search ?? '';
    const sort = params.sort ?? 'latest';
    const brand = params.brand ?? '';
    const page = params.page;
    const query = {};
    if (search) query.search = search;
    if (sort && sort !== 'latest') query.sort = sort;
    if (tab === 'sponsor-videos' && brand) query.brand = brand;
    if (page && page > 1) query.page = page;
    const qs = new URLSearchParams(query).toString();
    return qs ? `${url}?${qs}` : url;
}

export default function Episodes({
    tab = 'episodes',
    allVideos = [],
    episodes = [],
    clips = [],
    sponsorVideos = [],
    brands = [],
    filters = {},
    pagination,
}) {
    const currentPage = pagination?.current_page ?? 1;
    const lastPage = pagination?.last_page ?? 1;
    const total = pagination?.total ?? 0;
    const from = pagination?.from ?? 0;
    const to = pagination?.to ?? 0;
    const links = pagination?.links ?? [];

    const searchFromServer = filters.search ?? '';
    const sortFromServer = filters.sort ?? 'latest';
    const brandFromServer = filters.brand ?? '';

    const [searchInput, setSearchInput] = useState(searchFromServer);
    const debounceRef = useRef(null);

    const list = tab === 'all' ? allVideos : tab === 'sponsor-videos' ? sponsorVideos : tab === 'clips' ? clips : episodes;
    const isAll = tab === 'all';
    const isSponsorVideos = tab === 'sponsor-videos';
    const isClips = tab === 'clips';
    const itemLabel = isAll ? 'videos' : isSponsorVideos ? 'sponsor videos' : isClips ? 'clips' : 'episodes';

    useEffect(() => {
        setSearchInput(searchFromServer);
    }, [searchFromServer]);

    const applySearch = useCallback(
        (value) => {
            const trimmed = typeof value === 'string' ? value.trim() : '';
            const url = buildListUrl(tab, {
                search: trimmed || undefined,
                sort: sortFromServer,
                brand: isSponsorVideos ? brandFromServer : undefined,
                page: 1,
            });
            router.get(url, {}, { preserveState: false });
        },
        [tab, sortFromServer, brandFromServer, isSponsorVideos]
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
            const url = buildListUrl(tab, {
                search: searchFromServer,
                sort: value,
                brand: tab === 'sponsor-videos' ? brandFromServer : undefined,
                page: 1,
            });
            router.get(url, {}, { preserveState: false });
        },
        [tab, searchFromServer, brandFromServer]
    );

    const handleBrandChange = useCallback(
        (e) => {
            const value = e.target?.value ?? '';
            const url = buildListUrl('sponsor-videos', {
                search: searchFromServer,
                sort: sortFromServer,
                brand: value || undefined,
                page: 1,
            });
            router.get(url, {}, { preserveState: false });
        },
        [searchFromServer, sortFromServer]
    );

    const allVideosUrl = useMemo(() => buildListUrl('all', { search: searchFromServer, sort: sortFromServer }), [searchFromServer, sortFromServer]);
    const episodesUrl = useMemo(() => buildListUrl('episodes', { search: searchFromServer, sort: sortFromServer }), [searchFromServer, sortFromServer]);
    const clipsUrl = useMemo(() => buildListUrl('clips', { search: searchFromServer, sort: sortFromServer }), [searchFromServer, sortFromServer]);
    const sponsorVideosUrl = useMemo(
        () => buildListUrl('sponsor-videos', { search: searchFromServer, sort: sortFromServer, brand: brandFromServer }),
        [searchFromServer, sortFromServer, brandFromServer]
    );

    const pageTitle = isAll ? 'All Videos' : isSponsorVideos ? 'Sponsor Videos' : isClips ? 'Clips' : 'Episodes';

    return (
        <HomeLayout>
            <Head title={pageTitle} />
            <div className="relative min-h-screen w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 py-16 md:py-20 mt-0 md:mt-8">
                <motion.section
                    className="flex flex-col gap-4 md:gap-8"
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                >
                    {/* Tabs */}
                    <nav className="flex ml-auto md:ml-0 gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200 max-w-max" aria-label="All videos, episodes, clips and sponsor videos">
                        <Link
                            href={allVideosUrl}
                            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 ${
                                isAll
                                    ? 'bg-[#ffde59] text-gray-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                            }`}
                        >
                            All
                        </Link>
                        <Link
                            href={episodesUrl}
                            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 ${
                                !isAll && !isSponsorVideos && !isClips
                                    ? 'bg-[#ffde59] text-gray-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                            }`}
                        >
                            Episodes
                        </Link>
                        <Link
                            href={clipsUrl}
                            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 ${
                                isClips
                                    ? 'bg-[#ffde59] text-gray-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                            }`}
                        >
                            Clips
                        </Link>
                        <Link
                            href={sponsorVideosUrl}
                            className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 ${
                                isSponsorVideos
                                    ? 'bg-[#ffde59] text-gray-600 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                            }`}
                        >
                            Sponsor Videos
                        </Link>
                    </nav>

                    {/* Search + Sort */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
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
                                placeholder={`Search ${itemLabel}…`}
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50 focus:border-[#ffde59]/40 transition-colors"
                                aria-label={`Search ${itemLabel}`}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 shrink-0">
                            {isSponsorVideos && brands.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <label htmlFor="episodes-brand" className="text-sm font-medium text-gray-600 whitespace-nowrap">
                                        Brand
                                    </label>
                                    <select
                                        id="episodes-brand"
                                        value={brandFromServer}
                                        onChange={handleBrandChange}
                                        className="min-w-[140px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50 focus:border-[#ffde59]/40"
                                    >
                                        <option value="">All</option>
                                        {brands.map((b) => (
                                            <option key={b.id} value={String(b.id)}>
                                                {b.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <label htmlFor="episodes-sort" className="text-sm font-medium text-gray-600 whitespace-nowrap">
                                    Sort by
                                </label>
                                <select
                                    id="episodes-sort"
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
                        </div>
                    </div>

                    {list.length === 0 ? (
                        <motion.div
                            className="mt-4 flex flex-col items-center justify-center py-20 px-6 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/30 max-w-xl mx-auto w-full"
                            variants={itemVariants}
                        >
                            <p className="text-xl md:text-2xl font-semibold barlow-condensed-semibold text-amber-900 tracking-wide">
                                {searchFromServer ? 'No results' : 'Coming soon'}
                            </p>
                            <p className="mt-2 text-gray-600 text-center text-sm md:text-base">
                                {searchFromServer
                                    ? `No ${itemLabel} match your search. Try different keywords.`
                                    : isSponsorVideos
                                        ? 'No sponsor videos yet. Check back soon.'
                                        : isClips
                                            ? 'No clips yet. Check back soon.'
                                        : isAll
                                            ? 'No videos yet. Check back soon.'
                                        : 'New episodes are on the way. Check back soon.'}
                            </p>
                        </motion.div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-6 w-full max-w-full">
                                {list.map((video, index) => (
                                    <motion.div key={video.id ?? video.slug ?? index} variants={itemVariants}>
                                        <VideoCard
                                            video_data={video}
                                            href={
                                                isAll
                                                    ? video.content_type === 'clip'
                                                        ? route('episode-clip-show', { slug: video.slug })
                                                        : video.content_type === 'sponsor-video'
                                                            ? route('sponsor-video-show', { slug: video.slug })
                                                            : undefined
                                                    : isSponsorVideos
                                                    ? route('sponsor-video-show', { slug: video.slug })
                                                    : isClips
                                                        ? route('episode-clip-show', { slug: video.slug })
                                                        : undefined
                                            }
                                            actionLabel={
                                                isClips || (isAll && video.content_type === 'clip')
                                                    ? 'View Clip'
                                                    : isSponsorVideos || (isAll && video.content_type === 'sponsor-video')
                                                        ? 'View Sponsor'
                                                        : 'View Podcast'
                                            }
                                        />
                                    </motion.div>
                                ))}
                            </div>

                            {lastPage > 1 && (
                                <motion.nav
                                    className="flex flex-wrap items-center justify-center gap-2 pt-6 pb-4"
                                    variants={itemVariants}
                                    aria-label={`${pageTitle} pagination`}
                                >
                                    {links.map((link, i) => {
                                        const isActive = link.active;
                                        const isDisabled = !link.url;
                                        const isPrev = isPreviousLink(link);
                                        const isNext = isNextLink(link);

                                        if (isDisabled) {
                                            return (
                                                <span
                                                    key={i}
                                                    className="inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-lg border border-gray-200 bg-gray-100 px-3 text-sm font-medium text-gray-400"
                                                >
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

                            {total > 0 && (
                                <p className="text-center text-sm text-gray-500">
                                    Showing {from}–{to} of {total} {itemLabel}
                                </p>
                            )}
                        </>
                    )}
                </motion.section>
            </div>
            <HeroNav position="top" />
        </HomeLayout>
    );
}
