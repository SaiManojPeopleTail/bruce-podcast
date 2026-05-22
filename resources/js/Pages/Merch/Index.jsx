import HeroNav from '@/Components/HeroNav';
import MerchCartLineControls from '@/Components/MerchCartLineControls';
import { useCart } from '@/Context/CartContext';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import { ShoppingBag } from 'lucide-react';
import { useMemo } from 'react';

function formatPrice(cents) {
    return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

function effectiveUnitPrice(variant) {
    if (!variant) return 0;
    if (variant.sale_price != null && variant.sale_price < variant.our_price) return variant.sale_price;
    return variant.our_price;
}

function ProductCard({ product, priority = false, purchaseEnabled = true }) {
    const { items } = useCart();
    const image = product.images?.[0]?.src ?? product.images?.[0] ?? null;
    const defaultVariant = useMemo(
        () => (product.variants ?? []).find((v) => v.is_available !== false) ?? null,
        [product.variants],
    );
    const unit = effectiveUnitPrice(defaultVariant);
    const showCart = purchaseEnabled && Boolean(defaultVariant && product.printify_product_id);

    const lineQty = useMemo(() => {
        if (!showCart || !defaultVariant) return 0;
        const line = items.find(
            (i) =>
                String(i.printify_product_id) === String(product.printify_product_id)
                && String(i.printify_variant_id) === String(defaultVariant.variant_id),
        );
        return line?.quantity ?? 0;
    }, [items, product.printify_product_id, defaultVariant, showCart]);

    /** In cart: stay in “hover” layout on desktop so quantity is always visible */
    const pinnedOpen = lineQty > 0;

    return (
        <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            {/* Image — normal state sits above white block; no footer overlap */}
            <Link
                href={route('merch.show', product.slug)}
                className="relative block aspect-square shrink-0 overflow-hidden bg-gray-100"
                aria-label={`View ${product.title}`}
            >
                {image ? (
                    <img
                        src={image}
                        alt={product.title}
                        loading={priority ? 'eager' : 'lazy'}
                        decoding={priority ? 'sync' : 'async'}
                        fetchpriority={priority ? 'high' : 'low'}
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <ShoppingBag className="h-16 w-16" />
                    </div>
                )}
            </Link>

            {/* White footer: default flush under image; hover (or pinned) pulls up over image bottom; title → gold; cart row reveals */}
            <div
                className={[
                    'relative z-10 flex flex-col gap-1.5 overflow-hidden rounded-t-2xl bg-white px-4 pb-3 pt-3',
                    'transition-all duration-300 ease-out',
                    '-mt-0 shadow-none',
                    'md:group-hover:-mt-14 md:group-hover:pt-3 md:group-hover:shadow-[0_-10px_28px_rgba(0,0,0,0.07)]',
                    pinnedOpen ? 'md:-mt-14 md:shadow-[0_-10px_28px_rgba(0,0,0,0.07)]' : '',
                ].filter(Boolean).join(' ')}
            >
                <Link
                    href={route('merch.show', product.slug)}
                    className={[
                        'line-clamp-2 font-semibold leading-snug transition-colors',
                        pinnedOpen
                            ? 'text-[#b59100]'
                            : 'text-gray-900 md:group-hover:text-[#b59100]',
                    ].join(' ')}
                >
                    {product.title}
                </Link>

                {product.starting_price > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-gray-600">
                            From {formatPrice(product.starting_price)}
                        </p>
                        {product.has_sale && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                Sale
                            </span>
                        )}
                    </div>
                )}

                {!purchaseEnabled && (
                    <div
                        className={[
                            'grid transition-[grid-template-rows] duration-300 ease-out',
                            'grid-rows-[1fr]',
                            'md:grid-rows-[0fr]',
                            'md:group-hover:grid-rows-[1fr]',
                        ].join(' ')}
                    >
                        <div className="min-h-0 overflow-hidden">
                            <div className="pt-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                                    Coming Soon
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {showCart && (
                    <div
                        className={[
                            'grid transition-[grid-template-rows] duration-300 ease-out',
                            'grid-rows-[1fr]',
                            'md:grid-rows-[0fr]',
                            'md:group-hover:grid-rows-[1fr]',
                            pinnedOpen ? 'md:grid-rows-[1fr]' : '',
                        ].filter(Boolean).join(' ')}
                    >
                        <div className="min-h-0 overflow-hidden">
                            <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                                <MerchCartLineControls
                                    printifyProductId={product.printify_product_id}
                                    printifyVariantId={defaultVariant.variant_id}
                                    title={product.title}
                                    variantTitle={defaultVariant.title}
                                    image={image}
                                    ourPrice={unit}
                                    size="compact"
                                    toastOnAdd={false}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MerchIndex({ products = [] }) {
    const { merch_purchase_enabled: purchaseEnabled } = usePage().props;

    return (
        <HomeLayout>
            <Head title="Shop" />

            <div className="relative min-h-screen w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 py-16 md:py-20 mt-0 md:mt-8">
                <div className="mb-10 text-center">
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#b59100]">Official Merch</p>
                    <h1 className="mt-2 text-4xl font-bold text-gray-900">Shop</h1>
                    {!purchaseEnabled && (
                        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            Online purchasing coming soon — stay tuned!
                        </p>
                    )}
                </div>

                {products.length === 0 ? (
                    <div className="py-24 text-center text-gray-500">
                        No products available yet — check back soon.
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {products.map((p, i) => (
                            <ProductCard key={p.id} product={p} priority={i < 4} purchaseEnabled={purchaseEnabled} />
                        ))}
                    </div>
                )}
            </div>
            <HeroNav position="top" />
        </HomeLayout>
    );
}
