import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/**
 * Returns true on mobile (width < 768px) or when user prefers reduced motion.
 * Use to disable Framer Motion animations and avoid glitches on touch devices.
 */
export function useReduceMotion() {
    const [reduce, setReduce] = useState(true);

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const pref = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduce(mq.matches || pref.matches);
        update();
        mq.addEventListener('change', update);
        pref.addEventListener('change', update);
        return () => {
            mq.removeEventListener('change', update);
            pref.removeEventListener('change', update);
        };
    }, []);

    return reduce;
}
