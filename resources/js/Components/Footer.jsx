import { SiApplepodcasts } from '@icons-pack/react-simple-icons';
import { Link } from '@inertiajs/react';
import { Tooltip } from 'react-tooltip';

export default function Footer() {
    return (
        <footer className="w-full border-t border-gray-200 bg-gray-900 text-gray-300">
            <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 
                lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-8">

                {/* Mobile Order: nav -> socials -> title section */}
                {/* Desktop Order: title section -> nav -> socials (default flex-row order) */}
                <nav
                    className="
                        order-2 flex flex-col gap-2 md:flex-row md:gap-6 
                    "
                    aria-label="Footer navigation"
                >
                    <Link
                        href={route('welcome')}
                        className="text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors"
                    >
                        Home
                    </Link>
                    <Link href={route('all-episodes-list')} className="text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors">
                        Episodes
                    </Link>
                    <Link
                        href={route('meet-bruce')}
                        className="text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors"
                    >
                        Meet&nbsp;Bruce
                    </Link>
                    <Link
                        href={route('guest-submissions')}
                        className="text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors"
                    >
                        Guest&nbsp;Submissions
                    </Link>
                    <Link
                        href={route('brand-partnerships')}
                        className="text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors"
                    >
                        Brand&nbsp;Partnerships
                    </Link>
                </nav>

                <div
                    className="
                        order-3 flex flex-col items-start ml-[-8px] 
                        lg:order-3
                    "
                >
                    <p className='text-sm font-medium text-gray-300 ml-2'>Follow and listen to us on:</p>
                    <div className='flex items-start gap-4 self-start lg:self-auto'>
                        <a
                            href="https://www.linkedin.com/company/in-conversation-with-bruce-w-cole/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-[#ffde59] transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50"
                            aria-label="LinkedIn"
                            data-tooltip-id="footer-social"
                            data-tooltip-content="LinkedIn"
                        >
                            <i className="bi bi-linkedin text-2xl"></i>
                        </a>
                        <a
                            href="https://youtube.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-[#ffde59] transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50"
                            aria-label="Listen on YouTube"
                            data-tooltip-id="footer-social"
                            data-tooltip-content="Listen on YouTube"
                        >
                            <i className="bi bi-youtube text-2xl"></i>
                        </a>
                        <a
                            href="https://spotify.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-[#ffde59] transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50"
                            aria-label="Listen on Spotify"
                            data-tooltip-id="footer-social"
                            data-tooltip-content="Listen on Spotify"
                        >
                            <i className="bi bi-spotify text-2xl"></i>
                        </a>
                        <a
                            href="https://podcasts.apple.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-[#ffde59] transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50"
                            aria-label="Listen on Apple Podcasts"
                            data-tooltip-id="footer-social"
                            data-tooltip-content="Listen on Apple Podcasts"
                        >
                            <SiApplepodcasts className="w-[24px] h-[24px]" />
                        </a>
                        <a
                            href="https://music.amazon.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-[#ffde59] transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50"
                            aria-label="Listen on Amazon Music"
                            data-tooltip-id="footer-social"
                            data-tooltip-content="Listen on Amazon Music"
                        >
                            <i className="bi bi-amazon text-2xl"></i>
                        </a>
                    </div>
                </div>

                <div
                    className="
                        order-1 text-left
                    "
                >
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#ffde59] plus-jakarta-sans-700">
                        Podcast
                    </p>
                    <p className="mt-0.5 text-xl font-bold leading-tight text-white anton-regular sm:text-2xl">
                        In Conversation With
                    </p>
                    <p className="mt-0.5 font-semibold text-[#ffde59] barlow-condensed-semibold" style={{ fontSize: "1.125rem", lineHeight: "1.75rem" }}>
                        Bruce W. Cole
                    </p>
                    <p className="mt-2 text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors hidden lg:block">
                        © Miramedia Retail Production. All rights reserved.
                    </p>
                </div>
                <p className="order-4 mt-2 text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors block lg:hidden">
                    © Miramedia Retail Production. All rights reserved.
                </p>
                <Tooltip id="footer-social" place="top" />
            </div>
        </footer>
    );
}
