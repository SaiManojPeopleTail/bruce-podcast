import {
    markSubscribed,
    postNewsletterSubscribe,
    validateNewsletterEmail,
} from '@/lib/newsletterSubscription';
import { Check, Loader2, SendHorizontal } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Tooltip } from 'react-tooltip';

/** After success (check + message), reset the form so another email can be entered (e.g. shared PC). */
const INLINE_SUCCESS_MS = 4000;

export default function NewsletterFooterSignup() {
    const id = useId();
    const inputId = `${id}-footer-email`;
    const errorId = `${id}-footer-error`;

    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    /** Shown in the button after a successful API response; then cleared so the form is usable again. */
    const [inlineSuccess, setInlineSuccess] = useState(null);

    useEffect(() => {
        if (!inlineSuccess) {
            return undefined;
        }
        const t = window.setTimeout(() => {
            setInlineSuccess(null);
        }, INLINE_SUCCESS_MS);
        return () => window.clearTimeout(t);
    }, [inlineSuccess]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const validationError = validateNewsletterEmail(email);
        if (validationError) {
            setError(validationError);
            return;
        }
        setSubmitting(true);

        try {
            const msg = await postNewsletterSubscribe(email);
            markSubscribed();
            setEmail('');
            setInlineSuccess({ message: msg });
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

    const inputDisabled = submitting || !!inlineSuccess;
    const buttonDisabled = submitting || !!inlineSuccess;

    return (
        <div className="w-full max-w-md">
            <p className="text-md font-medium text-gray-200">Subscribe to our Newsletter</p>
            <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start" noValidate>
                <div className="min-w-0 flex-1">
                    <label htmlFor={inputId} className="sr-only">
                        Email address
                    </label>
                    <input
                        id={inputId}
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(ev) => {
                            setEmail(ev.target.value);
                            if (error) setError('');
                        }}
                        disabled={inputDisabled}
                        placeholder="you@example.com"
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#b59100] focus:outline-none focus:ring-2 focus:ring-[#ffde59]/40 disabled:opacity-60 min-w-[275px]"
                        aria-invalid={error ? 'true' : 'false'}
                        aria-describedby={error ? errorId : undefined}
                    />
                    {error ? (
                        <p id={errorId} className="mt-1.5 text-xs text-red-600" role="alert">
                            {error}
                        </p>
                    ) : null}
                    {inlineSuccess ? (
                        <p className="mt-1.5 text-xs text-emerald-400" role="status">
                            {inlineSuccess.message}
                        </p>
                    ) : null}
                </div>
                <button
                    type="submit"
                    disabled={buttonDisabled}
                    data-tooltip-id="footer-newsletter-submit"
                    data-tooltip-content="Subscribe"
                    aria-label="Subscribe to newsletter"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-[#b59100] bg-[#b59100] text-white transition hover:bg-[#9a7d08] focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-90"
                >
                    {submitting ? (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                    ) : inlineSuccess ? (
                        <Check className="h-5 w-5 shrink-0 text-emerald-200" strokeWidth={2.5} aria-hidden />
                    ) : (
                        <SendHorizontal className="h-5 w-5 shrink-0" aria-hidden />
                    )}
                </button>
            </form>
            <Tooltip id="footer-newsletter-submit" place="top" />
        </div>
    );
}
