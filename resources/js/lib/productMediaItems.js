let mediaIdCounter = 0;

export function newMediaId() {
    mediaIdCounter += 1;
    return `media-${Date.now()}-${mediaIdCounter}`;
}

export function isVideoFile(file) {
    const videoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    return videoTypes.includes(file.type) || /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(file.name);
}

export function isVideoUrl(url) {
    if (!url) return false;
    const path = url.split('?')[0].toLowerCase();
    return /\.(mp4|mov|avi|webm|mkv|m4v|ogv)(\b|$)/.test(path);
}

export function createUploadItem(file) {
    const previewUrl = URL.createObjectURL(file);
    return {
        id: newMediaId(),
        kind: 'upload',
        file,
        previewUrl,
        mediaType: isVideoFile(file) ? 'video' : 'image',
        badge: 'new',
    };
}

export function createShopifyItem(url) {
    return {
        id: newMediaId(),
        kind: 'shopify',
        url,
        previewUrl: url,
        mediaType: 'image',
        badge: 'shopify',
    };
}

export function createExistingItem(canonicalUrl, displaySrc) {
    return {
        id: newMediaId(),
        kind: 'existing',
        url: canonicalUrl,
        previewUrl: displaySrc ?? canonicalUrl,
        mediaType: isVideoUrl(displaySrc ?? canonicalUrl) ? 'video' : 'image',
        badge: null,
    };
}

/** @param {Array} mediaItems */
export function buildMediaFormPayload(mediaItems) {
    const uploads = mediaItems.filter((item) => item.kind === 'upload');
    const order = mediaItems.map((item) => {
        if (item.kind === 'upload') {
            const index = uploads.findIndex((u) => u.id === item.id);
            return { kind: 'upload', index };
        }
        if (item.kind === 'existing') {
            return { kind: 'existing', url: item.url };
        }
        if (item.kind === 'shopify') {
            return { kind: 'shopify', url: item.url };
        }
        return null;
    }).filter(Boolean);

    return {
        uploads: uploads.map((u) => u.file),
        order,
    };
}

export function revokeUploadPreviews(items) {
    items.forEach((item) => {
        if (item.kind === 'upload' && item.previewUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(item.previewUrl);
        }
    });
}
