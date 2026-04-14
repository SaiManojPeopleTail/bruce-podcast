import HeroNav from '@/Components/HeroNav';
import HomeLayout from '@/Layouts/HomeLayout';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 350;
const SORT_OPTIONS = [
    { value: 'name_asc', label: 'Name A–Z' },
    { value: 'name_desc', label: 'Name Z–A' },
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

function buildRetailersUrl(params = {}) {
    const url = route('retailer-profiles-list');
    const search = params.search ?? '';
    const sort = params.sort ?? 'name_asc';
    const page = params.page;
    const query = {};
    if (search) query.search = search;
    if (sort && sort !== 'name_asc') query.sort = sort;
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
    if (isPreviousLink(link)) return <ChevronLeft className="h-5 w-5" />;
    if (isNextLink(link)) return <ChevronRight className="h-5 w-5" />;
    return link.label;
}

export default function PublicRetailersIndex({ retailers = [], filters = {}, pagination }) {
    const reduceMotion = useReduceMotion();
    const Section = reduceMotion ? 'section' : motion.section;
    const Div = reduceMotion ? 'div' : motion.div;
    const Nav = reduceMotion ? 'nav' : motion.nav;
    const lastPage = pagination?.last_page ?? 1;
    const total = pagination?.total ?? 0;
    const from = pagination?.from ?? 0;
    const to = pagination?.to ?? 0;
    const links = pagination?.links ?? [];

    const searchFromServer = filters.search ?? '';
    const sortFromServer = filters.sort ?? 'name_asc';

    const [searchInput, setSearchInput] = useState(searchFromServer);
    const debounceRef = useRef(null);

    useEffect(() => {
        setSearchInput(searchFromServer);
    }, [searchFromServer]);

    const applySearch = useCallback(
        (value) => {
            const trimmed = typeof value === 'string' ? value.trim() : '';
            const url = buildRetailersUrl({ search: trimmed || undefined, sort: sortFromServer, page: 1 });
            router.get(url, {}, { preserveState: false });
        },
        [sortFromServer],
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
            const value = e.target?.value || 'name_asc';
            const url = buildRetailersUrl({ search: searchFromServer, sort: value, page: 1 });
            router.get(url, {}, { preserveState: false });
        },
        [searchFromServer],
    );

    return (
        <HomeLayout>
            <Head title="Retailer Profiles" />

            <div className="relative mx-auto mt-0 flex min-h-screen w-full max-w-7xl flex-col px-4 py-16 md:mt-8 md:py-20 sm:px-6 lg:px-8">
                <Section
                    className="flex flex-col gap-4 md:gap-8"
                    {...(!reduceMotion && { initial: 'hidden', animate: 'visible', variants: containerVariants })}
                >
                    <Div className="flex items-center justify-between gap-3" {...(!reduceMotion && { variants: itemVariants })}>
                        <h1 className="barlow-condensed-semibold text-3xl font-bold text-gray-900 sm:text-4xl">Retailer Profiles</h1>
                    </Div>

                    <Div
                        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        {...(!reduceMotion && { variants: itemVariants })}
                    >
                        <div className="relative max-w-md flex-1">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                    />
                                </svg>
                            </span>
                            <input
                                type="search"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search retailers…"
                                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-gray-900 placeholder-gray-400 transition-colors focus:border-[#ffde59]/40 focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50"
                                aria-label="Search retailers"
                            />
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <label htmlFor="retailers-sort" className="whitespace-nowrap text-sm font-medium text-gray-600">
                                Sort by
                            </label>
                            <select
                                id="retailers-sort"
                                value={sortFromServer}
                                onChange={handleSortChange}
                                className="min-w-[140px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-[#ffde59]/40 focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50"
                            >
                                {SORT_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </Div>

                    {retailers.length === 0 ? (
                        <Div
                            className="mx-auto flex w-full max-w-xl flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/30 px-6 py-20"
                            {...(!reduceMotion && { variants: itemVariants })}
                        >
                            <p className="barlow-condensed-semibold text-xl font-semibold tracking-wide text-amber-900 md:text-2xl">
                                {searchFromServer ? 'No results' : 'No retailers yet'}
                            </p>
                            <p className="mt-2 text-center text-sm text-gray-600 md:text-base">
                                {searchFromServer
                                    ? 'No retailers match your search. Try different keywords.'
                                    : 'Check back soon for retailer profiles.'}
                            </p>
                        </Div>
                    ) : (
                        <>
                            <div className="grid w-full max-w-full grid-cols-1 gap-6">
                                {retailers.map((retailer) => (
                                    <Div key={retailer.id} {...(!reduceMotion && { variants: itemVariants })}>
                                        <Link
                                            href={route('retailer-profiles-show', retailer.handle)}
                                            className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md transition-[border-color,box-shadow] duration-300 ease-out hover:border-amber-300 hover:shadow-lg sm:flex-row"
                                        >
                                            <div className="min-w-0 flex-1 p-5">
                                                <h2 className="text-xl font-bold text-gray-900 transition-colors duration-300 ease-out group-hover:text-[#b59100]">
                                                    {retailer.name}
                                                </h2>
                                                <p className="mt-2 line-clamp-3 text-sm text-gray-600">
                                                    {retailer.description_preview?.trim()
                                                        ? retailer.description_preview
                                                        : 'No description yet.'}
                                                </p>
                                            </div>

                                            <div className="relative isolate hidden min-h-[7rem] w-44 shrink-0 overflow-hidden border-t border-gray-100 bg-gradient-to-br from-gray-50/90 to-white sm:block sm:border-l sm:border-t-0">
                                                {reduceMotion ? (
                                                    <div className="flex h-full min-h-[7rem] flex-col items-center justify-center gap-2 text-[#b59100]">
                                                        <ArrowRight className="h-8 w-8" aria-hidden />
                                                        <span className="text-sm font-semibold uppercase tracking-wide">View</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div
                                                            className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-100 transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:opacity-0"
                                                            aria-hidden
                                                        >
                                                            <ArrowRight className="h-8 w-8 shrink-0 text-gray-200" />
                                                            <span className="invisible text-sm font-semibold uppercase tracking-wide">View</span>
                                                        </div>
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-amber-50/95 text-[#b59100] opacity-0 transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:opacity-100">
                                                            <ArrowRight className="h-8 w-8 shrink-0" aria-hidden />
                                                            <span className="text-sm font-semibold uppercase tracking-wide">View</span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            <div className="border-t border-gray-200 px-4 py-3 text-center text-sm font-semibold text-[#b59100] sm:hidden">
                                                Click to view
                                            </div>
                                        </Link>
                                    </Div>
                                ))}
                            </div>

                            {lastPage > 1 && (
                                <Nav
                                    className="flex flex-wrap items-center justify-center gap-2 pb-4 pt-6"
                                    {...(!reduceMotion && { variants: itemVariants })}
                                    aria-label="Retailer profiles pagination"
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
                                                aria-label={
                                                    isPrev ? 'Previous page' : isNext ? 'Next page' : `Page ${link.label}`
                                                }
                                            >
                                                {paginationLinkContent(link)}
                                            </Link>
                                        );
                                    })}
                                </Nav>
                            )}

                            {total > 0 && (
                                <p className="text-center text-sm text-gray-500">
                                    Showing {from}–{to} of {total} retailers
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
