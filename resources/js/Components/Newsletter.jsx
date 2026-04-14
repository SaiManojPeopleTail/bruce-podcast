import Modal from '@/Components/Modal';
import {
    DELAY_MS,
    SS_MODAL_SHOWN,
    SS_SHOW_AT,
    clearNewsletterModalSessionForReload,
    isNavigationReload,
    markSubscribed,
    newsletterModalGate,
    postNewsletterSubscribe,
    recordNewsletterModalClosed,
    validateNewsletterEmail,
} from '@/lib/newsletterSubscription';
import { ArrowRight, Loader2, Mail, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export default function Newsletter() {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Only check once when page is loaded
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (isNavigationReload()) {
            clearNewsletterModalSessionForReload();
        }

        const gate = newsletterModalGate();
        if (!gate.canShow) {
            // Only check once; if not allowed, skip showing (won't retry after cooldown)
            return;
        }

        if (window.sessionStorage.getItem(SS_MODAL_SHOWN) === '1') {
            return;
        }

        let showAt = parseInt(window.sessionStorage.getItem(SS_SHOW_AT) || '0', 10) || 0;
        if (!showAt) {
            showAt = Date.now() + DELAY_MS;
            window.sessionStorage.setItem(SS_SHOW_AT, String(showAt));
        }

        const delay = Math.max(0, showAt - Date.now());
        const timer = window.setTimeout(() => {
            window.sessionStorage.setItem(SS_MODAL_SHOWN, '1');
            setOpen(true);
        }, delay);

        return () => window.clearTimeout(timer);
    }, []);

    const close = useCallback(() => {
        setOpen(false);
        recordNewsletterModalClosed();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('');
        const validationError = validateNewsletterEmail(email);
        if (validationError) {
            setError(validationError);
            return;
        }
        setError('');
        setSubmitting(true);

        try {
            const msg = await postNewsletterSubscribe(email);
            setStatus(msg);
            setEmail('');
            markSubscribed();
            window.setTimeout(() => {
                setOpen(false);
            }, 1800);
        } catch (err) {
            const res = err.response;
            if (res?.status === 422 && res.data?.errors?.email?.[0]) {
                setError(res.data.errors.email[0]);
            } else if (res?.data?.message) {
                setError(res.data.message);
            } else {
                setError('Something went wrong. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            show={open}
            onClose={close}
            // make the modal a little wider
            panelClassName="rounded-3xl shadow-2xl ring-1 ring-black/5 max-w-7xl xl:max-w-5xl mx-auto"
        >
            <div className="relative bg-white px-6 sm:px-8 lg:px-10 py-10 sm:py-12 lg:py-14">
                <button
                    type="button"
                    onClick={close}
                    className="absolute right-4 top-4 z-10 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#ffde59]/50"
                    aria-label="Close newsletter"
                >
                    <X className="h-5 w-5" aria-hidden />
                </button>

                <div className="grid gap-8 pr-8 pt-2 md:grid-cols-2 md:gap-10 md:pr-10">
                    <div className="flex flex-col justify-center">
                        {/* <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#7d6b4e] ring-1 ring-amber-100">
                            <span className="text-[10px]" aria-hidden>
                                ●
                            </span>
                            Stay connected
                        </p> */}
                        <h2
                            id="newsletter-heading"
                            className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl"
                        >
                            Subscribe to our{' '}<br/>
                            <span className="italic text-[#cba200] text-4xl sm:text-5xl">In Conversation </span><br/>Newsletter
                        </h2>
                        <p className="mt-4 text-sm leading-relaxed text-gray-600 sm:text-base">
                            Join our community and get monthly podcast highlights and industry trends
                            delivered to your inbox.
                        </p>
                    </div>

                    <div className="flex flex-col justify-center">
                        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                            <div>
                                <label htmlFor="newsletter-email" className="sr-only">
                                    Email address
                                </label>
                                <div className="relative">
                                    <Mail
                                        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                                        aria-hidden
                                    />
                                    <input
                                        id="newsletter-email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={(ev) => {
                                            setEmail(ev.target.value);
                                            if (error) setError('');
                                        }}
                                        disabled={submitting || !!status}
                                        placeholder="your@email.com"
                                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#b59100] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ffde59]/40 disabled:opacity-60"
                                        aria-invalid={error ? 'true' : 'false'}
                                        aria-describedby={error ? 'newsletter-error' : status ? 'newsletter-status' : undefined}
                                    />
                                </div>
                                {error ? (
                                    <p id="newsletter-error" className="mt-2 text-sm text-red-600" role="alert">
                                        {error}
                                    </p>
                                ) : null}
                                {status ? (
                                    <p id="newsletter-status" className="mt-2 text-sm text-emerald-800" role="status">
                                        {status}
                                    </p>
                                ) : null}
                            </div>

                            <button
                                type="submit"
                                disabled={submitting || !!status}
                                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#cba200] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163329] focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                                        <span>Submitting</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Subscribe Now</span>
                                        <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
                                    </>
                                )}
                            </button>

                            <div className="flex flex-col items-center mt-6">
                                <p className="text-center text-xs font-medium uppercase tracking-[0.1em] text-gray-800 mb-1 ">
                                    Follow us on LinkedIn for updates
                                </p>
                                <a
                                    href="https://www.linkedin.com/company/in-conversation-with-bruce-w-cole/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-2 rounded bg-[#004182] px-3 py-1 text-md font-semibold text-white shadow-sm transition hover:bg-[#0063c7] focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/50"
                                >
                                    
                                    <i className="bi bi-linkedin text-xl mr-2"></i>
                                    LinkedIn
                                </a>
                            </div>
                       
                        </form>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
