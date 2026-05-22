import MerchCartLineControls from '@/Components/MerchCartLineControls';
import HeroVideoBackground from '@/Components/HeroVideoBackground';
import HeroNav from '@/Components/HeroNav';
import RecentVideos from '@/Components/RecentVideos';
import HomeLayout from '@/Layouts/HomeLayout';
import { useCart } from '@/Context/CartContext';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { Head, Link, usePage } from '@inertiajs/react';
import { motion } from 'framer-motion';
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

/** Matches `Merch/Index` product cards for a consistent shop look */
function FeaturedProductCard({ product, priority = false, purchaseEnabled = true }) {
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

    const pinnedOpen = lineQty > 0;

    return (
        <div className="group flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
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

function FeaturedMerchSection({ products, purchaseEnabled = true }) {
    if (!products || products.length === 0) return null;
    const featured = products.slice(0, 4);
    return (
        <section className="relative w-full bg-white py-16">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-10 text-center">
                    <p className="text-sm font-semibold uppercase tracking-widest text-[#b59100]">Official Merch</p>
                    <h2 className="mt-2 text-3xl font-bold text-gray-900 md:text-4xl">Shop Our Collection</h2>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {featured.map((p, i) => (
                        <FeaturedProductCard key={p.id} product={p} priority={i < 4} purchaseEnabled={purchaseEnabled} />
                    ))}
                </div>
                <div className="mt-10 text-center">
                    <Link
                        href={route('merch.index')}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#b59100] bg-white px-6 py-3 text-sm font-semibold text-[#b59100] shadow-sm transition hover:bg-[#b59100] hover:text-white"
                    >
                        <ShoppingBag className="h-4 w-4" />
                        View all merch
                    </Link>
                </div>
            </div>
        </section>
    );
}

const heroTextVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.15 + 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    }),
};

export default function Welcome({ videos = [], current_time_and_date = null, featuredMerch = [] }) {
    console.log(current_time_and_date);

    const { merch_purchase_enabled: purchaseEnabled } = usePage().props;
    const reduceMotion = useReduceMotion();
    const H2 = reduceMotion ? 'h2' : motion.h2;
    const H1 = reduceMotion ? 'h1' : motion.h1;

    return (
        <HomeLayout>
            <Head title="Welcome" />
            <section className="relative h-[75vh] md:h-screen overflow-hidden flex flex-col">
                <HeroVideoBackground parallax />
                <div className="absolute inset-0 w-full max-w-7xl mx-auto flex flex-col items-center justify-center gap-2 z-10 pointer-events-none mt-[-100px] pt-10 md:pt-0">
                    <H2
                        className="hero-top-text text-[#ffde59] plus-jakarta-sans-700"
                        {...(!reduceMotion && { custom: 0, variants: heroTextVariants, initial: 'hidden', animate: 'visible' })}
                    >
                        PODCAST
                    </H2>
                    <H1
                        className="text-5xl font-bold text-white drop-shadow-lg hero-main-text text-center max-w-4xl anton-regular"
                        {...(!reduceMotion && { custom: 1, variants: heroTextVariants, initial: 'hidden', animate: 'visible' })}
                    >
                        IN<br />CONVERSATION<br />WITH<br />BRUCE W. COLE
                    </H1>
                </div>

                <HeroNav />
            </section>

            {/* <section className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
                <p className="text-gray-700 text-lg leading-relaxed">
                    Explore the show:{' '}
                    <Link href={route('meet-bruce')} className="text-[#b59100] hover:text-[#ffde59] font-medium underline underline-offset-2 transition-colors">
                        meet host Bruce W. Cole
                    </Link>
                    ,{' '}
                    <Link href={route('guest-submissions')} className="text-[#b59100] hover:text-[#ffde59] font-medium underline underline-offset-2 transition-colors">
                        suggest a guest
                    </Link>
                    , or{' '}
                    <Link href={route('brand-partnerships')} className="text-[#b59100] hover:text-[#ffde59] font-medium underline underline-offset-2 transition-colors">
                        learn about brand partnerships
                    </Link>
                    .
                </p>
            </section> */}

            <RecentVideos episodes={videos} />
            <FeaturedMerchSection products={featuredMerch} purchaseEnabled={purchaseEnabled} />
        </HomeLayout>
    );
}
