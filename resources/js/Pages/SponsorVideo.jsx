import HeroNav from '@/Components/HeroNav';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

function formatDatePosted(createdAt) {
    if (!createdAt) return '';
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return createdAt;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export default function SponsorVideo({ video }) {
    const datePosted = formatDatePosted(video?.created_at);
    const [copied, setCopied] = useState(false);
    const copyTimeoutRef = useRef(null);

    const videoUrl = typeof window !== 'undefined' ? window.location.href : '';
    const embedUrl = video?.bunny_library_id && video?.bunny_video_id
        ? `https://iframe.mediadelivery.net/embed/${video.bunny_library_id}/${video.bunny_video_id}`
        : null;

    const handleShare = useCallback(async () => {
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        try {
            if (navigator.share) {
                await navigator.share({ url: videoUrl, title: video?.title ?? 'Sponsor Video' });
            } else {
                await navigator.clipboard.writeText(videoUrl);
            }
            setCopied(true);
            copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            try {
                await navigator.clipboard.writeText(videoUrl);
                setCopied(true);
                copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
            } catch {
                setCopied(false);
            }
        }
    }, [videoUrl, video?.title]);

    const handleBack = useCallback(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const fallbackUrl = route('all-episodes-list');
        const referrer = document.referrer;

        if (referrer && window.history.length > 1) {
            try {
                const referrerUrl = new URL(referrer);
                if (referrerUrl.origin === window.location.origin) {
                    window.history.back();
                    return;
                }
            } catch {
                // Ignore invalid referrer and use fallback.
            }
        }

        window.location.assign(fallbackUrl);
    }, []);

    useEffect(() => () => {
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    }, []);

    return (
        <HomeLayout>
            <Head title={video?.title ?? 'Sponsor Video'} />
            <section className="relative min-h-screen w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 py-20">
                <div className="flex items-center justify-start mb-1">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to videos
                    </button>
                </div>
                {embedUrl ? (
                    <div className="w-full h-auto rounded-3xl my-6 overflow-hidden bg-transparent" style={{
                        boxShadow: '0 0 15px 1px rgba(255, 222, 90, 0.5)',
                    }}>
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#ffde59]">
                            {video?.thumbnail_url && (
                                <div
                                    className="absolute inset-0 w-full h-full bg-cover bg-center z-0 blur-[10px] brightness-110 transition-opacity duration-200"
                                    style={{
                                        backgroundImage: `url(${video.thumbnail_url})`,
                                    }}
                                    aria-hidden
                                />
                            )}
                            <iframe
                                src={embedUrl}
                                title={video?.title || 'Sponsor video'}
                                className="w-full h-full aspect-video rounded-2xl relative z-10 bg-transparent"
                                allow="accelerometer; gyroscope; encrypted-media; picture-in-picture;"
                                allowFullScreen
                                style={{
                                    background: video?.thumbnail_url
                                        ? 'transparent'
                                        : '#ffde59',
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-64 rounded-xl border border-gray-200 my-6 flex items-center justify-center text-gray-500">
                        Video unavailable.
                    </div>
                )}

                <div className="flex items-start justify-between gap-4 mb-4 mx-1">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 min-w-0 flex-1">
                        {video?.title}
                    </h1>
                    <div className="relative shrink-0 pt-1">
                        <button
                            type="button"
                            onClick={handleShare}
                            className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 hover:text-[#b59100] focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50 focus:border-[#ffde59]/40 transition-colors"
                            aria-label="Share video"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z" />
                            </svg>
                        </button>
                        {copied && (
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium shadow-lg border border-[#ffde59]/40 whitespace-nowrap z-10 transition-opacity duration-200">
                                Link copied
                                <span className="absolute left-1/2 -translate-x-1/2 top-full border-[6px] border-transparent border-t-gray-900" aria-hidden />
                            </div>
                        )}
                    </div>
                </div>

                {datePosted && (
                    <p className="text-sm text-gray-500 plus-jakarta-sans-700 mb-4 mx-1">
                        Date Posted: {datePosted}
                    </p>
                )}
                <div
                    className="prose prose-lg text-gray-700 max-w-none mx-1 prose-p:leading-relaxed long-description"
                    dangerouslySetInnerHTML={{
                        __html: video?.long_description
                            ? video.long_description
                            : (video?.short_description ? `<p>${String(video.short_description).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : ''),
                    }}
                />
            </section>
            <HeroNav position="top" />
        </HomeLayout>
    );
}
