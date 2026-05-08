import HomeLayout from '@/Layouts/HomeLayout';
import { useCart } from '@/Context/CartContext';
import { Head, Link } from '@inertiajs/react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Check, ChevronLeft, Loader2, Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

function formatPrice(cents) {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ── Phone helpers (same pattern as ProductEnquiry/Show.jsx) ──────────────────
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

/** Stripe validators are strict: CA/US provinces as 2-letter, postal formats, etc. */
const CA_PROVINCE_NAMES = {
    alberta: 'AB',
    'british columbia': 'BC',
    manitoba: 'MB',
    'new brunswick': 'NB',
    'newfoundland and labrador': 'NL',
    'northwest territories': 'NT',
    'nova scotia': 'NS',
    nunavut: 'NU',
    ontario: 'ON',
    'prince edward island': 'PE',
    quebec: 'QC',
    qc: 'QC',
    saskatchewan: 'SK',
    yukon: 'YT',
    'yukon territory': 'YT',
};

const US_STATE_NAMES = {
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
    connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
    illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
    maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
    mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
    pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
    tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
    'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

const AU_STATE_NAMES = {
    'australian capital territory': 'ACT', 'new south wales': 'NSW', 'northern territory': 'NT',
    queensland: 'QLD', 'south australia': 'SA', tasmania: 'TAS', victoria: 'VIC',
    'western australia': 'WA',
};

function normalizePostalForStripe(country, zipRaw) {
    const z = String(zipRaw ?? '').trim();
    if (!z) return z;
    if (country === 'CA') {
        const compact = z.replace(/\s+/g, '').toUpperCase();
        return compact.length === 6 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : compact;
    }
    if (country === 'US') {
        const digits = z.replace(/\D/g, '');
        if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
        if (digits.length === 5) return digits;
        return z;
    }
    return z;
}

function normalizeStateForStripe(country, regionRaw) {
    const raw = String(regionRaw ?? '').trim();
    if (!raw) return undefined;
    const upper = raw.toUpperCase();
    if (country === 'CA') {
        const caCodes = new Set(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']);
        if (upper.length === 2 && caCodes.has(upper)) return upper;
        const fromName = CA_PROVINCE_NAMES[raw.toLowerCase().replace(/\./g, '')];
        return fromName ?? upper;
    }
    if (country === 'US') {
        const usCodes = new Set([
            'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
            'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
            'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
            'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'AS', 'GU', 'MP', 'PR', 'VI',
        ]);
        if (upper.length === 2 && usCodes.has(upper)) return upper;
        const fromName = US_STATE_NAMES[raw.toLowerCase().replace(/\./g, '')];
        return fromName ?? upper;
    }
    if (country === 'AU') {
        const auCodes = new Set(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);
        if (upper.length >= 2 && upper.length <= 3 && auCodes.has(upper)) return upper;
        const fromName = AU_STATE_NAMES[raw.toLowerCase().replace(/\./g, '')];
        return fromName ?? upper;
    }
    // GB: county/region strings often fail Stripe’s ISO-3166-2 check — omit unless already 2–3 letter code
    if (country === 'GB') {
        if (/^[A-Z]{1,3}$/i.test(raw)) return upper;
        return undefined;
    }
    return raw;
}

function stripeBillingAddressFromForm(addr) {
    const country = String(addr.country ?? '').trim().toUpperCase();
    const line1 = String(addr.line1 ?? '').trim();
    const line2 = addr.line2?.trim();
    const city = String(addr.city ?? '').trim();
    const postal_code = normalizePostalForStripe(country, addr.postal_code);
    const state = normalizeStateForStripe(country, addr.state);

    const out = {
        country,
        line1,
        ...(line2 ? { line2 } : {}),
        city,
        postal_code,
    };
    if (state) out.state = state;
    return out;
}
// ─────────────────────────────────────────────────────────────────────────────

const STAGES = ['Shipping', 'Payment', 'Confirmation'];

function StageBar({ active }) {
    const activeIdx = STAGES.indexOf(active);
    return (
        <div className="mb-10 flex items-start justify-center">
            {STAGES.map((s, i) => {
                const done = i < activeIdx;
                const current = i === activeIdx;
                return (
                    <div key={s} className="flex items-start">
                        <div className="flex flex-col items-center gap-1.5">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all
                                ${done    ? 'border-[#b59100] bg-[#b59100] text-white' :
                                  current ? 'border-[#b59100] bg-white text-[#b59100]' :
                                            'border-gray-200 bg-white text-gray-400'}`}>
                                {done ? <Check className="h-4 w-4" /> : i + 1}
                            </div>
                            <span className={`text-xs font-medium whitespace-nowrap ${
                                current ? 'text-gray-900' : done ? 'text-[#b59100]' : 'text-gray-400'
                            }`}>{s}</span>
                        </div>
                        {i < STAGES.length - 1 && (
                            <div className={`mx-4 mt-4 h-px w-14 shrink-0 transition-colors ${done ? 'bg-[#b59100]' : 'bg-gray-200'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function PriceRow({ label, value, bold }) {
    return (
        <div className={`flex justify-between text-sm ${bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
            <span>{label}</span>
            <span>{formatPrice(value)}</span>
        </div>
    );
}

function StripeForm({ orderSummary, billingDetails, onSuccess }) {
    const stripe = useStripe();
    const elements = useElements();
    const [paying, setPaying] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!stripe || !elements) return;
        setPaying(true);

        // Required before confirmPayment: validates Payment Element and collects wallet (Apple/Google Pay) data.
        const { error: submitError } = await elements.submit();
        if (submitError) {
            toast.error(submitError.message ?? 'Check your payment details and try again.');
            setPaying(false);
            return;
        }

        const addr = billingDetails.address;
        const billing_details = {
            name: billingDetails.fullName.trim(),
            email: billingDetails.email.trim(),
            ...(billingDetails.phone ? { phone: billingDetails.phone } : {}),
            address: stripeBillingAddressFromForm({
                country: addr.country,
                line1: addr.line1,
                line2: addr.line2,
                city: addr.city,
                state: addr.state,
                postal_code: addr.postal_code,
            }),
        };

        const returnPath = route('checkout.index');
        const return_url = returnPath.startsWith('http')
            ? returnPath
            : `${window.location.origin}${returnPath.startsWith('/') ? '' : '/'}${returnPath}`;

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url,
                payment_method_data: { billing_details },
            },
            redirect: 'if_required',
        });
        if (error) {
            toast.error(error.message ?? 'Payment failed. Please try again.');
            setPaying(false);
        } else {
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <PaymentElement
                options={{
                    layout: 'tabs',
                    wallets: {
                        applePay: 'auto',
                        googlePay: 'auto',
                    },
                    fields: {
                        billingDetails: {
                            name: 'never',
                            email: 'never',
                            phone: 'never',
                            address: 'never',
                        },
                    },
                }}
            />
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-1.5">
                <p className="text-center text-xs font-medium text-gray-600">Order amounts — USD</p>
                <PriceRow label="Subtotal" value={orderSummary.subtotal} />
                <PriceRow label="Shipping" value={orderSummary.shippingCost} />
                <PriceRow label={`Tax (HST ${(orderSummary.taxRate * 100).toFixed(0)}%)`} value={orderSummary.taxAmount} />
                <div className="my-1 border-t border-gray-200" />
                <PriceRow label="Total (charged in USD)" value={orderSummary.total} bold />
            </div>
            <p className="text-center text-xs text-gray-500">
                Your card statement will show this charge in US dollars (USD).
            </p>
            <button
                type="submit"
                disabled={paying || !stripe}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#b59100] px-6 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-[#a07e00] disabled:opacity-60"
            >
                {paying && <Loader2 className="h-5 w-5 animate-spin" />}
                {paying ? 'Processing…' : `Pay ${formatPrice(orderSummary.total)}`}
            </button>
        </form>
    );
}

function CheckoutContent({ stripeKey }) {
    const { items, clearCart } = useCart();
    const [stage, setStage] = useState('Shipping');
    const [form, setForm] = useState({
        first_name: '', last_name: '', email: '', phone: '',
        address_line1: '', address_line2: '', city: '', region: '', zip: '', country: 'CA',
    });
    const [phoneDisplay, setPhoneDisplay] = useState('');
    const [orderSummary, setOrderSummary] = useState(null);
    const [orderUuid, setOrderUuid] = useState(null);
    const [clientSecret, setClientSecret] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const stripePromise = useMemo(() => loadStripe(stripeKey), [stripeKey]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pi = params.get('payment_intent');
        if (pi?.startsWith('pi_')) {
            window.location.replace(route('checkout.confirmation', pi));
        }
    }, []);

    const csrfToken = () =>
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

    const setField = (name, value) => {
        setForm((f) => ({ ...f, [name]: value }));
        setErrors((e) => ({ ...e, [name]: undefined }));
    };

    const validate = () => {
        const errs = {};
        if (!form.first_name.trim()) errs.first_name = 'Required';
        if (!form.last_name.trim()) errs.last_name = 'Required';
        if (!form.email.trim()) {
            errs.email = 'Required';
        } else if (!isValidEmailAddress(form.email)) {
            errs.email = 'Please enter a valid email address';
        }
        if (form.phone) {
            const d = digitsUsNational(form.phone);
            if (d.length > 0 && d.length < 10) errs.phone = 'Enter a complete 10-digit number';
        }
        if (!form.address_line1.trim()) errs.address_line1 = 'Required';
        if (!form.city.trim()) errs.city = 'Required';
        if (!form.region.trim()) errs.region = 'Required';
        if (!form.zip.trim()) errs.zip = 'Required';
        return errs;
    };

    const handleContinue = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        if (clientSecret) { setStage('Payment'); return; }
        setLoading(true);
        try {
            const res = await fetch(route('checkout.initiate'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), Accept: 'application/json' },
                body: JSON.stringify({
                    ...form,
                    shipping_method: 1,
                    items: items.map((i) => ({
                        printify_product_id: i.printify_product_id,
                        printify_variant_id: i.printify_variant_id,
                        quantity: i.quantity,
                    })),
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setErrors(json.errors ?? {});
                toast.error(json.message ?? 'Failed to initiate checkout.');
                return;
            }
            setOrderSummary(json);
            setOrderUuid(json.orderUuid ?? null);
            setClientSecret(json.clientSecret);
            setStage('Payment');
        } catch {
            toast.error('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentSuccess = () => {
        clearCart();
        if (orderUuid) {
            window.location.href = route('checkout.confirmation', orderUuid);
            return;
        }
        if (clientSecret) {
            const piId = clientSecret.split('_secret_')[0];
            window.location.href = route('checkout.confirmation', piId);
        }
    };

    const inputClass = (name) =>
        `mt-1 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#b59100]/50 ${
            errors[name] ? 'border-red-400' : 'border-gray-300'
        }`;

    const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-gray-500';

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
                <p className="text-gray-500">Your cart is empty.</p>
                <Link href={route('merch.index')} className="text-[#b59100] underline underline-offset-2">
                    Go to shop
                </Link>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">

            <Link href={route('merch.index')} className="mb-8 inline-flex items-center gap-1 text-sm text-gray-400 transition hover:text-[#b59100]">
                <ChevronLeft className="h-4 w-4" /> Back to shop
            </Link>

            <StageBar active={stage} />

            <p className="mb-4 text-center text-xs text-gray-500">
                Checkout and payment are in <span className="font-semibold text-gray-700">US dollars (USD)</span> via Stripe.
            </p>

            {/* Order summary — always visible, collapsible */}
            <details open className="group mb-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 select-none">
                    <span className="text-sm font-semibold text-gray-700">Your order</span>
                    <span className="text-xs text-gray-400 group-open:hidden">{items.length} item{items.length !== 1 ? 's' : ''} · {formatPrice(items.reduce((s, i) => s + i.our_price * i.quantity, 0))}</span>
                </summary>
                <ul className="divide-y divide-gray-100 px-5 pb-4">
                    {items.map((item) => (
                        <li key={`${item.printify_product_id}-${item.printify_variant_id}`} className="flex items-center gap-3 py-3">
                            {item.image && (
                                <img src={item.image} alt={item.title} className="h-24 w-24 rounded-lg border border-gray-100 object-cover" />
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-900">{item.title}</p>
                                {item.variant_title && <p className="text-xs text-gray-400">{item.variant_title}</p>}
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-semibold text-gray-900">{formatPrice(item.our_price * item.quantity)}</p>
                                <p className="text-sm text-gray-400">×{item.quantity}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            </details>

            {/* ── Shipping stage ── */}
            {stage === 'Shipping' && (
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <div className="border-b border-gray-100 px-6 py-4">
                        <h2 className="text-base font-semibold text-gray-900">Contact &amp; shipping</h2>
                        <p className="mt-0.5 text-xs text-gray-400">We'll use this to fulfil your order and send you a confirmation email.</p>
                    </div>
                    <form onSubmit={handleContinue} className="space-y-5 px-6 py-5">

                        {/* Name */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className={labelClass}>First name</label>
                                <input type="text" value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} className={inputClass('first_name')} />
                                {errors.first_name && <p className="mt-1 text-xs text-red-500">{errors.first_name}</p>}
                            </div>
                            <div>
                                <label className={labelClass}>Last name</label>
                                <input type="text" value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} className={inputClass('last_name')} />
                                {errors.last_name && <p className="mt-1 text-xs text-red-500">{errors.last_name}</p>}
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className={labelClass}>Email</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => {
                                        setField('email', e.target.value);
                                        if (errors.email && isValidEmailAddress(e.target.value))
                                            setErrors((err) => ({ ...err, email: undefined }));
                                    }}
                                    className={inputClass('email')}
                                />
                                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                            </div>
                            <div>
                                <label className={labelClass}>
                                    Phone <span className="normal-case font-normal text-gray-400">(optional)</span>
                                </label>
                                <div className={`mt-1 flex min-h-[42px] items-center rounded-lg border shadow-sm transition focus-within:ring-2 focus-within:ring-[#b59100]/50 ${errors.phone ? 'border-red-400' : 'border-gray-300'}`}>
                                    <span className="pl-3 text-sm text-gray-400 select-none">+1</span>
                                    <input
                                        type="tel"
                                        placeholder="(416) 555-0100"
                                        value={phoneDisplay}
                                        onChange={(e) => {
                                            const display = formatNationalForDisplay(e.target.value);
                                            const full = fullPlusOnePhone(e.target.value);
                                            setPhoneDisplay(display);
                                            setField('phone', full || display);
                                            if (errors.phone) setErrors((err) => ({ ...err, phone: undefined }));
                                        }}
                                        className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                    />
                                </div>
                                {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                            </div>
                        </div>

                        <div className="border-t border-gray-100" />

                        {/* Address */}
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Address line 1</label>
                                <input type="text" value={form.address_line1} onChange={(e) => setField('address_line1', e.target.value)} className={inputClass('address_line1')} />
                                {errors.address_line1 && <p className="mt-1 text-xs text-red-500">{errors.address_line1}</p>}
                            </div>
                            <div>
                                <label className={labelClass}>
                                    Address line 2 <span className="normal-case font-normal text-gray-400">(optional)</span>
                                </label>
                                <input type="text" value={form.address_line2} onChange={(e) => setField('address_line2', e.target.value)} className={inputClass('address_line2')} />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <label className={labelClass}>City</label>
                                    <input type="text" value={form.city} onChange={(e) => setField('city', e.target.value)} className={inputClass('city')} />
                                    {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city}</p>}
                                </div>
                                <div>
                                    <label className={labelClass}>Province / State</label>
                                    <input type="text" value={form.region} onChange={(e) => setField('region', e.target.value)} className={inputClass('region')} />
                                    {errors.region && <p className="mt-1 text-xs text-red-500">{errors.region}</p>}
                                </div>
                                <div>
                                    <label className={labelClass}>Postal code</label>
                                    <input type="text" value={form.zip} onChange={(e) => setField('zip', e.target.value)} className={inputClass('zip')} />
                                    {errors.zip && <p className="mt-1 text-xs text-red-500">{errors.zip}</p>}
                                </div>
                            </div>
                            <div className="sm:w-1/3">
                                <label className={labelClass}>Country</label>
                                <select
                                    value={form.country}
                                    onChange={(e) => setField('country', e.target.value)}
                                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#b59100]/50"
                                >
                                    <option value="CA">Canada</option>
                                    <option value="US">United States</option>
                                    <option value="GB">United Kingdom</option>
                                    <option value="AU">Australia</option>
                                </select>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b59100] px-6 py-3.5 text-sm font-semibold text-white shadow transition hover:bg-[#a07e00] disabled:opacity-60"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {loading ? 'Calculating shipping…' : 'Continue to payment'}
                        </button>
                    </form>
                </div>
            )}

            {/* ── Payment stage ── */}
            {stage === 'Payment' && clientSecret && orderSummary && (
                <div className="space-y-4">
                    {/* Collapsed shipping summary with edit */}
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="flex items-start justify-between px-6 py-4">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Shipping to</p>
                                <p className="mt-1 text-sm font-medium text-gray-900 truncate">
                                    {form.first_name} {form.last_name} · {form.address_line1}, {form.city}
                                </p>
                                <p className="text-xs text-gray-400">{form.email}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStage('Shipping')}
                                className="ml-4 flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition hover:bg-gray-50"
                            >
                                <Pencil className="h-3 w-3" /> Edit
                            </button>
                        </div>
                    </div>

                    {/* Stripe payment card */}
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="border-b border-gray-100 px-6 py-4">
                            <h2 className="text-base font-semibold text-gray-900">Payment</h2>
                            <p className="mt-0.5 text-xs text-gray-400">
                                Totals are in <span className="font-medium text-gray-600">USD</span>. Charged in USD by Stripe.
                            </p>
                        </div>
                        <div className="px-6 py-5">
                            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
                                <StripeForm
                                    orderSummary={orderSummary}
                                    billingDetails={{
                                        fullName: `${form.first_name} ${form.last_name}`.replace(/\s+/g, ' ').trim(),
                                        email: form.email.trim(),
                                        phone: (() => {
                                            const d = digitsUsNational(form.phone);
                                            if (d.length === 10) return `+1${d}`;
                                            const raw = String(form.phone ?? '').trim();
                                            return raw || undefined;
                                        })(),
                                        address: {
                                            line1: form.address_line1,
                                            line2: form.address_line2,
                                            city: form.city,
                                            state: form.region,
                                            postal_code: form.zip,
                                            country: form.country,
                                        },
                                    }}
                                    onSuccess={handlePaymentSuccess}
                                />
                            </Elements>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Checkout({ stripeKey }) {
    return (
        <HomeLayout>
            <Head title="Checkout" />
            <CheckoutContent stripeKey={stripeKey} />
        </HomeLayout>
    );
}
