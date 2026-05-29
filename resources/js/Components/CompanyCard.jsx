import { useReduceMotion } from '@/hooks/useReduceMotion';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { useState } from 'react';

const yellowShadow = '0 4px 32px 0 #ffde5966, 0 1.5px 8px 0 rgba(0,0,0,0.09)';

export default function CompanyCard({ company }) {
    const reduceMotion = useReduceMotion();
    const hasImage = Boolean(company.thumbnail_url);
    const [imageFailed, setImageFailed] = useState(false);
    const showPlaceholder = !hasImage || imageFailed;
    const Article = reduceMotion ? 'article' : motion.article;
    const ThumbWrap = reduceMotion ? 'div' : motion.div;

    return (
        <a
            href={route('product-enquiry.index', { slug: company.slug })}
            // target="_blank"
            rel="noopener noreferrer"
            className="block w-full group"
        >
            <Article
                className="relative flex min-h-0 w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-md transition-shadow duration-300 sm:max-h-[245px] sm:flex-row"
                {...(!reduceMotion && {
                    whileHover: { y: -4, boxShadow: yellowShadow, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
                    transition: { duration: 0.3 },
                })}
            >
                {/* 16:9 thumbnail (1080p ratio) — full width on mobile, fixed column on sm+ */}
                <div className="w-full flex-shrink-0 overflow-hidden rounded-t-xl sm:w-96 sm:min-w-[24rem] sm:rounded-l-xl sm:rounded-t-none lg:w-[28rem] lg:min-w-[28rem]">
                    <ThumbWrap
                        className="relative aspect-video w-full overflow-hidden bg-gray-100 sm:aspect-auto sm:h-full sm:max-h-[245px]"
                        {...(!reduceMotion && { whileHover: { scale: 1.03 }, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } })}
                    >
                        {showPlaceholder ? (
                            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-400">
                                <Building2 className="h-12 w-12 opacity-60" strokeWidth={1.25} />
                                <span className="text-sm font-medium">No image</span>
                            </div>
                        ) : (
                            <img
                                src={company.thumbnail_url}
                                alt={company.title}
                                onError={() => setImageFailed(true)}
                                className="h-full w-full object-cover"
                            />
                        )}
                    </ThumbWrap>
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-start gap-2 overflow-hidden p-4 sm:gap-3 sm:p-6 group-hover:bg-gray-50/80 transition-colors duration-300">
                    <h3 className="line-clamp-2 text-lg font-bold text-gray-900 transition-colors duration-300 group-hover:text-[#b59100] sm:text-xl md:text-2xl">
                        {company.title}
                    </h3>
                    {company.short_description && (
                        <p className="line-clamp-3 text-sm leading-relaxed text-gray-600 transition-colors duration-300 group-hover:text-gray-800 sm:line-clamp-4 sm:text-base lg:line-clamp-5">
                            {company.short_description}
                        </p>
                    )}
                    <div className="mt-auto flex justify-end pt-2 sm:pt-0">
                        <span className="inline-flex items-center gap-2 font-semibold text-[#b59100] transition-colors duration-300 plus-jakarta-sans-700 group-hover:text-[#ffde59]">
                            View
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </span>
                    </div>
                </div>
            </Article>
        </a>
    );
}
