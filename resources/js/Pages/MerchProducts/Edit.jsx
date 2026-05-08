import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import RichTextEditor from '@/Components/RichTextEditor';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

const TAX_RATE = 0.13;

function fmtCAD(cents) {
    return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}
function fmtUSD(cents) {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
const fmt = fmtCAD;

function applyMarkup(cost, mode, value) {
    const v = parseFloat(value) || 0;
    if (mode === 'percent') return Math.ceil(cost * (1 + v / 100));
    return cost + Math.round(v * 100);
}

export default function MerchProductsEdit({ product, usdToCad = 1.37 }) {
    const [slug, setSlug] = useState(product.slug ?? '');
    const [title, setTitle] = useState(product.title ?? '');
    const [description, setDescription] = useState(product.description ?? '');
    const [isVisible, setIsVisible] = useState(product.is_visible ?? false);
    const [variants, setVariants] = useState(
        (product.variants ?? []).map((v) => ({
            ...v,
            our_price_display: ((v.our_price ?? 0) / 100).toFixed(2),
            sale_price_display: v.sale_price != null ? (v.sale_price / 100).toFixed(2) : '',
        })),
    );
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [activeImage, setActiveImage] = useState(0);

    // Global markup tool — pre-fill from existing variant prices
    const inferredMarkup = (() => {
        const priced = (product.variants ?? []).filter(
            (v) => (v.printify_cost ?? 0) > 0 && (v.our_price ?? 0) > 0,
        );
        if (!priced.length) return { percent: '', flat: '' };
        const avgPercent =
            priced.reduce((sum, v) => sum + ((v.our_price - v.printify_cost) / v.printify_cost) * 100, 0) /
            priced.length;
        const avgFlat =
            priced.reduce((sum, v) => sum + (v.our_price - v.printify_cost), 0) / priced.length / 100;
        return {
            percent: Math.round(avgPercent * 10) / 10,  // 1 decimal place
            flat: Math.round(avgFlat * 100) / 100,       // 2 decimal places
        };
    })();

    const [markupMode, setMarkupMode] = useState('percent');
    const [markupValue, setMarkupValue] = useState(String(inferredMarkup.percent ?? ''));
    const [previewIdx, setPreviewIdx] = useState(0);

    const handleMarkupModeChange = (m) => {
        setMarkupMode(m);

        // Convert the current input value to the new mode using average variant cost
        const avgCostCents = variants.length
            ? variants.reduce((s, v) => s + (v.printify_cost ?? 0), 0) / variants.length
            : 0;

        let converted = '';
        if (markupValue !== '' && avgCostCents > 0) {
            const val = parseFloat(markupValue) || 0;
            if (m === 'flat' && markupMode === 'percent') {
                // percent → flat dollars: avgCost * (pct/100) / 100
                converted = String(Math.round((avgCostCents * (val / 100)) / 100 * 100) / 100);
            } else if (m === 'percent' && markupMode === 'flat') {
                // flat dollars → percent: (flat*100 / avgCost) * 100
                converted = String(Math.round(((val * 100) / avgCostCents) * 100 * 10) / 10);
            }
        }

        const next = converted !== '' ? converted : markupValue;
        setMarkupValue(next);
    };

    const handleMarkupValueChange = (val) => {
        setMarkupValue(val);
        setVariants((prev) =>
            prev.map((v) => {
                const cents = applyMarkup(v.printify_cost ?? 0, markupMode, val);
                return { ...v, our_price: cents, our_price_display: (cents / 100).toFixed(2) };
            }),
        );
    };

    // Warn if effective markup < 40%
    const markupWarning = (() => {
        if (!variants.length || markupValue === '') return false;
        if (markupMode === 'percent') return parseFloat(markupValue) < 40;
        const minCost = Math.min(...variants.map((v) => v.printify_cost ?? 0));
        if (minCost <= 0) return false;
        return (parseFloat(markupValue) * 100 / minCost) * 100 < 40;
    })();

    const updateVariantPrice = (idx, value) => {
        setVariants((prev) =>
            prev.map((v, i) =>
                i === idx
                    ? { ...v, our_price_display: value, our_price: Math.round(parseFloat(value || 0) * 100) }
                    : v,
            ),
        );
    };

    const updateSalePrice = (idx, value) => {
        const cents = value.trim() === '' ? null : Math.round(parseFloat(value) * 100);
        setVariants((prev) =>
            prev.map((v, i) =>
                i === idx ? { ...v, sale_price_display: value, sale_price: cents } : v,
            ),
        );
    };

    const toggleVariantAvailable = (idx) => {
        setVariants((prev) =>
            prev.map((v, i) => (i === idx ? { ...v, is_available: !(v.is_available ?? true) } : v)),
        );
    };

    const handleSave = () => {
        setSaving(true);
        router.patch(
            route('merch-products.update', product.id),
            {
                slug,
                title,
                description,
                is_visible: isVisible,
                variants: variants.map((v) => ({
                    variant_id: v.variant_id,
                    our_price: v.our_price,
                    sale_price: v.sale_price ?? null,
                    is_available: v.is_available ?? true,
                })),
            },
            {
                onError: (errs) => { setErrors(errs); setSaving(false); },
                onSuccess: () => setSaving(false),
            },
        );
    };

    const images = product.images ?? [];

    // Customer preview
    const previewVariant = variants[previewIdx] ?? variants[0];
    // USD cents
    const displayPriceUsd = previewVariant?.sale_price ?? previewVariant?.our_price ?? 0;
    const regularPriceUsd = previewVariant?.our_price ?? 0;
    const hasSale         = previewVariant?.sale_price != null && previewVariant.sale_price < regularPriceUsd;
    // CAD equivalents
    const displayPriceCad = Math.round(displayPriceUsd * usdToCad);
    const regularPriceCad = Math.round(regularPriceUsd * usdToCad);
    const taxAmtUsd       = Math.round(displayPriceUsd * TAX_RATE);
    const taxAmtCad       = Math.round(displayPriceCad * TAX_RATE);
    const totalAmtUsd     = displayPriceUsd + taxAmtUsd;
    const totalAmtCad     = displayPriceCad + taxAmtCad;

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                    {product.title}
                </h2>
            }
        >
            <Head title={`Edit ${product.title}`} />

            <div className="mx-auto w-full max-w-7xl py-6">
                <Link
                    href={route('merch-products.index')}
                    className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                    ← Merch catalog
                </Link>

                {/* Top: two-column — gallery left, form right */}
                <div className="mb-6 grid gap-6 lg:grid-cols-5">

                    {/* Left: image gallery */}
                    <div className="lg:col-span-2">
                        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 h-full">
                            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                Media
                            </h3>
                            {images.length > 0 ? (
                                <>
                                    {/* Hero */}
                                    <div className="aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-100 dark:border-slate-600 dark:bg-slate-700">
                                        <img
                                            key={activeImage}
                                            src={images[activeImage]?.src ?? images[activeImage]}
                                            alt={title}
                                            loading="eager"
                                            decoding="async"
                                            className="h-full w-full object-cover transition-opacity duration-200"
                                        />
                                    </div>
                                    {/* Thumbnails */}
                                    {images.length > 1 && (
                                        <div className="mt-3 grid grid-cols-4 gap-2">
                                            {images.slice(0, 12).map((img, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={() => setActiveImage(i)}
                                                    className={`aspect-square overflow-hidden rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${
                                                        i === activeImage
                                                            ? 'border-indigo-500 dark:border-indigo-400'
                                                            : 'border-transparent hover:border-gray-300 dark:hover:border-slate-500'
                                                    }`}
                                                >
                                                    <img
                                                        src={img?.src ?? img}
                                                        alt=""
                                                        loading="lazy"
                                                        decoding="async"
                                                        className="h-full w-full object-cover"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <p className="mt-2 text-center text-xs text-gray-400 dark:text-slate-500">
                                        {activeImage + 1} / {images.length} &nbsp;·&nbsp; from Printify
                                    </p>
                                </>
                            ) : (
                                <div className="flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-gray-300 dark:border-slate-600">
                                    <span className="text-sm">No images</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: product details form */}
                    <div className="lg:col-span-3">
                        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 h-full">
                            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                Product details
                            </h3>
                            <div className="grid gap-4">
                        <div>
                            <InputLabel htmlFor="title" value="Title" />
                            <input
                                id="title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                            />
                            <InputError message={errors.title} className="mt-1" />
                        </div>
                        <div>
                            <InputLabel htmlFor="slug" value="Slug (URL)" />
                            <input
                                id="slug"
                                type="text"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 font-mono text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                            />
                            <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                                Public URL: /merch/<strong>{slug || '…'}</strong>
                            </p>
                            <InputError message={errors.slug} className="mt-1" />
                        </div>
                        <div>
                            <InputLabel htmlFor="description" value="Description" />
                            <RichTextEditor
                                id="description"
                                value={description}
                                onChange={setDescription}
                                placeholder="Enter a product description…"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={isVisible}
                                    onChange={(e) => setIsVisible(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                                />
                                Visible on storefront
                            </label>
                        </div>
                    </div>
                        </div>{/* end form card */}
                    </div>{/* end right col */}
                </div>{/* end top two-col grid */}

                {/* Pricing management — 3-column layout */}
                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Pricing &amp; margin management
                    </h3>
                    <p className="mb-5 text-xs text-gray-400 dark:text-slate-500">
                        Use the global markup to recalculate all variants at once, or edit each price individually below.
                    </p>

                    <div className="grid gap-5 lg:grid-cols-3">

                        {/* 1 — Global markup */}
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-700/50">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">Global markup</p>
                                {(inferredMarkup.percent !== '' || inferredMarkup.flat !== '') && (
                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                        avg ~{inferredMarkup.percent}%
                                    </span>
                                )}
                            </div>
                            <div className="flex overflow-hidden rounded-lg border border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-800 mb-3">
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
                                    placeholder={markupMode === 'percent' ? 'e.g. 40' : 'e.g. 8.00'}
                                    value={markupValue}
                                    onChange={(e) => handleMarkupValueChange(e.target.value)}
                                    className={`block w-full rounded-lg border border-gray-300 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 ${markupMode === 'flat' ? 'pl-7 pr-3' : 'px-3 pr-8'}`}
                                />
                                {markupMode === 'percent' && (
                                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">%</span>
                                )}
                            </div>
                            {(inferredMarkup.percent !== '' || inferredMarkup.flat !== '') && (
                                <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">
                                    Current avg: <span className="font-medium text-gray-600 dark:text-slate-300">{inferredMarkup.percent}%</span>
                                    {' · '}
                                    <span className="font-medium text-gray-600 dark:text-slate-300">${inferredMarkup.flat} flat</span>
                                </p>
                            )}
                            {markupWarning && (
                                <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400">
                                    <span className="mt-px shrink-0">⚠️</span>
                                    Going below 40% markup can be risky and may leave little buffer for fees or unexpected costs.
                                </p>
                            )}
                        </div>

                        {/* 2 — Printify cost breakdown */}
                        {previewVariant && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                        Printify charges you
                                    </p>
                                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
                                        1 USD = {usdToCad.toFixed(4)} CAD
                                    </span>
                                </div>
                                {variants.length > 1 && (
                                    <select
                                        value={previewIdx}
                                        onChange={(e) => setPreviewIdx(Number(e.target.value))}
                                        className="mb-3 block w-full rounded-md border-amber-300 text-xs shadow-sm focus:border-amber-500 focus:ring-amber-500 dark:border-amber-700 dark:bg-slate-800 dark:text-slate-200"
                                    >
                                        {variants.map((v, i) => (
                                            <option key={v.variant_id} value={i}>{v.title}</option>
                                        ))}
                                    </select>
                                )}
                                <p className="text-xs text-gray-700 dark:text-slate-400 text-right w-full mb-1">USD ≈ CAD</p>
                                {(() => {
                                    const costUsd    = previewVariant.printify_cost ?? 0;
                                    const costCad    = previewVariant.printify_cost_cad ?? Math.round(costUsd * usdToCad);
                                    const markupUsd  = (previewVariant.our_price ?? 0) - costUsd;
                                    const markupCad  = Math.round((previewVariant.our_price ?? 0) * usdToCad) - costCad;
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
                                                <span className="font-bold text-amber-900 dark:text-amber-100">{fmtUSD(markupUsd)} <span className="font-normal text-amber-700 dark:text-amber-300">≈ {fmtCAD(markupCad)}</span></span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* 3 — Customer preview */}
                        {previewVariant && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-600 dark:bg-slate-700/50">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                    Customer sees
                                </p>

                                <p className="text-xs text-gray-700 dark:text-slate-400 text-right w-full mb-1">USD ≈ CAD</p>
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
                                        <span>{fmtUSD(taxAmtUsd)} <span className="text-xs">≈ {fmtCAD(taxAmtCad)}</span></span>
                                    </div>
                                    <div className="my-1 border-t border-gray-200 dark:border-slate-600" />
                                    <div className="flex justify-between text-sm font-semibold text-gray-900 dark:text-slate-100">
                                        <span>Total</span>
                                        <span>{fmtUSD(totalAmtUsd)} <span className="font-normal text-xs text-gray-500">≈ {fmtCAD(totalAmtCad)}</span></span>
                                    </div>
                                </div>
                                <p className="mt-2 text-xs text-gray-400 dark:text-slate-500">Shipping added at checkout.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Variant table */}
                <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Variant pricing
                    </h3>
                    <p className="mb-4 text-xs text-gray-400 dark:text-slate-500">
                        Click a row to preview it in the panels above. Printify cost is for your reference only.
                    </p>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                            <thead className="bg-gray-50 dark:bg-slate-900/50">
                                <tr>
                                    {['Variant', 'Printify cost (USD ≈ CAD)', 'Our price (USD ≈ CAD)', 'Sale price (USD ≈ CAD)', 'Available'].map((h) => (
                                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                            {h}
                                        </th>
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
                                        <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-slate-100">{v.title}</td>
                                        <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-slate-400 whitespace-nowrap">
                                            <span className="font-bold">{fmtUSD(v.printify_cost ?? 0)}</span>
                                            <span className="ml-1 text-xs text-gray-700 dark:text-slate-400">
                                                / {fmtCAD(v.printify_cost_cad ?? Math.round((v.printify_cost ?? 0) * usdToCad))}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex flex-row items-center justify-start">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-sm text-gray-500">$</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={v.our_price_display ?? ''}
                                                        onChange={(e) => updateVariantPrice(idx, e.target.value)}
                                                        className="w-24 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                                    />
                                                </div>
                                                <p className="pl-2 text-xs text-gray-700 dark:text-slate-400">≈ {fmtCAD(Math.round((v.our_price ?? 0) * usdToCad))}</p>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex flex-row items-center justify-start gap-0.5">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-sm text-gray-500">$</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="—"
                                                        value={v.sale_price_display ?? ''}
                                                        onChange={(e) => updateSalePrice(idx, e.target.value)}
                                                        className="w-24 rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                                    />
                                                </div>
                                                {v.sale_price != null && (
                                                    <p className="pl-4 text-xs text-gray-400 dark:text-slate-500">≈ {fmtCAD(Math.round(v.sale_price * usdToCad))}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={v.is_available ?? true}
                                                onChange={() => toggleVariantAvailable(idx)}
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {errors.variants && <p className="mt-2 text-xs text-red-500">{errors.variants}</p>}
                </div>

                <div className="flex justify-end gap-3">
                    <Link
                        href={route('merch-products.index')}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                        Cancel
                    </Link>
                    <PrimaryButton onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                    </PrimaryButton>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
