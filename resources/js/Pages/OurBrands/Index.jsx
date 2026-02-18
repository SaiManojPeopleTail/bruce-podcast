import HeroNav from '@/Components/HeroNav';
import HomeLayout from '@/Layouts/HomeLayout';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 350;
const SORT_OPTIONS = [
    { value: 'title_asc', label: 'Name A–Z' },
    { value: 'title_desc', label: 'Name Z–A' },
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

function buildBrandsUrl(params = {}) {
    const url = route('our-brands-list');
    const search = params.search ?? '';
    const sort = params.sort ?? 'title_asc';
    const page = params.page;
    const query = {};
    if (search) query.search = search;
    if (sort && sort !== 'title_asc') query.sort = sort;
    if (page && page > 1) query.page = page;
    const qs = new URLSearchParams(query).toString();
    return qs ? `${url}?${qs}` : url;
}

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

export default function BrandsIndex({ brands = [], filters = {}, pagination }) {
    const reduceMotion = useReduceMotion();
    const Section = reduceMotion ? 'section' : motion.section;
    const Div = reduceMotion ? 'div' : motion.div;
    const Nav = reduceMotion ? 'nav' : motion.nav;
    const currentPage = pagination?.current_page ?? 1;
    const lastPage = pagination?.last_page ?? 1;
    const total = pagination?.total ?? 0;
    const from = pagination?.from ?? 0;
    const to = pagination?.to ?? 0;
    const links = pagination?.links ?? [];

    const searchFromServer = filters.search ?? '';
    const sortFromServer = filters.sort ?? 'title_asc';

    const [searchInput, setSearchInput] = useState(searchFromServer);
    const debounceRef = useRef(null);

    useEffect(() => {
        setSearchInput(searchFromServer);
    }, [searchFromServer]);

    const applySearch = useCallback(
        (value) => {
            const trimmed = typeof value === 'string' ? value.trim() : '';
            const url = buildBrandsUrl({ search: trimmed || undefined, sort: sortFromServer, page: 1 });
            router.get(url, {}, { preserveState: false });
        },
        [sortFromServer]
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
            const value = e.target?.value || 'title_asc';
            const url = buildBrandsUrl({ search: searchFromServer, sort: value, page: 1 });
            router.get(url, {}, { preserveState: false });
        },
        [searchFromServer]
    );

    return (
        <HomeLayout>
            <Head title="Our Brands" />

            <div className="relative min-h-screen w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 py-16 md:py-20 mt-0 md:mt-8">
                <Section
                    className="flex flex-col gap-4 md:gap-8"
                    {...(!reduceMotion && { initial: 'hidden', animate: 'visible', variants: containerVariants })}
                >
                    <Div className="flex items-center justify-between gap-3" {...(!reduceMotion && { variants: itemVariants })}>
                        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 barlow-condensed-semibold">Our Brands</h1>
                    </Div>

                    <Div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between" {...(!reduceMotion && { variants: itemVariants })}>
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
                                placeholder="Search brands…"
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50 focus:border-[#ffde59]/40 transition-colors"
                                aria-label="Search brands"
                            />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <label htmlFor="brands-sort" className="text-sm font-medium text-gray-600 whitespace-nowrap">
                                Sort by
                            </label>
                            <select
                                id="brands-sort"
                                value={sortFromServer}
                                onChange={handleSortChange}
                                className="min-w-[140px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50 focus:border-[#ffde59]/40"
                            >
                                {SORT_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </Div>

                    {brands.length === 0 ? (
                        <Div
                            className="flex flex-col items-center justify-center py-20 px-6 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/30 max-w-xl mx-auto w-full"
                            {...(!reduceMotion && { variants: itemVariants })}
                        >
                            <p className="text-xl md:text-2xl font-semibold barlow-condensed-semibold text-amber-900 tracking-wide">
                                {searchFromServer ? 'No results' : 'Coming soon'}
                            </p>
                            <p className="mt-2 text-gray-600 text-center text-sm md:text-base">
                                {searchFromServer ? 'No brands match your search. Try different keywords.' : 'Brands will appear here soon.'}
                            </p>
                        </Div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full max-w-full">
                                {brands.map((brand) => (
                                    <Div key={brand.id} {...(!reduceMotion && { variants: itemVariants })}>
                                        <Link
                                            href={route('our-brands-show', brand.id)}
                                            className="group block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md transition-all hover:border-amber-300 hover:shadow-lg"
                                        >
                                            <div className="h-44 w-full overflow-hidden">
                                                {brand.image_url ? (
                                                    <img
                                                        src={brand.image_url}
                                                        alt={brand.name}
                                                        className="h-full w-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">No image</div>
                                                )}
                                            </div>
                                            <div className="p-5">
                                                <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#b59100] transition-colors">
                                                    {brand.name}
                                                </h2>
                                                <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                                                    {brand.description || 'No description available.'}
                                                </p>
                                                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#b59100]">
                                                    {brand.sponsor_videos_count ?? 0} Sponsor Videos
                                                </p>
                                            </div>
                                        </Link>
                                    </Div>
                                ))}
                            </div>

                            {lastPage > 1 && (
                                <Nav
                                    className="flex flex-wrap items-center justify-center gap-2 pt-6 pb-4"
                                    {...(!reduceMotion && { variants: itemVariants })}
                                    aria-label="Our Brands pagination"
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
                                </Nav>
                            )}

                            {total > 0 && (
                                <p className="text-center text-sm text-gray-500">
                                    Showing {from}–{to} of {total} brands
                                </p>
                            )}
                        </>
                    )}
                </Section>
            </div>

            <HeroNav position="top" />
        </HomeLayout>
    );
}
