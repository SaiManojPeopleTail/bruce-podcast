import HeroNav from '@/Components/HeroNav';
import HomeLayout from '@/Layouts/HomeLayout';
import { Head, Link } from '@inertiajs/react';

function plainTextFromHtml(html) {
    if (typeof html !== 'string' || !html.trim()) {
        return '';
    }
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export default function PublicRetailerShow({ retailer }) {
    const descriptionPlain = plainTextFromHtml(retailer.description ?? '');
    const hasDescription = descriptionPlain.length > 0;
    const addressParts = [
        retailer.address_line_1,
        retailer.address_line_2,
        retailer.city,
        retailer.state,
        retailer.zip,
        retailer.country,
    ]
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter(Boolean);
    const fullAddress = addressParts.join(', ');
    const mapSrc = fullAddress
        ? `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&t=&z=14&ie=UTF8&iwloc=&output=embed`
        : '';

    return (
        <HomeLayout>
            <Head title={`${retailer.name} – Retailer Profiles`} />

            <div className="relative mx-auto mt-0 w-full max-w-7xl flex-1 px-4 py-16 md:mt-8 md:py-20 sm:px-6 lg:px-8">
                <nav className="mb-8 text-sm text-gray-500">
                    <Link href={route('retailer-profiles-list')} className="font-medium text-[#b59100] hover:underline">
                        Retailer Profiles
                    </Link>
                    <span className="mx-2 text-gray-400" aria-hidden>
                        /
                    </span>
                    <span className="text-gray-700">{retailer.name}</span>
                </nav>

                <article>
                    <h1 className="barlow-condensed-semibold text-3xl font-bold text-gray-900 sm:text-4xl">{retailer.name}</h1>

                    {hasDescription ? (
                        <div
                            className="prose prose-lg mt-8 max-w-none text-gray-700 prose-p:leading-relaxed long-description"
                            dangerouslySetInnerHTML={{ __html: retailer.description }}
                        />
                    ) : (
                        <p className="mt-8 text-base leading-relaxed text-gray-700">
                            No description has been added for this retailer yet.
                        </p>
                    )}

                    <div className="mt-12">
                        {mapSrc ? (
                            <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-md">
                                <iframe
                                    title={`Map for ${retailer.name}`}
                                    src={mapSrc}
                                    className="h-[380px] w-full"
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                />
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-12 text-center text-sm text-gray-600">
                                Address not available for this retailer.
                            </div>
                        )}
                    </div>
                </article>
            </div>

            <HeroNav position="top" />
        </HomeLayout>
    );
}
