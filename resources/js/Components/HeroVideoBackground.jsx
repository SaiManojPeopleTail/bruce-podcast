import { useEffect, useRef, useState } from 'react';

const CROSSFADE_DURATION_MS = 800;

export default function HeroVideoBackground({
    imageSrc = '/assets/images/bg-pod.png',
    videoSrc = '/assets/videos/bg-pod.mp4',
    parallax = false,
    className = '',
}) {
    const wrapperRef = useRef(null);
    const videoRef = useRef(null);
    const [videoReady, setVideoReady] = useState(false);

    useEffect(() => {
        if (!parallax || !wrapperRef.current) return;
        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => {
                if (wrapperRef.current) {
                    wrapperRef.current.style.transform = `translateY(${window.scrollY * 0.3}px)`;
                }
                ticking = false;
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [parallax]);

    const handleCanPlayThrough = () => {
        setVideoReady(true);
        videoRef.current?.play?.();
    };

    const transition = `opacity ${CROSSFADE_DURATION_MS}ms ease-out`;

    return (
        <div
            ref={wrapperRef}
            className={`absolute inset-0 w-full h-full z-0 ${className}`}
            style={parallax ? { willChange: 'transform' } : undefined}
        >
            {/* Image: visible until video is ready, then fade out */}
            <div
                className="absolute inset-0 w-full h-full bg-cover bg-center"
                style={{
                    backgroundImage: `url(${imageSrc})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: videoReady ? 0 : 1,
                    transition,
                    pointerEvents: videoReady ? 'none' : 'auto',
                }}
            />
            {/* Video: preload, fade in when ready (overlaps with image fade out) */}
            <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onCanPlayThrough={handleCanPlayThrough}
                style={{
                    objectFit: 'cover',
                    objectPosition: 'center',
                    opacity: videoReady ? 1 : 0,
                    transition,
                }}
            />
        </div>
    );
}
