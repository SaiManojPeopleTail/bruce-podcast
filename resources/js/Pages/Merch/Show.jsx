import MerchCartLineControls from '@/Components/MerchCartLineControls';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link } from '@inertiajs/react';
import { ChevronLeft, ShoppingCart } from 'lucide-react';
import { useState } from 'react';

function formatPrice(cents) {
    return (cents / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
}

// Inner component — rendered inside CartProvider via HomeLayout
function MerchShowContent({ product }) {
    const firstAvailable = (product.variants ?? []).find((v) => v.is_available !== false);
    const [selectedVariantId, setSelectedVariantId] = useState(firstAvailable?.variant_id ?? null);
    const [activeImage, setActiveImage] = useState(0);

    const availableVariants = (product.variants ?? []).filter((v) => v.is_available !== false);
    const selectedVariant = availableVariants.find((v) => v.variant_id === selectedVariantId)
        ?? availableVariants[0]
        ?? null;

    const images = product.images ?? [];

    const effectiveUnitPrice = selectedVariant
        ? (selectedVariant.sale_price != null && selectedVariant.sale_price < selectedVariant.our_price
            ? selectedVariant.sale_price
            : selectedVariant.our_price)
        : null;

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <Link
                href={route('merch.index')}
                className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#b59100]"
            >
                <ChevronLeft className="h-4 w-4" />
                Back to shop
            </Link>

            <div className="grid gap-10 lg:grid-cols-2">
                {/* Images */}
                <div className="flex flex-col gap-3">
                    <div className="aspect-square overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                        {images[activeImage] ? (
                            <img
                                src={images[activeImage]?.src ?? images[activeImage]}
                                alt={product.title}
                                loading="eager"
                                decoding="sync"
                                fetchpriority="high"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-200">
                                <ShoppingCart className="h-20 w-20" />
                            </div>
                        )}
                    </div>
                    {images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {images.map((img, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setActiveImage(i)}
                                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                                        i === activeImage
                                            ? 'border-[#b59100]'
                                            : 'border-transparent hover:border-gray-300'
                                    }`}
                                >
                                    <img src={img?.src ?? img} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="flex flex-col gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{product.title}</h1>
                        {selectedVariant ? (
                            <div className="mt-2 flex items-baseline gap-2">
                                {selectedVariant.sale_price != null && selectedVariant.sale_price < selectedVariant.our_price ? (
                                    <>
                                        <span className="text-2xl font-semibold text-[#b59100]">{formatPrice(selectedVariant.sale_price)}</span>
                                        <span className="text-lg text-gray-400 line-through">{formatPrice(selectedVariant.our_price)}</span>
                                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Sale</span>
                                    </>
                                ) : (
                                    <span className="text-2xl font-semibold text-[#b59100]">{formatPrice(selectedVariant.our_price)}</span>
                                )}
                            </div>
                        ) : (
                            availableVariants.length > 0 && (
                                <p className="mt-2 text-lg text-gray-500">
                                    From {formatPrice(Math.min(...availableVariants.map((v) => v.sale_price ?? v.our_price)))}
                                </p>
                            )
                        )}
                    </div>

                    {product.description && (
                        <div
                            className="prose prose-sm max-w-none text-gray-600"
                            dangerouslySetInnerHTML={{ __html: product.description }}
                        />
                    )}

                    {/* Variant selector */}
                    {availableVariants.length > 0 && (
                        <div>
                            <p className="mb-2 text-sm font-medium text-gray-700">
                                Select variant
                                {selectedVariant && (
                                    <span className="ml-2 font-normal text-gray-500">— {selectedVariant.title}</span>
                                )}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {availableVariants.map((v) => (
                                    <button
                                        key={v.variant_id}
                                        type="button"
                                        onClick={() => setSelectedVariantId(v.variant_id)}
                                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                                            selectedVariantId === v.variant_id
                                                ? 'border-[#b59100] bg-[#b59100] text-white'
                                                : 'border-gray-300 bg-white text-gray-700 hover:border-[#b59100]'
                                        }`}
                                    >
                                        {v.title}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedVariant && (
                        <MerchCartLineControls
                            printifyProductId={product.printify_product_id}
                            printifyVariantId={selectedVariant.variant_id}
                            title={product.title}
                            variantTitle={selectedVariant.title}
                            image={images[0]?.src ?? images[0] ?? null}
                            ourPrice={effectiveUnitPrice ?? 0}
                            size="full"
                            toastOnAdd
                        />
                    )}

                    <p className="text-xs text-gray-400">
                        Prices shown in CAD. Taxes calculated at checkout.
                    </p>
                </div>
            </div>
        </div>
    );
}

// Outer component — renders HomeLayout (which mounts CartProvider), then the content inside it
export default function MerchShow({ product }) {
    return (
        <HomeLayout>
            <Head title={product.title} />
            <MerchShowContent product={product} />
        </HomeLayout>
    );
}
