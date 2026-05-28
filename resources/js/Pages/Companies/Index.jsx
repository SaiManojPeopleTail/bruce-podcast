import CompanyCard from '@/Components/CompanyCard';
import HeroNav from '@/Components/HeroNav';
import HomeLayout from '@/Layouts/HomeLayout';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Head, Link, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

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

function buildListUrl(params = {}) {
    const url = route('companies-list');
    const search = params.search ?? '';
    const sort = params.sort ?? 'latest';
    const page = params.page;
    const query = {};
    if (search) query.search = search;
    if (sort && sort !== 'latest') query.sort = sort;
    if (page && page > 1) query.page = page;
    const qs = new URLSearchParams(query).toString();
    return qs ? `${url}?${qs}` : url;
}

export default function CompaniesIndex({ companies = [], filters = {}, pagination }) {
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
    const sortFromServer = filters.sort ?? 'latest';

    const [searchInput, setSearchInput] = useState(searchFromServer);
    const debounceRef = useRef(null);

    useEffect(() => {
        setSearchInput(searchFromServer);
    }, [searchFromServer]);

    const applySearch = useCallback((value) => {
        const trimmed = typeof value === 'string' ? value.trim() : '';
        router.get(buildListUrl({ search: trimmed || undefined, sort: sortFromServer, page: 1 }), {}, { preserveState: false });
    }, [sortFromServer]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (searchInput === searchFromServer) return;
        debounceRef.current = setTimeout(() => applySearch(searchInput), DEBOUNCE_MS);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [searchInput, searchFromServer, applySearch]);

    const handleSortChange = useCallback((e) => {
        const value = e.target?.value || 'latest';
        router.get(buildListUrl({ search: searchFromServer, sort: value, page: 1 }), {}, { preserveState: false });
    }, [searchFromServer]);

    return (
        <HomeLayout>
            <Head title="Companies" />
            <div className="relative min-h-screen w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 py-16 md:py-20 mt-0 md:mt-8">
                <Section
                    className="flex flex-col gap-4 md:gap-8"
                    {...(!reduceMotion && { initial: 'hidden', animate: 'visible', variants: containerVariants })}
                >
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 barlow-condensed-semibold tracking-tight">
                            Companies
                        </h1>
                        <p className="mt-2 text-gray-600 max-w-2xl">
                            Explore featured brands and connect with their AI concierge.
                        </p>
                    </div>

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
                                placeholder="Search companies…"
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50 focus:border-[#ffde59]/40 transition-colors"
                                aria-label="Search companies"
                            />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <label htmlFor="companies-sort" className="text-sm font-medium text-gray-600 whitespace-nowrap">
                                Sort by
                            </label>
                            <select
                                id="companies-sort"
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

                    {companies.length === 0 ? (
                        <Div
                            className="mt-4 flex flex-col items-center justify-center py-20 px-6 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/30 max-w-xl mx-auto w-full"
                            {...(!reduceMotion && { variants: itemVariants })}
                        >
                            <p className="text-xl md:text-2xl font-semibold barlow-condensed-semibold text-amber-900 tracking-wide">
                                {searchFromServer ? 'No results' : 'Coming soon'}
                            </p>
                            <p className="mt-2 text-gray-600 text-center text-sm md:text-base">
                                {searchFromServer
                                    ? 'No companies match your search. Try different keywords.'
                                    : 'Featured companies will appear here soon.'}
                            </p>
                        </Div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-6 w-full max-w-full">
                                {companies.map((company, index) => (
                                    <Div key={company.id ?? company.slug ?? index} {...(!reduceMotion && { variants: itemVariants })}>
                                        <CompanyCard company={company} />
                                    </Div>
                                ))}
                            </div>

                            {lastPage > 1 && (
                                <Nav
                                    className="flex flex-wrap items-center justify-center gap-2 pt-6 pb-4"
                                    {...(!reduceMotion && { variants: itemVariants })}
                                    aria-label="Companies pagination"
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
                                    Showing {from}–{to} of {total} companies
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
