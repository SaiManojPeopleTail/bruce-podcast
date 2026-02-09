/**
 * Get YouTube video ID from watch or youtu.be URL
 */
export function getYouTubeVideoId(url) {
    try {
        const ytRegex = /(?:youtube\.com\/.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const matches = url.match(ytRegex);
        if (matches && matches[1]) return matches[1];
        const parsed = new URL(url);
        if (parsed.hostname.includes('youtube.com')) return parsed.searchParams.get('v');
        if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1, 12);
    } catch {}
    return null;
}

export function getYouTubeThumbnail(url) {
    const videoId = getYouTubeVideoId(url);
    if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    return '/assets/images/video-placeholder.png';
}

export function getYouTubeEmbedUrl(url) {
    const videoId = getYouTubeVideoId(url);
    if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    return null;
}
