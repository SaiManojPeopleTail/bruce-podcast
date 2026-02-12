<?php

namespace Database\Seeders;

use App\Models\Page;
use Illuminate\Database\Seeder;

class PageSeeder extends Seeder
{
    /**
     * Seed the default pages (editable in Site Settings). More pages can be added from the console.
     */
    public function run(): void
    {
        Page::where('slug', 'our-brands')->delete();
        Page::where('slug', 'all-videos')->delete();

        $pages = [
            [
                'slug' => 'home',
                'meta_title' => 'Home',
                'meta_description' => null,
                'meta_keywords' => null,
                'og_image' => null,
            ],
            [
                'slug' => 'about',
                'meta_title' => 'Meet Bruce',
                'meta_description' => null,
                'meta_keywords' => null,
                'og_image' => null,
            ],
            [
                'slug' => 'brand-partnerships',
                'meta_title' => 'Brand Partnerships',
                'meta_description' => null,
                'meta_keywords' => null,
                'og_image' => null,
            ],
            [
                'slug' => 'guest-submissions',
                'meta_title' => 'Guest Submission',
                'meta_description' => null,
                'meta_keywords' => null,
                'og_image' => null,
            ],
            [
                'slug' => 'all-episodes',
                'meta_title' => 'All Episodes',
                'meta_description' => null,
                'meta_keywords' => null,
                'og_image' => null,
            ],
            [
                'slug' => 'episodes',
                'meta_title' => 'Episodes',
                'meta_description' => null,
                'meta_keywords' => null,
                'og_image' => null,
            ],
            [
                'slug' => 'clips',
                'meta_title' => 'Clips',
                'meta_description' => null,
                'meta_keywords' => null,
                'og_image' => null,
            ],
            [
                'slug' => 'sponsor-videos',
                'meta_title' => 'Sponsor Videos',
                'meta_description' => null,
                'meta_keywords' => null,
                'og_image' => null,
            ],
            // Our Brands – not needed for now
            // [
            //     'slug' => 'our-brands',
            //     'meta_title' => 'Our Brands',
            //     'meta_description' => 'Explore our partner brands and their sponsor videos.',
            //     'meta_keywords' => 'bruce w. cole, our brands, partner brands',
            //     'og_image' => null,
            // ],
        ];

        foreach ($pages as $page) {
            Page::updateOrCreate(
                ['slug' => $page['slug']],
                $page
            );
        }
    }
}
