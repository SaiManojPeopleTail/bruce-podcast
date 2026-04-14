<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ClearRetailersCommand extends Command
{
    protected $signature = 'retailers:clear {--force : Run without confirmation}';

    protected $description = 'Delete all retailer profiles, contacts, phone numbers, and retailer–department links (does not delete department definitions).';

    public function handle(): int
    {
        if (! $this->option('force') && ! $this->confirm('This will permanently delete ALL retailers and related contacts and phone numbers. Continue?')) {
            $this->info('Aborted.');

            return self::SUCCESS;
        }

        DB::transaction(function () {
            DB::table('retailer_contacts')->delete();
            DB::table('retailer_phone_numbers')->delete();
            DB::table('retailer_department_retailer_profile')->delete();
            DB::table('retailer_profiles')->delete();
        });

        $this->info('All retailer profiles and related records cleared.');

        return self::SUCCESS;
    }
}
