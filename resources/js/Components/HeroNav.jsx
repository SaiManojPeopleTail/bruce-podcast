import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Link, usePage } from '@inertiajs/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Episodes', path: '/all-episodes', other_active_paths: ['/episodes', '/episodes/clips', '/sponsor-videos'] },
    { name: 'Meet Bruce', path: '/meet-bruce' },
    { name: 'Guest Submissions', path: '/guest-submissions' },
    { name: 'Brand Partnerships', path: '/brand-partnerships' },
];

// Unstick when user scrolls back up near the top
const UNSTICK_SCROLL = 60;

const linkClass = `
    text-[#ffde59]
    plus-jakarta-sans-700
    text-xl
    drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]
    hover:text-[#b59100]
    border-none
    transition-colors duration-200
`;

// Helper to check if nav item is current, including other active paths
function isCurrentItem(item, url) {
    if (item.other_active_paths && Array.isArray(item.other_active_paths)) {
        if (
            item.other_active_paths.some(
                (path) =>
                    (path.startsWith('/') && url.startsWith(path))
                    || (!path.startsWith('/') && url.includes(path))
            )
        ) {
            return true;
        }
    }
    return url === item.path;
}

export default function HeroNav({ position = 'bottom' }) {
    const reduceMotion = useReduceMotion();
    const { url } = usePage();
    const [stuck, setStuck] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const navRef = useRef(null);
    const isTopNav = position === 'top';
    const Span = reduceMotion ? 'span' : motion.span;
    const MotionDiv = reduceMotion ? 'div' : motion.div;

    useEffect(() => {
        if (isTopNav) return;
        const onScroll = () => {
            if (stuck) {
                if (window.scrollY < UNSTICK_SCROLL) setStuck(false);
                return;
            }
            const el = navRef.current;
            if (!el) return;
            const { top } = el.getBoundingClientRect();
            if (top <= 0) setStuck(true);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [stuck, isTopNav]);

    useEffect(() => {
        if (menuOpen) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [menuOpen]);

    return (
        <>
            <div className="fixed top-4 right-4 z-30 hidden lg:block bg-black/95 backdrop-blur-sm rounded-full p-2 cursor-pointer px-4 hover:scale-[1.02] transition-all duration-200 shadow-lg text-sm text-gray-300 font-semibold text-[#ffde5a] hover:bg-white hover:shadow-xl hover:text-black cursor-pointer" onClick={() => window.location.href = 'mailto:hello@brucewcole.com'}>
                hello@brucewcole.com
            </div>
            {/* Mobile: floating hamburger top left */}
            <div className="fixed top-4 left-4 z-30 md:hidden">
                <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    className="flex flex-col justify-center gap-1.5 w-10 h-10 rounded-lg bg-black/60 backdrop-blur-sm border border-[#ffde59]/40 text-[#ffde59] p-2 shadow-lg focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50"
                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={menuOpen}
                >
                    <Span
                        className="block h-0.5 w-5 bg-current rounded-full origin-center"
                        style={reduceMotion && menuOpen ? { transform: 'rotate(45deg) translateY(6px)' } : undefined}
                        {...(!reduceMotion && { animate: menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }, transition: { duration: 0.2 } })}
                    />
                    <Span
                        className="block h-0.5 w-5 bg-current rounded-full"
                        style={reduceMotion ? { opacity: menuOpen ? 0 : 1, transform: menuOpen ? 'scaleX(0)' : 'scaleX(1)' } : undefined}
                        {...(!reduceMotion && { animate: menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }, transition: { duration: 0.2 } })}
                    />
                    <Span
                        className="block h-0.5 w-5 bg-current rounded-full origin-center"
                        style={reduceMotion && menuOpen ? { transform: 'rotate(-45deg) translateY(-6px)' } : undefined}
                        {...(!reduceMotion && { animate: menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }, transition: { duration: 0.2 } })}
                    />
                </button>
            </div>

            {/* Mobile: slide-out menu */}
            <AnimatePresence>
                {menuOpen && (
                    <>
                        <MotionDiv
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
                            style={reduceMotion ? {} : undefined}
                            {...(!reduceMotion && {
                                initial: { opacity: 0 },
                                animate: { opacity: 1 },
                                exit: { opacity: 0 },
                                transition: { duration: 0.2 },
                            })}
                            onClick={() => setMenuOpen(false)}
                            aria-hidden="true"
                        />
                        <MotionDiv
                            className="fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-black/95 backdrop-blur-md shadow-2xl z-20 md:hidden flex flex-col pt-20 px-6 pb-8"
                            style={reduceMotion ? {} : undefined}
                            {...(!reduceMotion && {
                                initial: { x: -280 },
                                animate: { x: 0 },
                                exit: { x: -280 },
                                transition: { type: 'spring', damping: 25, stiffness: 200 },
                            })}
                        >
                            <div className="flex flex-col flex-1">
                                {navItems.map((item) => {
                                    const current = isCurrentItem(item, url);
                                    return (
                                        <Link
                                            key={item.name}
                                            href={item.path}
                                            method="get"
                                            onClick={() => setMenuOpen(false)}
                                            className={`
                                                py-3 border-b border-white/10
                                                ${linkClass}
                                                ${current ? 'text-[#ffde59] font-bold' : ''}
                                            `}
                                        >
                                            {item.name}
                                            {current && (
                                                <span className="ml-2 text-[#ffde59]">●</span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                            <a
                                href="mailto:hello@brucewcole.com"
                                className="mt-auto pt-4 border-t border-white/10 text-[#ffde59] plus-jakarta-sans-700 text-sm font-semibold hover:text-[#b59100] transition-colors break-all"
                                onClick={() => setMenuOpen(false)}
                            >
                                hello@brucewcole.com
                            </a>
                        </MotionDiv>
                    </>
                )}
            </AnimatePresence>

            {/* Desktop: main nav (bottom of hero, then sticky at top; or always top when position="top") */}
            <nav
                ref={isTopNav ? undefined : navRef}
                className={`
                    left-0 right-0 w-full mx-auto flex flex-row items-center justify-center gap-10 z-20 pointer-events-auto py-3
                    transition-[background,box-shadow] duration-300
                    hidden md:flex
                    ${isTopNav || stuck
                        ? 'fixed top-0 left-0 right-0 px-4 bg-black/40 backdrop-blur-md shadow-lg py-4'
                        : 'absolute bottom-[20px] max-w-7xl'
                    }
                `}
            >
                {navItems.map((item) => {
                    const current = isCurrentItem(item, url);
                    return (
                        <div
                            key={item.name}
                            className="relative flex flex-col items-center px-4"
                        >
                            <Link
                                href={item.path}
                                method="get"
                                className={`${linkClass} ${current ? 'pointer-events-none' : ''}`}
                            >
                                {item.name}
                            </Link>
                            {current && (
                                <MotionDiv
                                    className="w-3/4 h-[4px] mt-2 rounded-full bg-[#ffde59] shadow-[0_2px_7px_#ffde59aa]"
                                    style={{ boxShadow: '0 2px 10px #ffde59cc' }}
                                />
                            )}
                        </div>
                    );
                })}
            </nav>
        </>
    );
}
