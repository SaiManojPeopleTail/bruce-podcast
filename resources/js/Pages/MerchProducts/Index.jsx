import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ExternalLink, Loader2, Pencil, RefreshCw, ShoppingBag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const TAX_RATE = 0.13;

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
}

function fmtCAD(cents) {
    return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}
function fmtUSD(cents) {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
// Keep fmt as CAD alias for existing usages
const fmt = fmtCAD;

function Toggle({ checked, onChange, disabled }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-slate-800 ${checked ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-600'}`}
        >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
    );
}

function applyMarkup(cost, mode, value) {
    const v = parseFloat(value) || 0;
    if (mode === 'percent') return Math.ceil(cost * (1 + v / 100));
    return cost + Math.round(v * 100);
}

function CustomerPreviewRow({ label, price, isStrike, isBold, isTax }) {
    return (
        <div className={`flex justify-between text-sm ${isBold ? 'font-semibold text-gray-900 dark:text-slate-100' : 'text-gray-600 dark:text-slate-400'}`}>
            <span>{label}</span>
            <span className={isStrike ? 'line-through text-gray-400' : ''}>{fmt(price)}</span>
        </div>
    );
}

function AddToStoreModal({ product: listProduct, defaultMarkup, onConfirm, onClose }) {
    const [loading, setLoading] = useState(true);
    const [productData, setProductData] = useState(null);
    const [usdToCad, setUsdToCad] = useState(1.37);
    const [markupMode, setMarkupMode] = useState('percent');  // 'percent' | 'flat'
    const [markupValue, setMarkupValue] = useState(String(defaultMarkup));
    const [variants, setVariants] = useState([]);
    const [previewIdx, setPreviewIdx] = useState(0);

    // Fetch product details from Printify on mount
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch(route('merch-products.preview'), {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken(),
                Accept: 'application/json',
            },
            body: JSON.stringify({ printify_product_id: listProduct.printify_product_id }),
        })
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                setProductData(data);
                if (data.usdToCad) setUsdToCad(data.usdToCad);
                const mv = parseFloat(defaultMarkup) || 0;
                const rows = (data.variants ?? []).map((v) => ({
                    ...v,
                    our_price: applyMarkup(v.printify_cost_cad ?? v.printify_cost, 'percent', mv),
                    sale_price_display: '',
                    sale_price: null,
                }));
                setVariants(rows);
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) {
                    toast.error('Could not load product details from Printify.');
                    onClose();
                }
            });
        return () => { cancelled = true; };
    }, []);

    const handleMarkupModeChange = (m) => {
        setMarkupMode(m);

        const avgCostCents = variants.length
            ? variants.reduce((s, v) => s + (v.printify_cost ?? 0), 0) / variants.length
            : 0;

        let converted = markupValue;
        if (markupValue !== '' && avgCostCents > 0) {
            const val = parseFloat(markupValue) || 0;
            if (m === 'flat' && markupMode === 'percent') {
                converted = String(Math.round((avgCostCents * (val / 100)) / 100 * 100) / 100);
            } else if (m === 'percent' && markupMode === 'flat') {
                converted = String(Math.round(((val * 100) / avgCostCents) * 100 * 10) / 10);
            }
        }

        setMarkupValue(converted);
        setVariants((prev) =>
            prev.map((v) => ({ ...v, our_price: applyMarkup(v.printify_cost, m, converted) })),
        );
    };

    const handleMarkupValueChange = (val) => {
        setMarkupValue(val);
        setVariants((prev) =>
            prev.map((v) => ({ ...v, our_price: applyMarkup(v.printify_cost, markupMode, val) })),
        );
    };

    const updateVariantPrice = (idx, raw) => {
        const cents = Math.round(parseFloat(raw || 0) * 100);
        setVariants((prev) => prev.map((v, i) => i === idx ? { ...v, our_price: cents } : v));
    };

    const updateSalePrice = (idx, raw) => {
        const cents = raw.trim() === '' ? null : Math.round(parseFloat(raw) * 100);
        setVariants((prev) => prev.map((v, i) =>
            i === idx ? { ...v, sale_price: cents, sale_price_display: raw } : v,
        ));
    };

    const toggleAvailable = (idx) => {
        setVariants((prev) => prev.map((v, i) => i === idx ? { ...v, is_available: !(v.is_available ?? true) } : v));
    };

    const previewVariant  = variants[previewIdx] ?? variants[0];
    // USD cents (stored / editable)
    const displayPriceUsd = previewVariant?.sale_price ?? previewVariant?.our_price ?? 0;
    const regularPriceUsd = previewVariant?.our_price ?? 0;
    const hasSale         = previewVariant?.sale_price != null && previewVariant.sale_price < regularPriceUsd;
    // CAD for customer preview
    const displayPriceCad = Math.round(displayPriceUsd * usdToCad);
    const regularPriceCad = Math.round(regularPriceUsd * usdToCad);
    const taxAmt          = Math.round(displayPriceCad * TAX_RATE);
    const totalAmt        = displayPriceCad + taxAmt;

    // Effective markup % across all variants — use the lowest as the threshold
    const markupWarning = (() => {
        if (!variants.length) return false;
        if (markupMode === 'percent') return parseFloat(markupValue) < 40;
        const minCost = Math.min(...variants.map((v) => v.printify_cost));
        if (minCost <= 0) return false;
        const markupCents = parseFloat(markupValue) * 100;
        return (markupCents / minCost) * 100 < 40;
    })();

    const images = productData?.images ?? [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="relative flex w-full max-w-7xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">

                {/* Header */}
                <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-slate-700">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Add to store</h3>
                        {productData && <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-400">{productData.title}</p>}
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-1 items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                        <span className="ml-3 text-sm text-gray-500 dark:text-slate-400">Loading product details…</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        <div className="grid gap-6 p-6 lg:grid-cols-5">

                            {/* Left: product image + global markup */}
                            <div className="lg:col-span-2 space-y-4">
                                {images.length > 0 && (
                                    <img src={images[0]?.src ?? images[0]} alt={productData.title} className="w-full rounded-xl border border-gray-200 object-cover dark:border-slate-600" />
                                )}

                                {/* Global markup */}
                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-700/50">
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Global markup</p>
                                    <div className="flex rounded-lg border border-gray-300 bg-white overflow-hidden dark:border-slate-600 dark:bg-slate-800 mb-3">
                                        {['percent', 'flat'].map((m) => (
                                            <button
                                                key={m}
                                                type="button"
                                                onClick={() => handleMarkupModeChange(m)}
                                                className={`flex-1 py-1.5 text-xs font-medium transition ${markupMode === m ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                                            >
                                                {m === 'percent' ? '% Percentage' : '$ Flat amount'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="relative">
                                        {markupMode === 'flat' && (
                                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">$</span>
                                        )}
                                        <input
                                            type="number"
                                            min="0"
                                            step={markupMode === 'percent' ? '1' : '0.01'}
                                            value={markupValue}
                                            onChange={(e) => handleMarkupValueChange(e.target.value)}
                                            className={`block w-full rounded-lg border border-gray-300 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${markupMode === 'flat' ? 'pl-7 pr-3' : 'px-3 pr-8'}`}
                                        />
                                        {markupMode === 'percent' && (
                                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">%</span>
                                            )}
                                        </div>
                                        {markupWarning && (
                                            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
                                                <span className="mt-px shrink-0">⚠️</span>
                                                Going below 40% markup can be risky and may leave little buffer for fees or unexpected costs.
                                            </p>
                                        )}
                                </div>

                                {/* Printify cost breakdown */}
                                {previewVariant && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
                                        <div className="mb-2 flex items-center justify-between">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                                Printify charges you
                                            </p>
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                                                1 USD = {usdToCad.toFixed(4)} CAD
                                            </span>
                                        </div>
                                        {variants.length > 1 && (
                                            <p className="mb-1 text-xs text-amber-600 dark:text-amber-500">
                                                Showing: <span className="font-medium">{previewVariant.title}</span>
                                            </p>
                                        )}
                                        {(() => {
                                            const costUsd    = previewVariant.printify_cost ?? 0;
                                            const costCad    = previewVariant.printify_cost_cad ?? Math.round(costUsd * usdToCad);
                                            const markupUsd  = previewVariant.our_price - costUsd;
                                            const markupCad  = Math.round(previewVariant.our_price * usdToCad) - costCad;
                                            const revenueUsd = markupUsd;
                                            const revenueCad = markupCad;
                                            return (
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-amber-700 dark:text-amber-300">Production</span>
                                                        <span className="font-semibold text-amber-900 dark:text-amber-200">{fmtUSD(costUsd)} <span className="font-normal text-amber-600 dark:text-amber-500">≈ {fmtCAD(costCad)}</span></span>
                                                    </div>
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-amber-700 dark:text-amber-300">Your markup</span>
                                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">+{fmtUSD(markupUsd)} <span className="font-normal text-emerald-600 dark:text-emerald-500">≈ +{fmtCAD(markupCad)}</span></span>
                                                    </div>
                                                    <div className="my-1 border-t border-amber-200 dark:border-amber-700/50" />
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-amber-700 dark:text-amber-300">Your revenue</span>
                                                        <span className="font-bold text-amber-900 dark:text-amber-100">{fmtUSD(revenueUsd)} <span className="font-normal text-amber-700 dark:text-amber-300">≈ {fmtCAD(revenueCad)}</span></span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Customer preview */}
                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-700/50">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                        Customer preview — {previewVariant?.title ?? 'select variant'}
                                    </p>
                                    {variants.length > 1 && (
                                        <select
                                            value={previewIdx}
                                            onChange={(e) => setPreviewIdx(Number(e.target.value))}
                                            className="mb-3 block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                                        >
                                            {variants.map((v, i) => (
                                                <option key={v.variant_id} value={i}>{v.title}</option>
                                            ))}
                                        </select>
                                    )}
                                    <div className="space-y-1.5">
                                        {hasSale ? (
                                            <>
                                                <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400">
                                                    <span>Regular price</span>
                                                    <span className="line-through">{fmtUSD(regularPriceUsd)} <span className="text-xs">≈ {fmtCAD(regularPriceCad)}</span></span>
                                                </div>
                                                <div className="flex justify-between text-sm font-semibold text-gray-900 dark:text-slate-100">
                                                    <span>Sale price</span>
                                                    <span>{fmtUSD(displayPriceUsd)} <span className="font-normal text-xs text-gray-500">≈ {fmtCAD(displayPriceCad)}</span></span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex justify-between text-sm font-semibold text-gray-900 dark:text-slate-100">
                                                <span>Price</span>
                                                <span>{fmtUSD(displayPriceUsd)} <span className="font-normal text-xs text-gray-500">≈ {fmtCAD(displayPriceCad)}</span></span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                                            <span>Tax (HST {(TAX_RATE * 100).toFixed(0)}%)</span>
                                            <span>{fmtUSD(Math.round(displayPriceUsd * TAX_RATE))} <span className="text-xs">≈ {fmtCAD(taxAmt)}</span></span>
                                        </div>
                                        <div className="my-1 border-t border-gray-200 dark:border-slate-600" />
                                        <div className="flex justify-between text-sm font-semibold text-gray-900 dark:text-slate-100">
                                            <span>Total</span>
                                            <span>{fmtUSD(displayPriceUsd + Math.round(displayPriceUsd * TAX_RATE))} <span className="font-normal text-xs text-gray-500">≈ {fmtCAD(totalAmt)}</span></span>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">Shipping calculated at checkout.</p>
                                </div>
                            </div>

                            {/* Right: variants table */}
                            <div className="lg:col-span-3">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                    Variants — set price &amp; optional sale price
                                </p>
                                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-600">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                        <thead className="bg-gray-50 dark:bg-slate-900/50">
                                            <tr>
                                                {['Variant', 'Printify cost', 'Our price (USD)', 'Sale price (USD)', '✓'].map((h, i) => (
                                                    <th key={h} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 ${i === 4 ? 'text-center' : 'text-left'}`}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                            {variants.map((v, idx) => (
                                                <tr
                                                    key={v.variant_id}
                                                    onClick={() => setPreviewIdx(idx)}
                                                    className={`cursor-pointer transition ${previewIdx === idx ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : 'hover:bg-gray-50/60 dark:hover:bg-slate-900/20'}`}
                                                >
                                                    <td className="px-3 py-2 text-xs font-medium text-gray-900 dark:text-slate-100 max-w-[7rem] truncate" title={v.title}>{v.title}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap">
                                                        <p className="text-xs font-medium text-gray-700 dark:text-slate-300">{fmtUSD(v.printify_cost)}</p>
                                                        <p className="text-xs text-gray-400 dark:text-slate-500">≈ {fmtCAD(v.printify_cost_cad ?? Math.round(v.printify_cost * usdToCad))}</p>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-gray-400">$</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    value={(v.our_price / 100).toFixed(2)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onChange={(e) => updateVariantPrice(idx, e.target.value)}
                                                                    className="w-20 rounded border border-gray-300 px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                                                                />
                                                            </div>
                                                            <p className="text-xs text-gray-400 dark:text-slate-500 pl-4">≈ {fmtCAD(Math.round(v.our_price * usdToCad))}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs text-gray-400">$</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    placeholder="—"
                                                                    value={v.sale_price_display ?? ''}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onChange={(e) => updateSalePrice(idx, e.target.value)}
                                                                    className="w-20 rounded border border-gray-300 px-2 py-1 text-xs shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                                                                />
                                                            </div>
                                                            {v.sale_price != null && (
                                                                <p className="text-xs text-gray-400 dark:text-slate-500 pl-4">≈ {fmtCAD(Math.round(v.sale_price * usdToCad))}</p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={v.is_available ?? true}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={() => toggleAvailable(idx)}
                                                            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
                                    Click a row to preview it. Sale price is optional — leave blank for no sale. Product starts as <strong>hidden</strong>; make it visible in the Edit page.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer */}
                {!loading && (
                    <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => onConfirm(variants)}
                            className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                        >
                            Add to store
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MerchProductsIndex({ products: initialProducts, pagination, defaultMarkup, shopIdMissing, resolvedShopId, usdToCad = 1.37 }) {
    const page = usePage();
    const [products, setProducts] = useState(initialProducts);
    const [togglingId, setTogglingId] = useState(null);
    const [visTogglingId, setVisTogglingId] = useState(null);
    const [addModal, setAddModal] = useState(null);
    const prevFlashKeyRef = useRef('');

    useEffect(() => { setProducts(initialProducts); }, [initialProducts]);

    useEffect(() => {
        const s = page.props.flash?.success ?? '';
        const err = page.props.flash?.error ?? '';
        if (!s && !err) { prevFlashKeyRef.current = ''; return; }
        const key = `${s}|${err}`;
        if (key === prevFlashKeyRef.current) return;
        prevFlashKeyRef.current = key;
        if (s) toast.success(s);
        if (err) toast.error(err);
    }, [page.props.flash]);

    const callToggle = async (pid, enable, variants) => {
        setTogglingId(pid);
        try {
            const res = await fetch(route('merch-products.toggle'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), Accept: 'application/json' },
                body: JSON.stringify({ printify_product_id: pid, enable, variants }),
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message ?? 'Toggle failed.'); return; }
            if (enable) {
                setProducts((prev) => prev.map((p) =>
                    p.printify_product_id === pid
                        ? { ...p, is_synced: true, local_id: json.local_id, local_slug: json.local_slug }
                        : p,
                ));
                toast.success('Product added — make it visible in the Edit page.');
            } else {
                setProducts((prev) => prev.map((p) =>
                    p.printify_product_id === pid
                        ? { ...p, is_synced: false, local_id: null, local_slug: null, is_visible: false }
                        : p,
                ));
                toast.success('Product removed from store.');
            }
        } catch {
            toast.error('Something went wrong.');
        } finally {
            setTogglingId(null);
        }
    };

    const handleVisibilityToggle = async (product) => {
        if (visTogglingId) return;
        setVisTogglingId(product.local_id);
        try {
            const res = await fetch(route('merch-products.visibility', product.local_id), {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken(), Accept: 'application/json' },
            });
            const json = await res.json();
            if (!res.ok) { toast.error(json.message ?? 'Failed.'); return; }
            setProducts((prev) => prev.map((p) =>
                p.local_id === product.local_id ? { ...p, is_visible: json.is_visible } : p,
            ));
            toast.success(json.is_visible ? 'Product is now visible.' : 'Product hidden from store.');
        } catch {
            toast.error('Something went wrong.');
        } finally {
            setVisTogglingId(null);
        }
    };

    const handleToggle = (product) => {
        if (togglingId) return;
        if (product.is_synced) {
            callToggle(product.printify_product_id, false, []);
        } else {
            setAddModal(product);
        }
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">Merch Catalog</h2>}
        >
            <Head title="Merch Catalog" />

            <div className="w-full py-6">
                {shopIdMissing && resolvedShopId && (
                    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-800/50 dark:bg-amber-900/20">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                            Shop auto-detected — add this to your <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">.env</code> to avoid an extra API call on each page load:
                        </p>
                        <p className="mt-1 font-mono text-sm text-amber-800 dark:text-amber-300">
                            PRINTIFY_SHOP_ID={resolvedShopId}
                        </p>
                    </div>
                )}

                <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                        Live from your Printify store. Toggle on to add a product to your website.
                    </p>
                    <button
                        type="button"
                        onClick={() => router.reload()}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    {products.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 dark:text-slate-400">
                            No products found in your Printify store.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                <thead className="bg-gray-50 dark:bg-slate-900/50">
                                    <tr>
                                        {['Product', 'Variants', 'In your store', 'Actions'].map((h, i) => (
                                            <th key={h} scope="col" className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 ${i === 3 ? 'text-right' : 'text-left'}`}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                                    {products.map((p) => (
                                        <tr key={p.printify_product_id} className="hover:bg-gray-50/80 dark:hover:bg-slate-900/30">
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    {p.image ? (
                                                        <img src={p.image} alt={p.title} className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover dark:border-slate-600" />
                                                    ) : (
                                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-700">
                                                            <ShoppingBag className="h-5 w-5 text-gray-300" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-slate-100">{p.title}</p>
                                                        <p className="font-mono text-xs text-gray-400 dark:text-slate-500">{p.printify_product_id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-gray-600 dark:text-slate-400">{p.variant_count}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    {togglingId === p.printify_product_id ? (
                                                        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                                                    ) : (
                                                        <Toggle checked={p.is_synced} onChange={() => handleToggle(p)} disabled={!!togglingId} />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-right">
                                                {p.is_synced && p.local_id && (
                                                    <div className="inline-flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.is_visible ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}`}>
                                                                {p.is_visible ? 'Visible' : 'Hidden'}
                                                            </span>
                                                            {visTogglingId === p.local_id ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                                                            ) : (
                                                                <Toggle
                                                                    checked={p.is_visible ?? false}
                                                                    onChange={() => handleVisibilityToggle(p)}
                                                                    disabled={!!visTogglingId}
                                                                />
                                                            )}
                                                        </div>
                                                        {p.local_slug && (
                                                            <a
                                                                href={route('merch.show', p.local_slug)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                                            >
                                                                <ExternalLink className="h-3.5 w-3.5" />
                                                                View
                                                            </a>
                                                        )}
                                                        <Link
                                                            href={route('merch-products.edit', p.local_id)}
                                                            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 shadow-sm hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                            Manage
                                                        </Link>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {pagination && pagination.last_page > 1 && (
                    <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                        <p className="text-sm text-gray-700 dark:text-slate-300">
                            Page <span className="font-medium">{pagination.current_page}</span> of <span className="font-medium">{pagination.last_page}</span>
                        </p>
                        <div className="flex gap-2">
                            {pagination.current_page > 1 && (
                                <Link href={`${route('merch-products.index')}?page=${pagination.current_page - 1}`} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">← Prev</Link>
                            )}
                            {pagination.current_page < pagination.last_page && (
                                <Link href={`${route('merch-products.index')}?page=${pagination.current_page + 1}`} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">Next →</Link>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {addModal && (
                <AddToStoreModal
                    product={addModal}
                    defaultMarkup={defaultMarkup}
                    onConfirm={(variants) => {
                        const product = addModal;
                        setAddModal(null);
                        callToggle(product.printify_product_id, true, variants);
                    }}
                    onClose={() => setAddModal(null)}
                />
            )}
        </AuthenticatedLayout>
    );
}
