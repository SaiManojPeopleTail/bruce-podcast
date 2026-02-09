<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;

class UserController extends Controller
{
    protected function ensureAdmin(): void
    {
        if (auth()->id() >= 3) {
            abort(403, 'Unauthorized.');
        }
    }

    public function index()
    {
        $this->ensureAdmin();
        $users = User::orderBy('id')->get(['id', 'name', 'email', 'created_at']);

        return Inertia::render('Users/Index', [
            'users' => $users,
        ]);
    }

    public function create()
    {
        $this->ensureAdmin();
        return Inertia::render('Users/Create');
    }

    public function store(Request $request)
    {
        $this->ensureAdmin();
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        return redirect()->route('users.index')->with('success', 'User created.');
    }

    public function destroy(User $user)
    {
        $this->ensureAdmin();
        if ($user->id === auth()->id()) {
            abort(403, 'You cannot delete your own account from this list.');
        }
        $user->delete();
        return redirect()->route('users.index')->with('success', 'User deleted.');
    }

    public function updatePassword(Request $request, User $user)
    {
        $this->ensureAdmin();
        $request->validate([
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);
        $user->update(['password' => Hash::make($request->password)]);
        return redirect()->route('users.index')->with('success', 'Password updated.');
    }
}
