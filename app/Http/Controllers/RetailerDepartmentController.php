<?php

namespace App\Http\Controllers;

use App\Models\RetailerDepartment;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RetailerDepartmentController extends Controller
{
    public function index(Request $request)
    {
        $query = RetailerDepartment::query()
            ->withCount('retailerProfiles')
            ->orderBy('name');

        if ($request->filled('search')) {
            $term = $request->search;
            $query->where('name', 'like', "%{$term}%");
        }

        return Inertia::render('RetailerProfiles/Departments/Index', [
            'departments' => $query->paginate(15)->withQueryString(),
            'filters' => $request->only('search'),
        ]);
    }

    public function create()
    {
        return Inertia::render('RetailerProfiles/Departments/Create');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        RetailerDepartment::create($validated);

        return redirect()->route('retailer-profiles.departments.index')->with('success', 'Department created.');
    }

    public function edit(RetailerDepartment $retailerDepartment)
    {
        return Inertia::render('RetailerProfiles/Departments/Edit', [
            'department' => $retailerDepartment,
        ]);
    }

    public function update(Request $request, RetailerDepartment $retailerDepartment)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $retailerDepartment->update($validated);

        return redirect()->route('retailer-profiles.departments.index')->with('success', 'Department updated.');
    }

    public function destroy(RetailerDepartment $retailerDepartment)
    {
        $count = $retailerDepartment->retailerProfiles()->count();
        if ($count > 0) {
            return redirect()->route('retailer-profiles.departments.index')->with(
                'error',
                "Cannot delete this department: {$count} retailer profile(s) are assigned to it. Remove or reassign them first."
            );
        }

        $retailerDepartment->delete();

        return redirect()->route('retailer-profiles.departments.index')->with('success', 'Department deleted.');
    }
}
