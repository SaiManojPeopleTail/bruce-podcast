<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = [
            [
                'name' => 'Admin',
                'email' => 'saimanoj@voicemodel.io',
                'password' => Hash::make('Sai@588*'),
            ],
            [
                'name' => 'Raji',
                'email' => 'raji@voicemodel.io',
                'password' => Hash::make('Voicemodel@2025'),
            ]
        ];

        foreach ($users as $data) {
            User::updateOrCreate(
                ['email' => $data['email']],
                $data
            );
        }
    }
}
