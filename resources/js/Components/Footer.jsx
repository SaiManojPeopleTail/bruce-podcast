import { SiApplepodcasts} from '@icons-pack/react-simple-icons';
import { Link } from '@inertiajs/react';
import { Tooltip } from 'react-tooltip';

export default function Footer() {
    return (
        <footer className="w-full border-t border-gray-200 bg-gray-900 text-gray-300">
            <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:px-8">
                {/* Left: hero text compact, left-aligned */}
                <div className="text-left">

                    <p className="text-sm font-semibold uppercase tracking-widest text-[#ffde59] plus-jakarta-sans-700">
                        Podcast
                    </p>
                    <p className="mt-0.5 text-xl font-bold leading-tight text-white anton-regular sm:text-2xl">
                        In Conversation With
                    </p>
                    <p className="mt-0.5 font-semibold text-[#ffde59] barlow-condensed-semibold" style={{ fontSize: "1.125rem", lineHeight: "1.75rem" }}>
                        Bruce W. Cole
                    </p>
                    <p className="mt-2 text-xs text-gray-100 leading-relaxed">
                        © Miramedia Retail Production. All rights reserved.
                    </p>
                </div>

                {/* Middle: pages */}
                <nav className="flex flex-col gap-2 sm:flex-row sm:gap-6" aria-label="Footer navigation">
                    <Link
                        href={route('welcome')}
                        className="text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors"
                    >
                        Home
                    </Link>
                    <Link
                        href={route('meet-bruce')}
                        className="text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors"
                    >
                        Meet Bruce
                    </Link>
                    <Link
                        href={route('guest-submission')}
                        className="text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors"
                    >
                        Guest Submission
                    </Link>
                    <Link
                        href={route('brand-partnerships')}
                        className="text-sm font-medium text-gray-300 hover:text-[#ffde59] transition-colors"
                    >
                        Brand Partnerships
                    </Link>
                </nav>

                {/* Right: social icons - always align to the right */}
                <div className="flex flex-col items-start">
                    <p className='text-sm font-medium text-gray-300'>Follow and listen to us on:</p>
                    <div className='flex items-center gap-4 self-end lg:self-auto'>
                    <a
                        href="https://www.linkedin.com/company/in-conversation-with-bruce-w-cole/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-[#ffde59] transition-colors rounded focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50"
                        aria-label="LinkedIn"
                        data-tooltip-id="footer-social"
                        data-tooltip-content="LinkedIn"
                    >

                        <i class="bi bi-linkedin text-2xl"></i>
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
                        <i class="bi bi-youtube text-2xl"></i>
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
                        <i class="bi bi-spotify text-2xl"></i>
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

                        <i class="bi bi-amazon text-2xl"></i>
                    </a>
                    </div>
                </div>
                <Tooltip id="footer-social" place="top" />
            </div>
        </footer>
    );
}
