<?php

namespace App\Http\Controllers;

use App\Models\RetailerContact;
use App\Models\RetailerDepartment;
use App\Models\RetailerPhoneNumber;
use App\Models\RetailerProfile;
use App\Services\RetailerCsvImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class RetailerProfilesController extends Controller
{
    public function retailers(Request $request)
    {
        $query = RetailerProfile::query()
            ->with([
                'departments' => fn ($q) => $q->select('retailer_departments.id', 'retailer_departments.name')->orderBy('name'),
            ])
            ->orderByDesc('updated_at');

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                    ->orWhere('handle', 'like', "%{$term}%")
                    ->orWhere('website', 'like', "%{$term}%");
            });
        }

        return Inertia::render('RetailerProfiles/Retailers/Index', [
            'retailers' => $query->paginate(15)->withQueryString(),
            'filters' => $request->only('search'),
        ]);
    }

    public function create()
    {
        return Inertia::render('RetailerProfiles/Retailers/Create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $handle = RetailerProfile::generateUniqueHandle($validated['name']);

        $retailer = RetailerProfile::create([
            'name' => $validated['name'],
            'handle' => $handle,
        ]);

        return redirect()
            ->route('retailer-profiles.retailers.edit', $retailer)
            ->with('success', 'Retailer created. Add details below.');
    }

    public function edit(RetailerProfile $retailer)
    {
        $retailer->load(['contacts', 'phoneNumbers', 'departments']);

        return Inertia::render('RetailerProfiles/Retailers/Edit', [
            'retailer' => [
                'id' => $retailer->id,
                'name' => $retailer->name,
                'handle' => $retailer->handle,
                'department_ids' => $retailer->departments->pluck('id')->values()->all(),
                'description' => $retailer->description ?? '',
                'address_line_1' => $retailer->address_line_1 ?? '',
                'address_line_2' => $retailer->address_line_2 ?? '',
                'city' => $retailer->city ?? '',
                'state' => $retailer->state ?? '',
                'zip' => $retailer->zip ?? '',
                'country' => $retailer->country ?? 'Canada',
                'email' => $retailer->email ?? '',
                'website' => $retailer->website ?? '',
                'notes' => $retailer->notes ?? '',
                'is_active' => $retailer->is_active,
                'contacts' => $retailer->contacts->map(fn ($c) => [
                    'id' => $c->id,
                    'contact_name' => $c->contact_name,
                    'title' => $c->title,
                    'email' => $c->email,
                    'linkedin' => $c->linkedin,
                ]),
                'phone_numbers' => $retailer->phoneNumbers->map(fn ($p) => [
                    'id' => $p->id,
                    'phone_number' => $p->phone_number,
                ]),
            ],
            'departments' => RetailerDepartment::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(Request $request, RetailerProfile $retailer)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'department_ids' => ['nullable', 'array'],
            'department_ids.*' => ['integer', 'exists:retailer_departments,id'],
            'description' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'address_line_1' => ['nullable', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'zip' => ['nullable', 'string', 'max:255'],
            'country' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'website' => ['nullable', 'string', 'max:500'],
            'is_active' => ['required', 'boolean'],
            'contacts' => ['nullable', 'array'],
            'contacts.*.id' => ['nullable', 'integer'],
            'contacts.*.contact_name' => ['nullable', 'string', 'max:255'],
            'contacts.*.title' => ['nullable', 'string', 'max:255'],
            'contacts.*.email' => ['nullable', 'email', 'max:255'],
            'contacts.*.linkedin' => ['nullable', 'string', 'max:500'],
            'phone_numbers' => ['nullable', 'array'],
            'phone_numbers.*.id' => ['nullable', 'integer'],
            'phone_numbers.*.phone_number' => ['nullable', 'string', 'max:64'],
        ]);

        $contactsInput = collect($request->input('contacts', []))
            ->filter(fn ($row) => filled($row['contact_name'] ?? null) || filled($row['email'] ?? null) || filled($row['title'] ?? null) || filled($row['linkedin'] ?? null));

        $phonesInput = collect($request->input('phone_numbers', []))
            ->filter(fn ($row) => filled($row['phone_number'] ?? null));

        foreach ($contactsInput->values() as $i => $row) {
            if (empty($row['contact_name'])) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    "contacts.{$i}.contact_name" => 'Contact name is required for each contact row.',
                ]);
            }
        }

        $handle = RetailerProfile::generateUniqueHandle($validated['name'], $retailer->id);

        $departmentIds = collect($validated['department_ids'] ?? [])
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        DB::transaction(function () use ($retailer, $validated, $contactsInput, $phonesInput, $handle, $departmentIds) {
            $retailer->update([
                'name' => $validated['name'],
                'handle' => $handle,
                'description' => $validated['description'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'address_line_1' => $validated['address_line_1'] ?? null,
                'address_line_2' => $validated['address_line_2'] ?? null,
                'city' => $validated['city'] ?? null,
                'state' => $validated['state'] ?? null,
                'zip' => $validated['zip'] ?? null,
                'country' => $validated['country'] ?: 'Canada',
                'email' => $validated['email'] ?? null,
                'website' => $validated['website'] ?? null,
                'is_active' => $validated['is_active'],
            ]);

            $retailer->departments()->sync($departmentIds);

            $keptContactIds = [];
            foreach ($contactsInput as $row) {
                $payload = [
                    'contact_name' => $row['contact_name'],
                    'title' => $row['title'] ?? '',
                    'email' => $row['email'] ?? '',
                    'linkedin' => $row['linkedin'] ?? '',
                ];
                if (! empty($row['id'])) {
                    $contact = RetailerContact::query()
                        ->where('retailer_profile_id', $retailer->id)
                        ->where('id', $row['id'])
                        ->first();
                    if ($contact) {
                        $contact->update($payload);
                        $keptContactIds[] = $contact->id;
                    }
                } else {
                    $keptContactIds[] = $retailer->contacts()->create($payload)->id;
                }
            }
            $retailer->contacts()->whereNotIn('id', $keptContactIds)->delete();

            $keptPhoneIds = [];
            foreach ($phonesInput as $row) {
                $num = trim($row['phone_number']);
                if ($num === '') {
                    continue;
                }
                if (! empty($row['id'])) {
                    $phone = RetailerPhoneNumber::query()
                        ->where('retailer_profile_id', $retailer->id)
                        ->where('id', $row['id'])
                        ->first();
                    if ($phone) {
                        $phone->update(['phone_number' => $num]);
                        $keptPhoneIds[] = $phone->id;
                    }
                } else {
                    $keptPhoneIds[] = $retailer->phoneNumbers()->create(['phone_number' => $num])->id;
                }
            }
            $retailer->phoneNumbers()->whereNotIn('id', $keptPhoneIds)->delete();
        });

        $retailer->refresh()->load(['contacts', 'phoneNumbers', 'departments']);

        if ($request->boolean('autosave')) {
            return redirect()->route('retailer-profiles.retailers.edit', $retailer);
        }

        return redirect()
            ->route('retailer-profiles.retailers.index')
            ->with('success', 'Retailer updated.');
    }

    public function toggleActive(Request $request, RetailerProfile $retailer)
    {
        $retailer->timestamps = false;
        $retailer->is_active = ! $retailer->is_active;
        $retailer->save();

        if ($request->expectsJson()) {
            return response()->json([
                'id' => $retailer->id,
                'is_active' => (bool) $retailer->is_active,
            ]);
        }

        return back();
    }

    public function destroy(RetailerProfile $retailer)
    {
        $retailer->delete();

        return redirect()
            ->route('retailer-profiles.retailers.index')
            ->with('success', 'Retailer deleted.');
    }

    public function bulkImport(Request $request, RetailerCsvImportService $importer): JsonResponse
    {
        $request->validate([
            'csv' => ['required', 'file', 'max:51200'],
        ]);

        $file = $request->file('csv');
        $path = $file->getRealPath();
        if ($path === false) {
            return response()->json(['message' => 'Could not read the uploaded file.'], 422);
        }

        $ext = strtolower($file->getClientOriginalExtension());
        if (! in_array($ext, ['csv', 'txt'], true)) {
            return response()->json(['message' => 'Please upload a .csv or .txt file.'], 422);
        }

        $result = $importer->import($path);

        $message = sprintf(
            'Imported %d retailer(s).',
            $result['imported']
        );
        if ($result['skipped'] > 0) {
            $message .= sprintf(' Skipped %d empty row(s).', $result['skipped']);
        }
        if (count($result['errors']) > 0) {
            $message .= ' Some rows failed — see details.';
        }

        return response()->json([
            'message' => $message,
            'imported' => $result['imported'],
            'skipped' => $result['skipped'],
            'errors' => $result['errors'],
        ]);
    }
}
