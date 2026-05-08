import MerchCartLineControls from '@/Components/MerchCartLineControls';
import { useCart } from '@/Context/CartContext';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link } from '@inertiajs/react';
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

function ProductCard({ product, priority = false }) {
    const { items } = useCart();
    const image = product.images?.[0]?.src ?? product.images?.[0] ?? null;
    const defaultVariant = useMemo(
        () => (product.variants ?? []).find((v) => v.is_available !== false) ?? null,
        [product.variants],
    );
    const unit = effectiveUnitPrice(defaultVariant);
    const showCart = Boolean(defaultVariant && product.printify_product_id);

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
    return (
        <HomeLayout>
            <Head title="Shop" />

            <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
                <div className="mb-10 text-center">
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#b59100]">Official Merch</p>
                    <h1 className="mt-2 text-4xl font-bold text-gray-900">Shop</h1>
                </div>

                {products.length === 0 ? (
                    <div className="py-24 text-center text-gray-500">
                        No products available yet — check back soon.
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {products.map((p, i) => (
                            <ProductCard key={p.id} product={p} priority={i < 4} />
                        ))}
                    </div>
                )}
            </div>
        </HomeLayout>
    );
}
