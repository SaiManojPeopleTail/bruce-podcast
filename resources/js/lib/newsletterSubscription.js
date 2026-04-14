import axios from 'axios';

export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DELAY_MS = 1500;

/** After the modal is closed: wait this long before it may appear again. */
export const CLOSED_COOLDOWN_MS = 60 * 1000; // should be 1 minute

export const LS_SUBSCRIBED = 'pod_newsletter_subscribed';
/** Set only when the user closes the modal (X, Not now, backdrop). Value is `Date.now()` when closed. */
export const LS_MODAL_CLOSED_AT = 'pod_newsletter_modal_closed_at';

export const SS_SHOW_AT = 'pod_newsletter_show_at';
/** Set when the modal has opened this browser tab session; cleared on full page reload so the modal can appear again. */
export const SS_MODAL_SHOWN = 'pod_newsletter_modal_shown';

export function isNavigationReload() {
    if (typeof window === 'undefined') {
        return false;
    }
    const perf = window.performance;
    if (!perf) {
        return false;
    }
    const nav = typeof perf.getEntriesByType === 'function' ? perf.getEntriesByType('navigation')[0] : null;
    if (nav && nav.type === 'reload') {
        return true;
    }
    const legacy = perf.navigation;
    if (legacy && typeof legacy.type === 'number') {
        const reload = legacy.TYPE_RELOAD !== undefined ? legacy.TYPE_RELOAD : 1;
        return legacy.type === reload;
    }
    return false;
}

/** Call on full reload so the delayed modal can schedule again. */
export function clearNewsletterModalSessionForReload() {
    window.sessionStorage.removeItem(SS_SHOW_AT);
    window.sessionStorage.removeItem(SS_MODAL_SHOWN);
}

/**
 * Before opening/scheduling the modal: if it was closed recently, wait until CLOSED_COOLDOWN_MS has passed; then clear the stored time and allow show.
 * Subscribed is not checked — the modal can appear even after signing up elsewhere.
 */
export function newsletterModalGate() {
    if (typeof window === 'undefined') {
        return { canShow: false, retryAfterMs: 0 };
    }

    const raw = window.localStorage.getItem(LS_MODAL_CLOSED_AT);
    if (!raw) {
        return { canShow: true, retryAfterMs: 0 };
    }

    const closedAt = parseInt(raw, 10);
    if (Number.isNaN(closedAt)) {
        window.localStorage.removeItem(LS_MODAL_CLOSED_AT);
        return { canShow: true, retryAfterMs: 0 };
    }

    const elapsed = Date.now() - closedAt;
    if (elapsed < CLOSED_COOLDOWN_MS) {
        return { canShow: false, retryAfterMs: CLOSED_COOLDOWN_MS - elapsed };
    }

    window.localStorage.removeItem(LS_MODAL_CLOSED_AT);
    return { canShow: true, retryAfterMs: 0 };
}

/** Call only when the user closes the modal (not after successful subscribe). */
export function recordNewsletterModalClosed() {
    window.localStorage.setItem(LS_MODAL_CLOSED_AT, String(Date.now()));
    window.sessionStorage.removeItem(SS_SHOW_AT);
    window.sessionStorage.removeItem(SS_MODAL_SHOWN);
}

/** Used by footer/modal after a successful API subscribe (footer UI only). Does not affect modal visibility. */
export function markSubscribed() {
    window.localStorage.setItem(LS_SUBSCRIBED, '1');
    window.sessionStorage.removeItem(SS_SHOW_AT);
    window.sessionStorage.removeItem(SS_MODAL_SHOWN);
}

export function validateNewsletterEmail(value) {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        return 'Enter your email address.';
    }
    if (!emailPattern.test(trimmed)) {
        return 'Enter a valid email address.';
    }
    return '';
}

export async function postNewsletterSubscribe(email) {
    const { data } = await axios.post(
        route('newsletter.subscribe'),
        { email: email.trim() },
        { headers: { Accept: 'application/json' } },
    );
    return typeof data?.message === 'string' ? data.message : 'Thanks — you are subscribed.';
}
