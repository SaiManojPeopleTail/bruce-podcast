import { useReduceMotion } from '@/hooks/useReduceMotion';
import { motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { useState } from 'react';

const yellowShadow = '0 4px 32px 0 #ffde5966, 0 1.5px 8px 0 rgba(0,0,0,0.09)';

function truncateDescription(desc, maxLen) {
    if (!desc) return null;
    if (desc.length <= maxLen) return desc;
    return `${desc.slice(0, maxLen)} …`;
}

export default function CompanyCard({ company }) {
    const reduceMotion = useReduceMotion();
    const hasImage = Boolean(company.thumbnail_url);
    const [imageFailed, setImageFailed] = useState(false);
    const showPlaceholder = !hasImage || imageFailed;
    const Article = reduceMotion ? 'article' : motion.article;
    const ThumbWrap = reduceMotion ? 'div' : motion.div;

    const desc = truncateDescription(
        company.short_description,
        typeof window !== 'undefined' && window.innerWidth < 640 ? 180 : 250,
    );

    return (
        <a
            href={company.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full group"
        >
            <Article
                className="relative w-full bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col sm:flex-row sm:max-h-[245px] min-h-0 transition-shadow duration-300"
                {...(!reduceMotion && {
                    whileHover: { y: -4, boxShadow: yellowShadow, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
                    transition: { duration: 0.3 },
                })}
            >
                <div className="sm:w-96 sm:min-w-[24rem] lg:w-[28rem] lg:min-w-[28rem] flex-shrink-0 overflow-hidden rounded-l-none rounded-t-xl sm:rounded-t-none sm:rounded-l-xl">
                    <ThumbWrap
                        className="relative aspect-video sm:aspect-auto sm:h-full w-full max-h-[224px] sm:max-h-[245px] overflow-hidden flex-shrink-0 bg-gray-100"
                        {...(!reduceMotion && { whileHover: { scale: 1.03 }, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } })}
                    >
                        {showPlaceholder ? (
                            <div className="flex h-full min-h-[12rem] sm:min-h-0 w-full flex-col items-center justify-center gap-2 text-gray-400">
                                <Building2 className="h-12 w-12 opacity-60" strokeWidth={1.25} />
                                <span className="text-sm font-medium">No image</span>
                            </div>
                        ) : (
                            <img
                                src={company.thumbnail_url}
                                alt={company.title}
                                onError={() => setImageFailed(true)}
                                className="w-full h-full object-cover"
                            />
                        )}
                    </ThumbWrap>
                </div>

                <div className="flex-1 p-5 sm:p-6 flex flex-col justify-start gap-3 group-hover:bg-gray-50/80 transition-colors duration-300 min-h-0">
                    <h3 className="text-xl md:text-2xl font-bold text-gray-900 group-hover:text-[#b59100] transition-colors duration-300">
                        {company.title}
                    </h3>
                    {desc && (
                        <p className="text-gray-600 group-hover:text-gray-800 transition-colors duration-300">
                            {desc}
                        </p>
                    )}
                    <div className="mt-auto pt-4 flex justify-end">
                        <span className="inline-flex items-center gap-2 text-[#b59100] font-semibold plus-jakarta-sans-700 group-hover:text-[#ffde59] transition-colors duration-300">
                            View Company
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </span>
                    </div>
                </div>
            </Article>
        </a>
    );
}
