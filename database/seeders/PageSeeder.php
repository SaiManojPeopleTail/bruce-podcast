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
                'slug' => 'guest-submission',
                'meta_title' => 'Guest Submission',
                'meta_description' => null,
                'meta_keywords' => null,
                'og_image' => null,
            ],
        ];

        foreach ($pages as $page) {
            Page::updateOrCreate(
                ['slug' => $page['slug']],
                $page
            );
        }
    }
}
