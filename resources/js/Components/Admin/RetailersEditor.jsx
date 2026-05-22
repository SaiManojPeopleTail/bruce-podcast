import { router } from '@inertiajs/react';
import { Globe, Mail, Phone, Plus, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function newRetailer(overrides = {}) {
    return {
        _localId:             crypto.randomUUID(),
        retailer_profile_id:  null,
        _originalActions:     null, // snapshot when populated from search
        name:                 '',
        actions:              [],
        ...overrides,
    };
}

function newAction(overrides = {}) {
    return { type: 'link', label: '', value: '', ...overrides };
}

const ACTION_ICONS = {
    link:  Globe,
    email: Mail,
    phone: Phone,
};

const ACTION_LABELS = { link: 'Link', email: 'Email', phone: 'Phone' };

function actionsChanged(current, original) {
    if (!original) return false;
    return JSON.stringify(current) !== JSON.stringify(original);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ActionRow({ action, onChange, onRemove }) {
    const Icon = ACTION_ICONS[action.type] ?? Globe;
    return (
        <div className="flex items-start gap-2">
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white pl-2 dark:border-slate-600 dark:bg-slate-800">
                <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <select
                    value={action.type}
                    onChange={(e) => onChange({ ...action, type: e.target.value })}
                    className="border-0 bg-transparent py-1.5 pl-0.5 pr-6 text-xs text-gray-700 focus:ring-0 dark:text-slate-200"
                >
                    {Object.entries(ACTION_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                    ))}
                </select>
            </div>
            <input
                type="text"
                placeholder="Label"
                value={action.label}
                onChange={(e) => onChange({ ...action, label: e.target.value })}
                className="w-24 shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            />
            <input
                type={action.type === 'email' ? 'email' : action.type === 'phone' ? 'tel' : 'url'}
                placeholder={action.type === 'link' ? 'https://…' : action.type === 'email' ? 'hello@…' : '+1 555…'}
                value={action.value}
                onChange={(e) => onChange({ ...action, value: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            />
            <button
                type="button"
                onClick={onRemove}
                className="mt-0.5 shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 focus:outline-none"
                aria-label="Remove action"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

function RetailerCard({ retailer, onChange, onRemove }) {
    const [query, setQuery]     = useState(retailer.name);
    const [results, setResults] = useState([]);
    const [open, setOpen]       = useState(false);
    const debounceRef           = useRef(null);
    const wrapperRef            = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const search = useCallback((q) => {
        clearTimeout(debounceRef.current);
        if (!q.trim()) { setResults([]); setOpen(false); return; }
        debounceRef.current = setTimeout(async () => {
            try {
                const url = route('retailer-profiles.retailers.search') + '?q=' + encodeURIComponent(q);
                const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                const data = await res.json();
                setResults(data);
                setOpen(data.length > 0);
            } catch { /* silent */ }
        }, 250);
    }, []);

    const handleNameChange = (val) => {
        setQuery(val);
        onChange({ ...retailer, name: val, retailer_profile_id: null, _originalActions: null });
        search(val);
    };

    const handleSelect = (hit) => {
        setQuery(hit.name);
        setOpen(false);
        setResults([]);
        onChange({
            ...retailer,
            name:                hit.name,
            retailer_profile_id: hit.id,
            actions:             hit.actions,
            _originalActions:    JSON.parse(JSON.stringify(hit.actions)),
        });
    };

    const updateAction = (idx, updated) => {
        const actions = retailer.actions.map((a, i) => (i === idx ? updated : a));
        onChange({ ...retailer, actions });
    };

    const removeAction = (idx) => {
        const actions = retailer.actions.filter((_, i) => i !== idx);
        onChange({ ...retailer, actions });
    };

    const addAction = () => {
        onChange({ ...retailer, actions: [...retailer.actions, newAction()] });
    };

    const hasDrift = actionsChanged(retailer.actions, retailer._originalActions);

    return (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
            {/* Header row: name search + remove */}
            <div className="mb-3 flex items-start gap-2">
                <div ref={wrapperRef} className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                        <Search className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Retailer name…"
                        value={query}
                        onChange={(e) => handleNameChange(e.target.value)}
                        onFocus={() => { if (results.length) setOpen(true); }}
                        className="block w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    />
                    {open && (
                        <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
                            {results.map((r) => (
                                <li key={r.id}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                                        className="flex w-full flex-col px-3 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                    >
                                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{r.name}</span>
                                        {r.actions.length > 0 && (
                                            <span className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                                                {r.actions.map((a) => ACTION_LABELS[a.type]).join(' · ')}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onRemove}
                    className="mt-0.5 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 focus:outline-none"
                    aria-label="Remove retailer"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            {/* Drift notice */}
            {hasDrift && (
                <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-400">
                    Contact details differ from the saved profile — you'll be asked what to do when saving.
                </p>
            )}

            {/* Action rows */}
            <div className="space-y-2">
                {retailer.actions.map((action, idx) => (
                    <ActionRow
                        key={idx}
                        action={action}
                        onChange={(updated) => updateAction(idx, updated)}
                        onRemove={() => removeAction(idx)}
                    />
                ))}
            </div>

            <button
                type="button"
                onClick={addAction}
                className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 focus:outline-none"
            >
                <Plus className="h-3.5 w-3.5" />
                Add action
            </button>
        </div>
    );
}

// ── Conflict dialog ───────────────────────────────────────────────────────────

function ConflictDialog({ retailer, onUpdateExisting, onSaveAsNew, onKeepCustom, onCancel }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
                <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                    "{retailer.name}" already exists
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                    You've changed the contact details. What would you like to do?
                </p>
                <div className="mt-5 flex flex-col gap-2.5">
                    <button
                        type="button"
                        onClick={onUpdateExisting}
                        className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        Update existing profile
                        <span className="ml-1.5 font-normal opacity-70">(changes apply everywhere)</span>
                    </button>
                    <button
                        type="button"
                        onClick={onSaveAsNew}
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                        Save as new retailer profile
                    </button>
                    <button
                        type="button"
                        onClick={onKeepCustom}
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                        Use custom actions for this product only
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-center text-xs text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 focus:outline-none"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Usage:
 *   const [pendingConflict, setPendingConflict] = useState(null);
 *   <RetailersEditor
 *       retailers={retailers}
 *       onChange={setRetailers}
 *       pendingConflict={pendingConflict}
 *       setPendingConflict={setPendingConflict}
 *   />
 *
 * Before calling router.patch, call resolveRetailerConflicts(retailers, setPendingConflict)
 * which returns a Promise<retailer[]> with conflicts resolved.
 */
export default function RetailersEditor({ retailers, onChange, pendingConflict, setPendingConflict }) {
    const addRetailer = () => onChange([...retailers, newRetailer()]);

    const updateRetailer = (idx, updated) =>
        onChange(retailers.map((r, i) => (i === idx ? updated : r)));

    const removeRetailer = (idx) =>
        onChange(retailers.filter((_, i) => i !== idx));

    return (
        <div>
            {/* Conflict dialog (rendered by parent via pendingConflict state) */}
            {pendingConflict && (
                <ConflictDialog
                    retailer={pendingConflict.retailer}
                    onUpdateExisting={pendingConflict.onUpdateExisting}
                    onSaveAsNew={pendingConflict.onSaveAsNew}
                    onKeepCustom={pendingConflict.onKeepCustom}
                    onCancel={() => setPendingConflict(null)}
                />
            )}

            <div className="space-y-3">
                {retailers.length === 0 && (
                    <p className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-400 dark:border-slate-700 dark:text-slate-500">
                        No retailers added yet.
                    </p>
                )}
                {retailers.map((r, idx) => (
                    <RetailerCard
                        key={r._localId}
                        retailer={r}
                        onChange={(updated) => updateRetailer(idx, updated)}
                        onRemove={() => removeRetailer(idx)}
                    />
                ))}
            </div>

            <button
                type="button"
                onClick={addRetailer}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400 focus:outline-none"
            >
                <Plus className="h-4 w-4" />
                Add retailer
            </button>
        </div>
    );
}

/**
 * Resolves conflicts serially before save.
 * Returns a promise that resolves to the final retailers array (with _localId and _originalActions stripped)
 * or rejects if the user cancels.
 */
export async function resolveRetailerConflicts(retailers, setPendingConflict) {
    const resolved = [...retailers];

    for (let i = 0; i < resolved.length; i++) {
        const r = resolved[i];
        if (!r.retailer_profile_id || !actionsChanged(r.actions, r._originalActions)) continue;

        await new Promise((resolve, reject) => {
            setPendingConflict({
                retailer: r,

                onUpdateExisting: async () => {
                    setPendingConflict(null);
                    try {
                        await fetch(route('retailer-profiles.retailers.update', r.retailer_profile_id), {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
                            },
                            body: JSON.stringify({
                                _method: 'PATCH',
                                website: r.actions.find((a) => a.type === 'link')?.value ?? null,
                                email:   r.actions.find((a) => a.type === 'email')?.value ?? null,
                            }),
                        });
                    } catch { /* best-effort */ }
                    resolved[i] = { ...r, _originalActions: JSON.parse(JSON.stringify(r.actions)) };
                    resolve();
                },

                onSaveAsNew: async () => {
                    setPendingConflict(null);
                    try {
                        const res = await fetch(route('retailer-profiles.retailers.store'), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
                            },
                            body: JSON.stringify({ name: r.name }),
                        });
                        // store returns a redirect — we can't read the new ID from it directly.
                        // Clear the profile link so it saves as standalone.
                        resolved[i] = { ...r, retailer_profile_id: null, _originalActions: null };
                    } catch { /* best-effort */ }
                    resolve();
                },

                onKeepCustom: () => {
                    setPendingConflict(null);
                    resolved[i] = { ...r, retailer_profile_id: null, _originalActions: null };
                    resolve();
                },
            });
        });
    }

    // Strip internal-only keys before returning
    return resolved.map(({ _localId, _originalActions, ...rest }) => rest);
}
