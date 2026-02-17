<?php

namespace App\Http\Controllers;

use App\Models\Personality;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class PersonalityController extends Controller
{
    protected function videoDisk(): string
    {
        return 's3';
    }

    protected function ensureS3Ready(): void
    {
        if (class_exists(\League\Flysystem\AwsS3V3\PortableVisibilityConverter::class)) {
            return;
        }

        throw ValidationException::withMessages([
            'video' => 'S3 adapter missing. Install league/flysystem-aws-s3-v3 before uploading personality videos.',
        ]);
    }

    public function index(Request $request)
    {
        $query = Personality::query()->orderByDesc('created_at');

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where('name', 'like', "%{$term}%");
        }

        return Inertia::render('Personalities/Index', [
            'personalities' => $query->paginate(15)->withQueryString(),
            'filters' => $request->only('search'),
        ]);
    }

    public function create()
    {
        return Inertia::render('Personalities/Create');
    }

    public function store(Request $request)
    {
        $this->ensureS3Ready();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'video' => ['required', 'file', 'mimetypes:video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska', 'max:512000'],
            'status' => ['sometimes', 'boolean'],
        ]);

        $videoPath = $request->file('video')->store('personalities/videos', $this->videoDisk());

        Personality::create([
            'name' => $validated['name'],
            'video_path' => $videoPath,
            'status' => (bool) ($validated['status'] ?? true),
        ]);

        return redirect()->route('personalities.index')->with('success', 'Personality created.');
    }

    public function edit(Personality $personality)
    {
        return Inertia::render('Personalities/Edit', [
            'personality' => $personality,
        ]);
    }

    public function update(Request $request, Personality $personality)
    {
        $this->ensureS3Ready();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'video' => ['nullable', 'file', 'mimetypes:video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska', 'max:512000'],
            'status' => ['sometimes', 'boolean'],
        ]);

        $nextVideoPath = $personality->video_path;
        if ($request->hasFile('video')) {
            $nextVideoPath = $request->file('video')->store('personalities/videos', $this->videoDisk());
            if ($personality->video_path) {
                Storage::disk($this->videoDisk())->delete($personality->video_path);
            }
        }

        $personality->update([
            'name' => $validated['name'],
            'video_path' => $nextVideoPath,
            'status' => array_key_exists('status', $validated) ? (bool) $validated['status'] : $personality->status,
        ]);

        return redirect()->route('personalities.index')->with('success', 'Personality updated.');
    }

    public function toggleStatus(Personality $personality)
    {
        $personality->update([
            'status' => !$personality->status,
        ]);

        return redirect()->route('personalities.index')->with('success', 'Personality status updated.');
    }

    public function destroy(Personality $personality)
    {
        if ($personality->video_path) {
            Storage::disk($this->videoDisk())->delete($personality->video_path);
        }

        $personality->delete();

        return redirect()->route('personalities.index')->with('success', 'Personality deleted.');
    }
}
