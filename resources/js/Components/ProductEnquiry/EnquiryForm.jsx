import { useForm } from '@inertiajs/react';
import { flushSync } from 'react-dom';
import { useRef, useMemo } from 'react';
import toast from 'react-hot-toast';

const fieldClass =
    'mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

const phoneFieldShell =
    'mt-1 flex min-h-[42px] rounded-md border border-gray-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500';

const phoneNationalInputClass =
    'min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0';

function digitsUsNational(value) {
    let s = String(value ?? '').trim();
    if (s.startsWith('+1')) s = s.slice(2).trimStart();
    let d = s.replace(/\D/g, '');
    if (d.length >= 11 && d.startsWith('1')) d = d.slice(1);
    return d.slice(0, 10);
}

function formatNationalForDisplay(digits) {
    const d = digitsUsNational(digits);
    if (!d) return '';
    if (d.length <= 3) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function fullPlusOnePhone(digits10) {
    const d = digitsUsNational(digits10);
    if (d.length !== 10) return '';
    return `+1 ${formatNationalForDisplay(d)}`;
}

function isValidEmailAddress(value) {
    const s = String(value ?? '').trim();
    if (s.length === 0 || s.length > 255) return false;
    const at = s.lastIndexOf('@');
    if (at < 1 || at === s.length - 1) return false;
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    if (local.length > 64 || domain.length > 253) return false;
    if (!/^[\w+!#$%&'*+/=?^`{|}~-]+(?:\.[\w+!#$%&'*+/=?^`{|}~-]+)*$/i.test(local)) return false;
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(domain)) return false;
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) return false;
    return true;
}

export default function EnquiryForm({ slug }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        store_name: '',
        phone: '',
        email: '',
        message: '',
    });

    const phoneNationalInputRef = useRef(null);
    const emailInputRef = useRef(null);

    const nationalPhoneDisplay = useMemo(() => formatNationalForDisplay(data.phone), [data.phone]);

    const syncPhoneValidity = (el, digitCount) => {
        if (!el) return;
        if (digitCount === 0) el.setCustomValidity('Phone is required.');
        else if (digitCount < 10) el.setCustomValidity('Enter a complete 10-digit US number.');
        else el.setCustomValidity('');
    };

    const onPhoneNationalChange = (e) => {
        const el = e.target;
        const d = digitsUsNational(el.value);
        syncPhoneValidity(el, d.length);
        setData('phone', d.length ? `+1 ${formatNationalForDisplay(d)}` : '');
    };

    const syncEmailValidity = (el, emailValue) => {
        if (!el) return;
        const t = String(emailValue ?? '').trim();
        if (!t) el.setCustomValidity('Email is required.');
        else if (!isValidEmailAddress(t)) el.setCustomValidity('Enter a valid email address.');
        else el.setCustomValidity('');
    };

    const onEmailChange = (e) => {
        const el = e.target;
        setData('email', el.value);
        syncEmailValidity(el, el.value);
    };

    const submit = (e) => {
        e.preventDefault();
        const d = digitsUsNational(data.phone);
        const natEl = phoneNationalInputRef.current;
        if (natEl) {
            syncPhoneValidity(natEl, d.length);
            if (!natEl.checkValidity()) { natEl.reportValidity(); return; }
        } else if (d.length !== 10) {
            toast.error('Please enter a complete 10-digit phone number.');
            return;
        }

        const formatted = fullPlusOnePhone(d);
        const emailTrimmed = String(data.email ?? '').trim();
        const emailEl = emailInputRef.current;
        if (emailEl) {
            syncEmailValidity(emailEl, emailTrimmed);
            if (!emailEl.checkValidity()) { emailEl.reportValidity(); return; }
        } else if (!isValidEmailAddress(emailTrimmed)) {
            toast.error('Please enter a valid email address.');
            return;
        }

        flushSync(() => {
            setData('phone', formatted);
            setData('email', emailTrimmed);
        });

        post(route('product-enquiry.record-submission', slug), {
            preserveScroll: true,
            onSuccess: (page) => {
                const msg = page.props.flash?.success ?? 'Thank you! We have received your enquiry.';
                toast.success(msg, { duration: 6000 });
                reset();
            },
        });
    };

    return (
        <section className="h-fit rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <h2 className="barlow-condensed-semibold text-2xl font-bold text-gray-900">Send an enquiry</h2>
            <p className="mt-2 text-sm text-gray-600">Tell us how we can help.</p>

            <form className="mt-8 space-y-5" onSubmit={submit}>
                <div>
                    <label htmlFor="enq_name" className="block text-sm font-medium text-gray-700">
                        Your name *
                    </label>
                    <input
                        id="enq_name"
                        type="text"
                        className={fieldClass}
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        required
                        autoComplete="name"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                <div>
                    <label htmlFor="enq_store_name" className="block text-sm font-medium text-gray-700">
                        Store name *
                    </label>
                    <input
                        id="enq_store_name"
                        type="text"
                        className={fieldClass}
                        value={data.store_name}
                        onChange={(e) => setData('store_name', e.target.value)}
                        required
                        autoComplete="organization"
                    />
                    {errors.store_name && <p className="mt-1 text-sm text-red-600">{errors.store_name}</p>}
                </div>

                <div>
                    <label htmlFor="enq_phone_national" className="block text-sm font-medium text-gray-700">
                        Phone *
                    </label>
                    <div className={`overflow-hidden ${phoneFieldShell}`}>
                        <span
                            className="flex shrink-0 select-none items-center border-r border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium tabular-nums text-gray-700"
                            aria-hidden
                        >
                            +1
                        </span>
                        <input
                            ref={phoneNationalInputRef}
                            id="enq_phone_national"
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel-national"
                            className={phoneNationalInputClass}
                            placeholder="(555) 123-4567"
                            value={nationalPhoneDisplay}
                            onChange={onPhoneNationalChange}
                        />
                    </div>
                    {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                </div>

                <div>
                    <label htmlFor="enq_email" className="block text-sm font-medium text-gray-700">
                        Email *
                    </label>
                    <input
                        ref={emailInputRef}
                        id="enq_email"
                        type="text"
                        inputMode="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        className={fieldClass}
                        value={data.email}
                        onChange={onEmailChange}
                        autoComplete="email"
                    />
                    {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                <div>
                    <label htmlFor="enq_message" className="block text-sm font-medium text-gray-700">
                        Message <span className="font-normal text-gray-500">(optional)</span>
                    </label>
                    <textarea
                        id="enq_message"
                        rows={5}
                        className={fieldClass}
                        value={data.message}
                        onChange={(e) => setData('message', e.target.value)}
                        placeholder="How can we help?"
                    />
                    {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message}</p>}
                </div>

                <button
                    type="submit"
                    disabled={processing}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-[#b59100] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9a7c00] focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                    {processing ? 'Sending…' : 'Submit enquiry'}
                </button>
            </form>
        </section>
    );
}
