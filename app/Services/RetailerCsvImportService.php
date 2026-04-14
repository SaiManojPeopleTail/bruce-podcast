<?php

namespace App\Services;

use App\Models\RetailerContact;
use App\Models\RetailerDepartment;
use App\Models\RetailerPhoneNumber;
use App\Models\RetailerProfile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use SplFileObject;

class RetailerCsvImportService
{
    /**
     * Columns before Contact1: Name … Phone, Notes (index 10, ignored — not stored), Email, URL (indices 0–12).
     * Keep a Notes column in the sheet for layout compatibility; internal notes are edited in the app only.
     */
    public const BASE_COLS = 13;

    public const CONTACT_SLOTS = 7;

    public const COLS_PER_CONTACT = 4;

    /**
     * @return array{imported: int, skipped: int, errors: list<array{line: int, message: string}>}
     */
    public function import(string $absolutePath): array
    {
        $file = new SplFileObject($absolutePath);
        $file->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY | SplFileObject::DROP_NEW_LINE);

        $lineNum = 0;
        $imported = 0;
        $skipped = 0;
        $errors = [];
        $headerSkipped = false;

        foreach ($file as $row) {
            $lineNum++;
            if (! is_array($row) || $row === [null] || $row === false) {
                continue;
            }
            $row = array_map(fn ($c) => $c === null ? '' : $c, $row);

            if (! $headerSkipped) {
                $headerSkipped = true;
                if ($this->looksLikeHeaderRow($row)) {
                    continue;
                }
            }

            $name = $this->cell($row, 0);
            if ($name === '') {
                $skipped++;

                continue;
            }

            try {
                $this->importRow($row);
                $imported++;
            } catch (\Throwable $e) {
                $errors[] = [
                    'line' => $lineNum,
                    'message' => $e->getMessage(),
                ];
            }
        }

        return [
            'imported' => $imported,
            'skipped' => $skipped,
            'errors' => $errors,
        ];
    }

    protected function looksLikeHeaderRow(array $row): bool
    {
        $first = strtolower(trim((string) ($row[0] ?? '')));

        return $first === 'name';
    }

    protected function cell(array $row, int $index): string
    {
        if (! isset($row[$index])) {
            return '';
        }

        return trim((string) $row[$index]);
    }

    protected function importRow(array $row): void
    {
        $name = $this->cell($row, 0);
        $handle = RetailerProfile::generateUniqueHandle($name);

        $departmentIds = $this->resolveDepartmentIds($this->cell($row, 1));

        DB::transaction(function () use ($row, $name, $handle, $departmentIds) {
            $profile = RetailerProfile::create([
                'name' => $name,
                'handle' => $handle,
                'description' => $this->nullableString($this->cell($row, 2)),
                'address_line_1' => $this->nullableString($this->cell($row, 3)),
                'address_line_2' => $this->nullableString($this->cell($row, 4)),
                'city' => $this->nullableString($this->cell($row, 5)),
                'state' => $this->nullableString($this->cell($row, 6)),
                'zip' => $this->nullableString($this->cell($row, 7)),
                'country' => $this->cell($row, 8) !== '' ? $this->cell($row, 8) : 'Canada',
                'email' => $this->nullableString($this->cell($row, 11)),
                'website' => $this->normalizeWebsite($this->cell($row, 12)),
                'is_active' => false,
            ]);

            $profile->departments()->sync($departmentIds);

            $phoneCell = $this->cell($row, 9);
            if ($phoneCell !== '') {
                foreach ($this->splitPhones($phoneCell) as $num) {
                    if ($num !== '') {
                        RetailerPhoneNumber::query()->create([
                            'retailer_profile_id' => $profile->id,
                            'phone_number' => $num,
                        ]);
                    }
                }
            }

            for ($k = 0; $k < self::CONTACT_SLOTS; $k++) {
                $base = self::BASE_COLS + $k * self::COLS_PER_CONTACT;
                $contactName = $this->cell($row, $base);
                $title = $this->cell($row, $base + 1);
                $email = $this->cell($row, $base + 2);
                $linkedin = $this->cell($row, $base + 3);

                if ($contactName === '' && $title === '' && $email === '' && $linkedin === '') {
                    continue;
                }
                if ($contactName === '') {
                    continue;
                }

                RetailerContact::query()->create([
                    'retailer_profile_id' => $profile->id,
                    'contact_name' => $contactName,
                    'title' => $title,
                    'email' => $email,
                    'linkedin' => $linkedin,
                ]);
            }
        });
    }

    /**
     * @return list<int>
     */
    protected function resolveDepartmentIds(string $raw): array
    {
        if ($raw === '') {
            return [];
        }
        $parts = preg_split('/\s*[,;|]\s*/', $raw, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $ids = [];
        foreach ($parts as $part) {
            $name = trim($part);
            if ($name === '') {
                continue;
            }
            $dept = RetailerDepartment::query()->whereRaw('LOWER(name) = ?', [Str::lower($name)])->first();
            if ($dept) {
                $ids[] = $dept->id;
            } else {
                $ids[] = RetailerDepartment::query()->create(['name' => $name])->id;
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * @return list<string>
     */
    protected function splitPhones(string $phoneCell): array
    {
        $chunks = preg_split('/\s*,\s*/', $phoneCell, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_map('trim', $chunks);
    }

    protected function nullableString(string $s): ?string
    {
        return $s === '' ? null : $s;
    }

    protected function normalizeWebsite(string $url): ?string
    {
        $url = trim($url);
        if ($url === '') {
            return null;
        }
        if (! preg_match('#^https?://#i', $url)) {
            $url = 'https://'.ltrim($url, '/');
        }

        return Str::limit($url, 500, '');
    }
}
