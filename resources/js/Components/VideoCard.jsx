import { Link } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { useState } from 'react';

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

// Use the yellow theme color: #ffde59
const yellowShadow = '0 4px 32px 0 #ffde5966, 0 1.5px 8px 0 rgba(0,0,0,0.09)';

export default function VideoCard({ video_data, href, actionLabel = 'View Podcast' }) {
    const thumbnailUrl = video_data.thumbnail_url || '/assets/images/video-placeholder.png';
    const datePosted = formatDatePosted(video_data.created_at);
    const linkUrl = href ?? route('episode', { slug: video_data.slug });
    const [isPortrait, setIsPortrait] = useState(null);

    const handleImageLoad = (e) => {
        const img = e.target;
        if (img.naturalWidth && img.naturalHeight) {
            setIsPortrait(img.naturalHeight > img.naturalWidth);
        }
    };

    return (
        <Link href={linkUrl} className="block w-full group">
            <motion.article
                className="relative w-full bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col sm:flex-row sm:max-h-[235px] min-h-0 transition-shadow duration-300"
                whileHover={{
                    y: -4,
                    boxShadow: yellowShadow,
                    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] }
                }}
                transition={{ duration: 0.3 }}
                style={{ willChange: 'transform, box-shadow' }}
            >
                {/* Thumbnail - full width on mobile, wider on desktop; landscape box; portrait = contain + blurred bg */}
                <div className="sm:w-96 sm:min-w-[24rem] lg:w-[28rem] lg:min-w-[28rem] flex-shrink-0 overflow-hidden rounded-l-none rounded-t-xl sm:rounded-t-none sm:rounded-l-xl">
                    <motion.div
                        className="relative aspect-video sm:aspect-auto sm:h-full w-full max-h-[140px] sm:max-h-[235px] overflow-hidden flex-shrink-0"
                        whileHover={{ scale: 1.03 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {isPortrait && (
                            <div
                                className="absolute inset-0 bg-cover bg-center scale-110"
                                style={{
                                    backgroundImage: `url(${thumbnailUrl})`,
                                    filter: 'blur(12px)',
                                }}
                                aria-hidden
                            />
                        )}
                        <img
                            src={thumbnailUrl}
                            alt={video_data.title}
                            onLoad={handleImageLoad}
                            className={`w-full h-full relative z-10 ${isPortrait ? 'object-contain' : 'object-cover'}`}
                        />
                    </motion.div>
                </div>

                {/* Content - title and description start at top, View Podcast at bottom right */}
                <div className="flex-1 p-5 sm:p-6 flex flex-col justify-start gap-3 group-hover:bg-gray-50/80 transition-colors duration-300 min-h-0">

                    {datePosted && (
                        <p className="text-sm text-gray-500 plus-jakarta-sans-700">
                            Date Posted: {datePosted}
                        </p>
                    )}
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 group-hover:text-[#b59100] transition-colors duration-300">
                        {video_data.title}
                    </h3>
                    <p className="text-gray-600 group-hover:text-gray-800 transition-colors duration-300">
                        {(() => {
                            const desc = video_data.short_description;
                            if (!desc) return null;
                            if (desc.length <= 250) return desc;
                            return (
                                <>
                                    {desc.slice(0, 250)}&nbsp;...
                                </>
                            );
                        })()}
                    </p>
                    <div className="mt-auto pt-4 flex justify-end">
                        <span className="inline-flex items-center gap-2 text-[#b59100] font-semibold plus-jakarta-sans-700 group-hover:text-[#ffde59] transition-colors duration-300">
                            {actionLabel}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </span>
                    </div>
                </div>
            </motion.article>
        </Link>
    );
}
