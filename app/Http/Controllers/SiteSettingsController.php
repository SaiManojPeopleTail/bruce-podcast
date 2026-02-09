<?php

namespace App\Http\Controllers;

use App\Models\Page;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SiteSettingsController extends Controller
{
    protected const PAGE_SLUGS = ['home', 'about', 'brand-partnerships', 'guest-submissions'];

    protected function ensureAdmin(): void
    {
        if (auth()->id() >= 3) {
            abort(403, 'Unauthorized.');
        }
    }

    public function index()
    {
        $this->ensureAdmin();
        $pages = Page::whereIn('slug', self::PAGE_SLUGS)->get()
            ->sortBy(fn (Page $p) => array_search($p->slug, self::PAGE_SLUGS, true))
            ->values();

        $pagesData = $pages->map(fn (Page $p) => [
            'id' => $p->id,
            'slug' => $p->slug,
            'name' => Page::nameForSlug($p->slug),
            'route' => Page::routeForSlug($p->slug),
            'meta_title' => $p->meta_title,
        ]);

        return Inertia::render('SiteSettings/Index', [
            'pages' => $pagesData,
        ]);
    }

    public function edit(Page $page)
    {
        $this->ensureAdmin();
        if (!in_array($page->slug, self::PAGE_SLUGS, true)) {
            abort(404);
        }

        return Inertia::render('SiteSettings/Edit', [
            'page' => [
                'id' => $page->id,
                'slug' => $page->slug,
                'name' => Page::nameForSlug($page->slug),
                'route' => Page::routeForSlug($page->slug),
                'meta_title' => $page->meta_title,
                'meta_description' => $page->meta_description,
                'meta_keywords' => $page->meta_keywords,
                'og_image' => $page->og_image,
            ],
        ]);
    }

    public function update(Request $request, Page $page)
    {
        $this->ensureAdmin();
        if (!in_array($page->slug, self::PAGE_SLUGS, true)) {
            abort(404);
        }

        $request->validate([
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string', 'max:500'],
            'meta_keywords' => ['nullable', 'string', 'max:500'],
            'og_image' => ['nullable', 'string', 'max:500', 'url'],
        ]);

        $str = fn ($key) => ($v = trim((string) $request->input($key, ''))) === '' ? null : $v;
        $page->update([
            'meta_title' => $str('meta_title'),
            'meta_description' => $str('meta_description'),
            'meta_keywords' => $str('meta_keywords'),
            'og_image' => $str('og_image'),
        ]);

        return redirect()->route('site-settings.index')->with('success', 'Page meta saved.');
    }
}
