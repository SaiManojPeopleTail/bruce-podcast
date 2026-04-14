/**
 * Normalizes website input while typing: keeps existing schemes (https://, http://, etc.),
 * leaves partial "http" / "https://" typing alone, otherwise prefixes https://.
 */
export function normalizeWebsiteInput(raw) {
    if (raw == null) {
        return '';
    }

    const v = String(raw).trim();
    if (v === '') {
        return '';
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
        return v;
    }

    const lower = v.toLowerCase();
    const httpSchemes = ['http://', 'https://'];
    if (httpSchemes.some((full) => full.startsWith(lower))) {
        return v;
    }

    return `https://${v}`;
}
