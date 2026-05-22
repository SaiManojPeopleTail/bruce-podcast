export function detectPlatformFromUrl(rawUrl) {
    try {
        const host = new URL(rawUrl).hostname.replace(/^www\./, '').toLowerCase();
        if (host.includes('instagram.com')) return 'instagram';
        if (host.includes('linkedin.com')) return 'linkedin';
    } catch {
        // ignore
    }
    return 'other';
}

export function platformLabel(platform) {
    switch (platform) {
        case 'instagram': return 'Instagram';
        case 'linkedin': return 'LinkedIn';
        default: return 'Other';
    }
}

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

export function normalizePostFromScrape(post) {
    return {
        type: post.type ?? 'image',
        media_url: post.media_url ?? null,
        description: post.description ?? '',
        post_url: post.post_url ?? null,
        posted_at: post.posted_at ?? null,
        is_active: post.is_active !== false,
        id: post.id ?? null,
    };
}

export function mergeSavedIntoPosts(scrapedPosts, savedPosts) {
    const byUrl = new Map(
        (savedPosts ?? [])
            .filter((p) => p.post_url)
            .map((p) => [p.post_url, p]),
    );

    return scrapedPosts.map((post) => {
        const base = normalizePostFromScrape(post);
        const saved = base.post_url ? byUrl.get(base.post_url) : null;
        if (!saved) return base;
        return {
            ...base,
            id: saved.id,
            is_active: saved.is_active,
        };
    });
}

export async function fetchSavedScrape(url) {
    const params = new URLSearchParams({ url });
    const res = await fetch(`${route('social-scrape.saved')}?${params}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
        throw new Error(`Failed to load saved scrape (HTTP ${res.status})`);
    }
    return res.json();
}

export async function saveScrape({ url, notes, posts }) {
    const res = await fetch(route('social-scrape.save'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
        },
        body: JSON.stringify({ url, notes: notes ?? null, posts }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.message ?? json.error ?? `Save failed (HTTP ${res.status})`);
    }
    return json;
}

export async function toggleSavedPost(postId, isActive) {
    const res = await fetch(route('social-scrape.posts.toggle', postId), {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
        },
        body: JSON.stringify({ is_active: isActive }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(json.message ?? `Toggle failed (HTTP ${res.status})`);
    }
    return json;
}
