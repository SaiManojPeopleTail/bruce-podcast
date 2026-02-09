<?php

namespace App\Http\Controllers;

use App\Models\Episode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;

class EpisodeController extends Controller
{
    public function index(Request $request)
    {
        $query = Episode::orderByDesc('created_at');

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('title', 'like', "%{$term}%")
                    ->orWhere('slug', 'like', "%{$term}%")
                    ->orWhere('short_description', 'like', "%{$term}%");
            });
        }

        $episodes = $query->paginate(15)->withQueryString();

        return Inertia::render('Episodes/Index', [
            'episodes' => $episodes,
            'filters' => $request->only('search'),
        ]);
    }

    public function create()
    {
        return Inertia::render('Episodes/Create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'unique:episodes,slug', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'short_description' => ['nullable', 'string'],
            'long_description' => ['nullable', 'string'],
            'video_url' => ['nullable', 'url', 'max:500'],
            'created_at' => ['nullable', 'date'],
        ]);

        $validated['created_at'] = $validated['created_at'] ?? now();

        Episode::create($validated);

        Cache::forget(SitemapController::SITEMAP_CACHE_KEY);

        return redirect()->route('episodes.index')->with('success', 'Episode created.');
    }

    public function edit(Episode $episode)
    {
        return Inertia::render('Episodes/Edit', [
            'episode' => $episode,
        ]);
    }

    public function update(Request $request, Episode $episode)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:episodes,slug,' . $episode->id],
            'short_description' => ['nullable', 'string'],
            'long_description' => ['nullable', 'string'],
            'video_url' => ['nullable', 'url', 'max:500'],
            'created_at' => ['nullable', 'date'],
        ]);

        $validated['created_at'] = $validated['created_at'] ?? $episode->created_at;

        $episode->update($validated);

        Cache::forget(SitemapController::SITEMAP_CACHE_KEY);

        return redirect()->route('episodes.index')->with('success', 'Episode updated.');
    }

    public function destroy(Episode $episode)
    {
        $episode->delete();
        Cache::forget(SitemapController::SITEMAP_CACHE_KEY);
        return redirect()->route('episodes.index')->with('success', 'Episode deleted.');
    }
}
