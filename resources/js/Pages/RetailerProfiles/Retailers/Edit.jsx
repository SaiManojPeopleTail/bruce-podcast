import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import RichTextEditor from '@/Components/RichTextEditor';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import {
    formatInternationalPhoneInput,
    isInternationalPhoneComplete,
} from '@/lib/formatInternationalPhone';
import { normalizeWebsiteInput } from '@/lib/normalizeWebsiteInput';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { flushSync } from 'react-dom';
import { useCallback, useMemo, useRef, useState } from 'react';

function handleFromName(name) {
    const s = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return s || 'retailer';
}

function FormSection({ title, description, children }) {
    return (
        <section className="px-6 py-8 md:px-8">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
            {description ? (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
            ) : null}
            <div className="mt-6 space-y-6">{children}</div>
        </section>
    );
}

const selectClass =
    'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200';

const readOnlyHandleClass =
    'mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 py-2 font-mono text-sm text-gray-600 shadow-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400';

function mapContactsFromRetailer(contacts) {
    return (contacts || []).map((c) => ({
        id: c.id,
        contact_name: c.contact_name ?? '',
        title: c.title ?? '',
        email: c.email ?? '',
        linkedin: c.linkedin ?? '',
    }));
}

function mapPhonesFromRetailer(phones) {
    return (phones || []).map((p) => ({
        id: p.id,
        phone_number: formatInternationalPhoneInput(p.phone_number ?? ''),
    }));
}

function isContactRowComplete(row) {
    const name = (row.contact_name || '').trim();
    const email = (row.email || '').trim();
    if (!name || !email) {
        return false;
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function Edit({ retailer, departments }) {
    const initial = useMemo(
        () => ({
            name: retailer.name,
            department_ids: Array.isArray(retailer.department_ids) ? [...retailer.department_ids] : [],
            description: retailer.description ?? '',
            notes: retailer.notes ?? '',
            address_line_1: retailer.address_line_1 ?? '',
            address_line_2: retailer.address_line_2 ?? '',
            city: retailer.city ?? '',
            state: retailer.state ?? '',
            zip: retailer.zip ?? '',
            country: retailer.country ?? 'Canada',
            email: retailer.email ?? '',
            website: retailer.website ?? '',
            is_active: Boolean(retailer.is_active),
            contacts:
                retailer.contacts?.length > 0
                    ? retailer.contacts.map((c) => ({
                          id: c.id,
                          contact_name: c.contact_name ?? '',
                          title: c.title ?? '',
                          email: c.email ?? '',
                          linkedin: c.linkedin ?? '',
                      }))
                    : [],
            phone_numbers:
                retailer.phone_numbers?.length > 0
                    ? retailer.phone_numbers.map((p) => ({
                          id: p.id,
                          phone_number: formatInternationalPhoneInput(p.phone_number ?? ''),
                      }))
                    : [],
        }),
        [retailer],
    );

    const { data, setData, patch, processing, errors, setError } = useForm(initial);

    const dataRef = useRef(data);
    dataRef.current = data;

    const autosavingRef = useRef(false);
    const [autosaving, setAutosaving] = useState(false);

    const mergeServerLists = useCallback(
        (page) => {
            const r = page?.props?.retailer ?? router.page?.props?.retailer;
            if (!r) {
                return;
            }
            setData('phone_numbers', mapPhonesFromRetailer(r.phone_numbers));
            setData('contacts', mapContactsFromRetailer(r.contacts));
            setData(
                'department_ids',
                Array.isArray(r.department_ids) ? [...r.department_ids] : [],
            );
        },
        [setData],
    );

    const runAutosave = useCallback(() => {
        if (autosavingRef.current) {
            return;
        }
        autosavingRef.current = true;
        setAutosaving(true);
        router.patch(
            route('retailer-profiles.retailers.update', retailer.id),
            { ...dataRef.current, autosave: true },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: (page) => mergeServerLists(page),
                onError: (errs) => {
                    Object.entries(errs).forEach(([k, v]) => {
                        const msg = Array.isArray(v) ? v[0] : String(v);
                        setError(k, msg);
                    });
                },
                onFinish: () => {
                    autosavingRef.current = false;
                    setAutosaving(false);
                },
            },
        );
    }, [retailer.id, mergeServerLists, setError]);

    const handleDisplay = useMemo(() => {
        if (data.name.trim() === retailer.name.trim()) {
            return retailer.handle;
        }
        return handleFromName(data.name.trim());
    }, [data.name, retailer.name, retailer.handle]);

    const selectedDepartments = useMemo(() => {
        const ids = new Set(data.department_ids ?? []);
        return (departments ?? []).filter((d) => ids.has(d.id));
    }, [data.department_ids, departments]);

    const addDepartment = (id) => {
        const n = Number(id);
        if (!n || (data.department_ids ?? []).includes(n)) {
            return;
        }
        setData('department_ids', [...(data.department_ids ?? []), n]);
    };

    const removeDepartment = (id) => {
        setData(
            'department_ids',
            (data.department_ids ?? []).filter((x) => x !== id),
        );
    };

    const availableDepartments = useMemo(
        () => (departments ?? []).filter((d) => !(data.department_ids ?? []).includes(d.id)),
        [departments, data.department_ids],
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        patch(route('retailer-profiles.retailers.update', retailer.id));
    };

    const addContact = () => {
        setData('contacts', [
            ...data.contacts,
            { id: null, contact_name: '', title: '', email: '', linkedin: '' },
        ]);
    };

    const removeContact = (index) => {
        const next = data.contacts.filter((_, i) => i !== index);
        flushSync(() => setData('contacts', next));
        runAutosave();
    };

    const updateContact = (index, field, value) => {
        const next = data.contacts.map((row, i) => (i === index ? { ...row, [field]: value } : row));
        flushSync(() => setData('contacts', next));
        if (isContactRowComplete(next[index])) {
            runAutosave();
        }
    };

    const addPhone = () => {
        setData('phone_numbers', [...data.phone_numbers, { id: null, phone_number: '' }]);
    };

    const removePhone = (index) => {
        const next = data.phone_numbers.filter((_, i) => i !== index);
        flushSync(() => setData('phone_numbers', next));
        runAutosave();
    };

    const updatePhone = (index, rawValue) => {
        const formatted = formatInternationalPhoneInput(rawValue);
        const next = data.phone_numbers.map((row, i) => (i === index ? { ...row, phone_number: formatted } : row));
        flushSync(() => setData('phone_numbers', next));
        if (isInternationalPhoneComplete(formatted)) {
            runAutosave();
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Edit retailer
                </h2>
            }
        >
            <Head title={`Edit · ${retailer.name}`} />

            <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Edit Retailer Profile
                            {autosaving ? (
                                <span className="ml-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                    Saving…
                                </span>
                            ) : null}
                        </p>
                    </div>
                    <Link
                        href={route('retailer-profiles.retailers.index')}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                    >
                        ← Back to retailers
                    </Link>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
                >
                    <div className="border-b border-gray-200 bg-white px-6 py-5 dark:border-gray-700 dark:bg-gray-800">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Retailer profile</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Update the display name, status, and contact details. Phone numbers use +country code and 10
                            national digits (formatted as +CC(AAA) EEE-NNNN); complete phones and contacts (name + email) save
                            on their own. Use Save changes
                            for everything else. The handle updates from the display name when you save the form.
                        </p>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    <FormSection
                        title="Identity"
                        description="The handle is generated from the display name (same rules as episode slugs)."
                    >
                        <div>
                            <InputLabel htmlFor="name" value="Display name *" />
                            <TextInput
                                id="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                className="mt-1 block w-full"
                                placeholder="Retailer name"
                            />
                            <InputError message={errors.name} className="mt-1" />
                        </div>
                        <div>
                            <InputLabel htmlFor="handle" value="Handle (generated from display name, read-only)" />
                            <input
                                id="handle"
                                type="text"
                                readOnly
                                value={handleDisplay}
                                className={readOnlyHandleClass}
                                tabIndex={-1}
                                aria-label="Handle"
                            />
                        </div>
                    </FormSection>

                    <FormSection
                        title="Status & departments"
                        description="Control visibility and assign one or more departments for reporting."
                    >
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                            <div className="sm:max-w-md">
                                <InputLabel value="Profile status" />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    Inactive retailers stay in the list but can be hidden from public use later.
                                </p>
                                <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-700">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {data.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={data.is_active}
                                        onClick={() => setData('is_active', !data.is_active)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                                            data.is_active ? 'bg-indigo-500' : 'bg-gray-200'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                                                data.is_active ? 'translate-x-5' : 'translate-x-0.5'
                                            }`}
                                        />
                                    </button>
                                </div>
                                <InputError message={errors.is_active} className="mt-1" />
                            </div>
                            <div className="min-w-0 flex-1 sm:max-w-md">
                                <InputLabel htmlFor="department_add" value="Departments" />
                                <select
                                    id="department_add"
                                    value=""
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (v) {
                                            addDepartment(Number(v));
                                        }
                                        e.target.value = '';
                                    }}
                                    className={selectClass}
                                >
                                    <option value="">Add department…</option>
                                    {availableDepartments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                                {selectedDepartments.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {selectedDepartments.map((d) => (
                                            <span
                                                key={d.id}
                                                className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-sm font-medium text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100"
                                            >
                                                {d.name}
                                                <button
                                                    type="button"
                                                    className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full text-indigo-600 hover:bg-indigo-200/80 dark:text-indigo-300 dark:hover:bg-indigo-800"
                                                    aria-label={`Remove ${d.name}`}
                                                    onClick={() => removeDepartment(d.id)}
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">No departments selected.</p>
                                )}
                                <InputError message={errors.department_ids} className="mt-1" />
                            </div>
                        </div>
                    </FormSection>

                    <FormSection title="About" description="Optional overview of the retailer or relationship notes.">
                        <div>
                            <InputLabel htmlFor="description" value="Description" />
                            <div className="mt-1">
                                <RichTextEditor
                                    id="description"
                                    value={data.description}
                                    onChange={(html) => setData('description', html)}
                                    placeholder="Buying preferences, store format, partnership notes…"
                                />
                            </div>
                            <InputError message={errors.description} className="mt-1" />
                        </div>
                        <div>
                            <InputLabel htmlFor="notes" value="Notes" />
                            <textarea
                                id="notes"
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                rows={4}
                                className={`${selectClass} mt-1 w-full rounded-md`}
                                placeholder="Internal notes (plain text). Not shown on the public retailer profile."
                            />
                            <InputError message={errors.notes} className="mt-1" />
                        </div>
                    </FormSection>

                    <FormSection
                        title="Location"
                        description="Mailing or storefront address. Street lines are full width; city and region sit side by side."
                    >
                        <div>
                            <InputLabel htmlFor="address_line_1" value="Address line 1" />
                            <TextInput
                                id="address_line_1"
                                value={data.address_line_1}
                                onChange={(e) => setData('address_line_1', e.target.value)}
                                className="mt-1 block w-full"
                            />
                            <InputError message={errors.address_line_1} className="mt-1" />
                        </div>
                        <div>
                            <InputLabel htmlFor="address_line_2" value="Address line 2" />
                            <TextInput
                                id="address_line_2"
                                value={data.address_line_2}
                                onChange={(e) => setData('address_line_2', e.target.value)}
                                className="mt-1 block w-full"
                            />
                            <InputError message={errors.address_line_2} className="mt-1" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <InputLabel htmlFor="city" value="City" />
                                <TextInput
                                    id="city"
                                    value={data.city}
                                    onChange={(e) => setData('city', e.target.value)}
                                    className="mt-1 block w-full"
                                />
                                <InputError message={errors.city} className="mt-1" />
                            </div>
                            <div>
                                <InputLabel htmlFor="state" value="Province / state" />
                                <TextInput
                                    id="state"
                                    value={data.state}
                                    onChange={(e) => setData('state', e.target.value)}
                                    className="mt-1 block w-full"
                                />
                                <InputError message={errors.state} className="mt-1" />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <InputLabel htmlFor="zip" value="Postal / ZIP" />
                                <TextInput
                                    id="zip"
                                    value={data.zip}
                                    onChange={(e) => setData('zip', e.target.value)}
                                    className="mt-1 block w-full"
                                />
                                <InputError message={errors.zip} className="mt-1" />
                            </div>
                            <div>
                                <InputLabel htmlFor="country" value="Country" />
                                <TextInput
                                    id="country"
                                    value={data.country}
                                    onChange={(e) => setData('country', e.target.value)}
                                    className="mt-1 block w-full"
                                />
                                <InputError message={errors.country} className="mt-1" />
                            </div>
                        </div>
                    </FormSection>

                    <FormSection
                        title="Store email & website"
                        description="General store contact details (not individual buyers)."
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <InputLabel htmlFor="email" value="Store email" />
                                <TextInput
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className="mt-1 block w-full"
                                />
                                <InputError message={errors.email} className="mt-1" />
                            </div>
                            <div>
                                <InputLabel htmlFor="website" value="Website" />
                                <TextInput
                                    id="website"
                                    value={data.website}
                                    onChange={(e) =>
                                        setData('website', normalizeWebsiteInput(e.target.value))
                                    }
                                    className="mt-1 block w-full"
                                    placeholder="https://…"
                                />
                                <InputError message={errors.website} className="mt-1" />
                            </div>
                        </div>
                    </FormSection>

                    <FormSection
                        title="Store phone numbers"
                        description="Leading +; country code then 10 digits (e.g. +1(555) 123-4567 or +91(123) 123-1234). Spaces and punctuation are ignored; when complete, it saves immediately—including after a paste."
                    >
                        <div className="space-y-4">
                            {data.phone_numbers.length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No numbers yet.</p>
                            )}
                            {data.phone_numbers.map((row, index) => (
                                <div
                                    key={row.id ?? `new-${index}`}
                                    className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-end dark:border-gray-600 dark:bg-gray-800/50"
                                >
                                    <div className="min-w-0 flex-1">
                                        <InputLabel value={`Phone ${index + 1}`} />
                                        <TextInput
                                            value={row.phone_number}
                                            onChange={(e) => updatePhone(index, e.target.value)}
                                            className="mt-1 block w-full"
                                            placeholder="e.g. +1(555) 123-4567"
                                            inputMode="tel"
                                            autoComplete="tel"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removePhone(index)}
                                        className="shrink-0 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                            <SecondaryButton type="button" onClick={addPhone}>
                                + Add phone number
                            </SecondaryButton>
                            <InputError message={errors.phone_numbers} className="mt-1" />
                        </div>
                    </FormSection>

                    <FormSection
                        title="People & contacts"
                        description="Buyers, category managers, or other contacts. When name and a valid email are both filled, that row saves on change (including paste). Remove saves immediately."
                    >
                        <div className="space-y-6">
                            {data.contacts.length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No contacts yet.</p>
                            )}
                            {data.contacts.map((row, index) => (
                                <div
                                    key={row.id ?? `c-new-${index}`}
                                    className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-800/50 md:p-5"
                                >
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Contact {index + 1}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => removeContact(index)}
                                            className="text-sm text-red-600 hover:underline dark:text-red-400"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="sm:col-span-2">
                                            <InputLabel value="Name" />
                                            <TextInput
                                                value={row.contact_name}
                                                onChange={(e) => updateContact(index, 'contact_name', e.target.value)}
                                                className="mt-1 block w-full"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <InputLabel value="Title" />
                                            <TextInput
                                                value={row.title}
                                                onChange={(e) => updateContact(index, 'title', e.target.value)}
                                                className="mt-1 block w-full"
                                                placeholder="Category buyer, Owner…"
                                            />
                                        </div>
                                        <div>
                                            <InputLabel value="Email" />
                                            <TextInput
                                                type="email"
                                                value={row.email}
                                                onChange={(e) => updateContact(index, 'email', e.target.value)}
                                                className="mt-1 block w-full"
                                            />
                                        </div>
                                        <div>
                                            <InputLabel value="LinkedIn" />
                                            <TextInput
                                                value={row.linkedin}
                                                onChange={(e) => updateContact(index, 'linkedin', e.target.value)}
                                                className="mt-1 block w-full"
                                                placeholder="Profile URL"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <SecondaryButton type="button" onClick={addContact}>
                                + Add contact
                            </SecondaryButton>
                            <InputError message={errors.contacts} className="mt-1" />
                        </div>
                    </FormSection>

                    <div className="flex flex-wrap items-center gap-4 px-6 py-5 md:px-8">
                        <PrimaryButton type="submit" disabled={processing || autosaving}>
                            {processing ? 'Saving…' : 'Save changes'}
                        </PrimaryButton>
                        <Link
                            href={route('retailer-profiles.retailers.index')}
                            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                            Cancel
                        </Link>
                    </div>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
