import { getYouTubeThumbnail, getYouTubeVideoId } from '@/utils/youtube';
import { useEffect, useState } from 'react';

export default function YouTubeVideoPreview({ videoUrl }) {
    const videoId = getYouTubeVideoId(videoUrl);
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!videoUrl?.trim() || !videoId) {
            setDetails(null);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        const url = `${route('api.youtube-oembed')}?url=${encodeURIComponent(videoUrl.trim())}`;
        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error('Video not found');
                return res.json();
            })
            .then((data) => {
                setDetails(data);
                setError(null);
            })
            .catch(() => {
                setDetails(null);
                setError('Could not load video details');
            })
            .finally(() => setLoading(false));
    }, [videoUrl, videoId]);

    if (!videoId) return null;

    const thumbnailUrl = getYouTubeThumbnail(videoUrl);
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

    return (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-700/50 sm:flex-row sm:items-start">
            <div className="shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-slate-600">
                <img
                    src={thumbnailUrl}
                    alt=""
                    className="h-36 w-full object-cover sm:h-28 sm:w-48"
                />
            </div>
            <div className="min-w-0 flex-1">
                {loading && (
                    <p className="text-sm text-gray-500 dark:text-slate-400">Loading video details…</p>
                )}
                {error && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>
                )}
                {details && !loading && (
                    <>
                        <p className="font-medium text-gray-900 dark:text-slate-100">
                            {details.title}
                        </p>
                        {details.author_name && (
                            <p className="mt-0.5 text-sm text-gray-600 dark:text-slate-400">
                                {details.author_name}
                            </p>
                        )}
                    </>
                )}
                <a
                    href={watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                    Open in YouTube →
                </a>
            </div>
        </div>
    );
}
