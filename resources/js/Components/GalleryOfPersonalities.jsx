import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const GAP = 8;
const VISIBLE = 3;

const DUMMY_PEOPLE = [
    { id: 1, name: 'Alex Morgan', role: 'Host & Producer' },
    { id: 2, name: 'Jordan Lee', role: 'Industry Analyst' },
    { id: 3, name: 'Sam Taylor', role: 'Retail Expert' },
    { id: 4, name: 'Casey Kim', role: 'Wellness Advocate' },
    { id: 5, name: 'Riley Chen', role: 'Natural Health Specialist' },
    { id: 6, name: 'Morgan Blake', role: 'Brand Strategist' },
    { id: 7, name: 'Quinn Davis', role: 'Consumer Insights' },
    { id: 8, name: 'Jamie Ross', role: 'Supply Chain Lead' },
    { id: 9, name: 'Skyler Green', role: 'Retail Relations' },
    { id: 10, name: 'Drew Palmer', role: 'Content Director' },
];

function PersonCard({ person, width }) {
    const initial = person.name.split(' ').map((n) => n[0]).join('').slice(0, 2);
    return (
        <div
            className="flex shrink-0 snap-center flex-col items-center rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            style={width ? { width: `${width}px` } : undefined}
        >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-lg font-semibold text-amber-800">
                {initial}
            </div>
            <p className="mt-2 text-center text-sm font-semibold text-gray-900">{person.name}</p>
            <p className="mt-0.5 text-center text-xs text-gray-600">{person.role}</p>
        </div>
    );
}

export default function GalleryOfPersonalities({ people = DUMMY_PEOPLE, className = '' }) {
    const scrollRef = useRef(null);
    const wrapperRef = useRef(null);
    const [cardWidth, setCardWidth] = useState(0);

    const duplicated = [...people, ...people];

    const checkInfinite = useCallback(() => {
        const el = scrollRef.current;
        if (!el || !people.length || !cardWidth) return;
        const threshold = people.length * (cardWidth + GAP);
        if (el.scrollLeft >= threshold - 20) {
            el.scrollLeft -= threshold;
        }
    }, [people.length, cardWidth]);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;
        const updateWidth = () => {
            const w = wrapper.clientWidth;
            setCardWidth(Math.floor((w - (VISIBLE - 1) * GAP) / VISIBLE));
        };
        updateWidth();
        const ro = new ResizeObserver(updateWidth);
        ro.observe(wrapper);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', checkInfinite, { passive: true });
        return () => el.removeEventListener('scroll', checkInfinite);
    }, [checkInfinite]);

    const scrollStep = cardWidth + GAP;
    const scrollLeft = () => {
        const el = scrollRef.current;
        if (el) el.scrollBy({ left: -scrollStep, behavior: 'smooth' });
    };
    const scrollRight = () => {
        const el = scrollRef.current;
        if (el) el.scrollBy({ left: scrollStep, behavior: 'smooth' });
    };

    const arrowClass =
        'flex shrink-0 items-center justify-center w-10 h-10 rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-amber-50 hover:border-amber-300 hover:text-amber-800 transition-colors disabled:opacity-40 disabled:pointer-events-none';

    return (
        <div className={className}>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={scrollLeft}
                    className={arrowClass}
                    aria-label="Previous"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div ref={wrapperRef} className="flex-1 min-w-0">
                    <div
                        ref={scrollRef}
                        className="flex overflow-x-auto overflow-y-hidden py-2 pb-4 scroll-smooth scrollbar-hide"
                        style={{
                            gap: GAP,
                            scrollSnapType: 'x mandatory',
                            WebkitOverflowScrolling: 'touch',
                        }}
                    >
                        {duplicated.map((person, index) => (
                            <div key={`${person.id}-${index}`} style={{ scrollSnapAlign: 'center' }}>
                                <PersonCard person={person} width={cardWidth} />
                            </div>
                        ))}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={scrollRight}
                    className={arrowClass}
                    aria-label="Next"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
