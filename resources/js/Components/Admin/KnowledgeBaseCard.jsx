import { AlertCircle, BookOpen, CheckCircle2, Clock, ExternalLink, FileText, Info, Loader2, Search, Trash2, Upload, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL = 4000;
const TERMINAL_STATUSES = new Set(['succeeded', 'failed', 'rag_limit_exceeded', 'document_too_small', 'cannot_index_folder']);
const ACCEPTED_FILE_TYPES = '.txt,.pdf,.docx,.html,.epub';

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

function jsonHeaders(extra = {}) {
    return { 'X-CSRF-TOKEN': csrfToken(), Accept: 'application/json', ...extra };
}

/* ── RAG status badge ────────────────────────────────────────────────────── */
function RagStatusBadge({ status }) {
    if (!status) return null;
    const map = {
        new:                 { color: 'text-gray-500 bg-gray-100 dark:bg-slate-700 dark:text-slate-300',             icon: <Clock className="h-3 w-3" />,                       label: 'Queued' },
        created:             { color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300',             icon: <Loader2 className="h-3 w-3 animate-spin" />,         label: 'Created' },
        processing:          { color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300',         icon: <Loader2 className="h-3 w-3 animate-spin" />,         label: 'Indexing…' },
        succeeded:           { color: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-300', icon: <CheckCircle2 className="h-3 w-3" />,                 label: 'Ready for RAG' },
        failed:              { color: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-300',                 icon: <AlertCircle className="h-3 w-3" />,                  label: 'Index failed' },
        rag_limit_exceeded:  { color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-300',     icon: <AlertCircle className="h-3 w-3" />,                  label: 'RAG limit' },
        document_too_small:  { color: 'text-gray-500 bg-gray-100 dark:bg-slate-700 dark:text-slate-300',             icon: <AlertCircle className="h-3 w-3" />,                  label: 'Too small' },
        cannot_index_folder: { color: 'text-gray-500 bg-gray-100 dark:bg-slate-700 dark:text-slate-300',             icon: <AlertCircle className="h-3 w-3" />,                  label: 'Cannot index' },
    };
    const cfg = map[status] ?? { color: 'text-gray-500 bg-gray-100 dark:bg-slate-700', icon: null, label: status };
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
            {cfg.icon}{cfg.label}
        </span>
    );
}

/* ── Confirm dialog ──────────────────────────────────────────────────────── */
function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
                <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
                {message && <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">{message}</p>}
                <div className="mt-5 flex flex-col gap-2.5">
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                            danger
                                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                        }`}
                    >
                        {confirmLabel}
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

/**
 * Returns [confirm, dialogNode].
 * Call confirm({ title, message, confirmLabel, danger }) → Promise<boolean>.
 */
function useConfirm() {
    const [pending, setPending] = useState(null);

    const confirm = (opts) => new Promise((resolve) => {
        setPending({ ...opts, resolve });
    });

    const handleConfirm = () => { pending?.resolve(true);  setPending(null); };
    const handleCancel  = () => { pending?.resolve(false); setPending(null); };

    const dialog = pending ? (
        <ConfirmDialog
            title={pending.title}
            message={pending.message}
            confirmLabel={pending.confirmLabel}
            danger={pending.danger}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
        />
    ) : null;

    return [confirm, dialog];
}

/* ── View modal ──────────────────────────────────────────────────────────── */
function ViewModal({ kbId, kbName, ragStatus, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-indigo-500" />
                        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Knowledge Base Details</h3>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400">Document name</p>
                        <p className="mt-0.5 text-sm text-gray-900 dark:text-slate-100">{kbName ?? '—'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400">ElevenLabs document ID</p>
                        <p className="mt-0.5 break-all font-mono text-xs text-gray-700 dark:text-slate-300">{kbId}</p>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-slate-400">RAG status</p>
                        <div className="mt-1"><RagStatusBadge status={ragStatus} /></div>
                    </div>
                    {ragStatus === 'succeeded' && (
                        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                            This knowledge base is fully indexed and will be injected into the AI agent's context when a user starts a conversation for this product.
                        </p>
                    )}
                </div>

                <div className="mt-5 flex justify-between gap-3">
                    <a
                        href="https://elevenlabs.io/app/conversational-ai/knowledge-base"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View in ElevenLabs
                    </a>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── Reuse picker ────────────────────────────────────────────────────────── */
function ReusePicker({ currentSlug, onSelect, onPurged }) {
    const [allDocs, setAllDocs]     = useState(null);
    const [query, setQuery]         = useState('');
    const [loading, setLoading]     = useState(false);
    const [purgingId, setPurgingId] = useState(null);
    const [confirm, confirmDialog]  = useConfirm();

    const load = () => {
        setLoading(true);
        fetch(route('ai-concierge.kb.list'), { credentials: 'same-origin', headers: jsonHeaders() })
            .then((r) => r.json())
            .then((data) => setAllDocs(Array.isArray(data) ? data : []))
            .catch(() => setAllDocs([]))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const handlePurge = async (e, doc) => {
        e.stopPropagation();
        const ok = await confirm({
            title:        'Permanently delete knowledge base?',
            message:      `"${doc.kb_name ?? doc.elevenlabs_kb_id}" will be removed from ElevenLabs and unlinked from all products. This cannot be undone.`,
            confirmLabel: 'Yes, delete everywhere',
            danger:       true,
        });
        if (!ok) return;

        setPurgingId(doc.elevenlabs_kb_id);
        try {
            const res = await fetch(route('ai-concierge.kb.purge', doc.elevenlabs_kb_id), {
                method: 'DELETE', credentials: 'same-origin', headers: jsonHeaders(),
            });
            if (res.ok) {
                setAllDocs((prev) => prev.filter((d) => d.elevenlabs_kb_id !== doc.elevenlabs_kb_id));
                onPurged?.(doc.elevenlabs_kb_id);
            }
        } finally {
            setPurgingId(null);
        }
    };

    const filtered = (allDocs ?? []).filter((d) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        const usedByNames = (d.used_by ?? []).map((p) => p.product_name?.toLowerCase()).join(' ');
        return (
            d.kb_name?.toLowerCase().includes(q) ||
            d.elevenlabs_kb_id?.toLowerCase().includes(q) ||
            usedByNames.includes(q)
        );
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
            </div>
        );
    }

    if (allDocs !== null && allDocs.length === 0) {
        return (
            <p className="py-6 text-center text-xs text-gray-400 dark:text-slate-500">
                No products have a knowledge base yet.
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {confirmDialog}

            <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by product or KB name…"
                    className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                />
            </div>

            {filtered.length === 0 && query ? (
                <p className="py-4 text-center text-xs text-gray-400 dark:text-slate-500">No results for "{query}"</p>
            ) : (
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-slate-600 dark:bg-slate-700/30">
                    {filtered.map((doc) => (
                        <div key={doc.elevenlabs_kb_id} className="group flex items-center gap-1 rounded-md transition hover:bg-white hover:shadow-sm dark:hover:bg-slate-700">
                            <button
                                type="button"
                                onClick={() => onSelect(doc)}
                                className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left"
                            >
                                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400 dark:text-indigo-500" />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium text-gray-800 dark:text-slate-200">{doc.kb_name ?? doc.elevenlabs_kb_id}</p>
                                    {doc.used_by?.length > 0 ? (
                                        <p className="truncate text-[10px] text-gray-500 dark:text-slate-400">
                                            Used by: {doc.used_by.map((p) => p.product_name).join(', ')}
                                        </p>
                                    ) : (
                                        <p className="text-[10px] italic text-gray-400 dark:text-slate-500">Not assigned to any product</p>
                                    )}
                                </div>
                                <RagStatusBadge status={doc.kb_rag_status} />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handlePurge(e, doc)}
                                disabled={purgingId === doc.elevenlabs_kb_id}
                                className="mr-1.5 shrink-0 rounded p-1 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 disabled:opacity-50"
                                title="Permanently delete from ElevenLabs and all products"
                            >
                                {purgingId === doc.elevenlabs_kb_id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                }
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function KnowledgeBaseCard({ product, initialText, initialKbName }) {
    const defaultKbName = `${product.product_name ?? 'Product'} — Knowledge Base`;

    const [mode, setMode]         = useState('text'); // 'text' | 'file' | 'reuse'
    const [text, setText]         = useState(initialText ?? '');
    const [file, setFile]         = useState(null);
    const [fileName, setFileName] = useState('');
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting]   = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [error, setError]         = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [customName, setCustomName]       = useState(initialKbName ?? defaultKbName);
    const [editingName, setEditingName]     = useState(false);
    const nameInputRef = useRef(null);
    const [confirm, confirmDialog]  = useConfirm();

    const [kbId, setKbId]         = useState(product.elevenlabs_kb_id ?? null);
    const [ragStatus, setRagStatus] = useState(product.kb_rag_status ?? null);
    const [kbName, setKbName]     = useState(product.kb_name ?? null);
    const [kbType, setKbType]     = useState(product.kb_type ?? null);

    // When parent pushes new content from the AI modal, switch to text mode and pre-fill
    useEffect(() => {
        if (initialText) {
            setMode('text');
            setText(initialText);
        }
    }, [initialText]);

    useEffect(() => {
        if (initialKbName) setCustomName(initialKbName);
    }, [initialKbName]);

    const pollRef    = useRef(null);
    const fileInputRef = useRef(null);

    /* ── RAG polling ── */
    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, []);

    const startPolling = useCallback(() => {
        stopPolling();
        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(route('ai-concierge.kb.rag-status', product.slug), {
                    method: 'POST', credentials: 'same-origin', headers: jsonHeaders(),
                });
                if (!res.ok) return;
                const data = await res.json();
                setRagStatus(data.status);
                if (TERMINAL_STATUSES.has(data.status)) stopPolling();
            } catch { /* silent */ }
        }, POLL_INTERVAL);
    }, [product.slug, stopPolling]);

    useEffect(() => {
        if (kbId && ragStatus && !TERMINAL_STATUSES.has(ragStatus)) startPolling();
        return stopPolling;
    }, [kbId, ragStatus, startPolling, stopPolling]);

    /* ── Upload ── */
    const handleUpload = async () => {
        setError(null);
        if (mode === 'text' && !text.trim()) { setError('Please enter some text.'); return; }
        if (mode === 'file' && !file)         { setError('Please select a file.');   return; }
        setUploading(true);
        setEditingName(false);
        stopPolling();
        try {
            const fd = new FormData();
            if (mode === 'file') fd.append('file', file); else fd.append('text', text.trim());
            const nameToSend = customName.trim() || defaultKbName;
            fd.append('kb_name', nameToSend);
            const res  = await fetch(route('ai-concierge.kb.upload', product.slug), {
                method: 'POST', credentials: 'same-origin', headers: jsonHeaders(), body: fd,
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Upload failed.'); return; }
            setKbId(data.kb_id); setRagStatus(data.rag_status); setKbName(data.kb_name); setKbType(data.kb_type ?? null);
            setText(''); setFile(null); setFileName('');
            setCustomName(defaultKbName);
            if (!TERMINAL_STATUSES.has(data.rag_status)) startPolling();
        } catch { setError('Unexpected error during upload.'); }
        finally { setUploading(false); }
    };

    /* ── Assign existing ── */
    const handleAssign = async (doc) => {
        setAssigning(true);
        setError(null);
        stopPolling();
        try {
            const res  = await fetch(route('ai-concierge.kb.assign', product.slug), {
                method: 'POST', credentials: 'same-origin',
                headers: { ...jsonHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ kb_id: doc.elevenlabs_kb_id, kb_name: doc.kb_name, kb_type: doc.kb_type, rag_status: doc.kb_rag_status }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Could not assign.'); return; }
            setKbId(data.kb_id); setRagStatus(data.rag_status); setKbName(data.kb_name); setKbType(data.kb_type ?? null);
            setMode('text');
            if (!TERMINAL_STATUSES.has(data.rag_status)) startPolling();
        } catch { setError('Unexpected error.'); }
        finally { setAssigning(false); }
    };

    /* ── Unlink (banner delete — this product only) ── */
    const handleUnlink = async () => {
        const ok = await confirm({
            title:        'Remove knowledge base from this product?',
            message:      'The document stays on ElevenLabs and other products are unaffected. You can re-assign it later.',
            confirmLabel: 'Remove from this product',
            danger:       false,
        });
        if (!ok) return;
        setDeleting(true);
        stopPolling();
        try {
            const res = await fetch(route('ai-concierge.kb.unlink', product.slug), {
                method: 'DELETE', credentials: 'same-origin', headers: jsonHeaders(),
            });
            if (res.ok) { setKbId(null); setRagStatus(null); setKbName(null); setKbType(null); }
        } finally { setDeleting(false); }
    };

    /* ── Called when ReusePicker purges a doc that happens to be ours ── */
    const handlePurged = (purgedKbId) => {
        if (purgedKbId === kbId) { setKbId(null); setRagStatus(null); setKbName(null); setKbType(null); stopPolling(); }
    };

    /* ── File drop ── */
    const handleFileDrop = (e) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) { setFile(f); setFileName(f.name); }
    };
    const handleFileChange = (e) => {
        const f = e.target.files?.[0];
        if (f) { setFile(f); setFileName(f.name); }
        e.target.value = '';
    };

    const TABS = [
        ['text',  <FileText className="h-3.5 w-3.5" key="t" />,  'Paste text'],
        ['file',  <Upload   className="h-3.5 w-3.5" key="f" />,  'Upload file'],
        ['reuse', <Search   className="h-3.5 w-3.5" key="r" />,  'Reuse existing'],
    ];

    return (
        <>
            {confirmDialog}
            {showViewModal && (
                <ViewModal
                    kbId={kbId}
                    kbName={kbName}
                    ragStatus={ragStatus}
                    onClose={() => setShowViewModal(false)}
                />
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-600 dark:bg-slate-800">
                <div className="mb-4 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Agent Knowledge Base
                    </h3>
                </div>

                <p className="mb-4 text-xs text-gray-500 dark:text-slate-400">
                    Upload product-specific text or a document. When a user starts a conversation for this product, the agent retrieves from this knowledge base to answer accurately.
                </p>

                {/* ── Current KB status ── */}
                {kbId && (
                    <div className="mb-4 flex items-start justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 dark:border-indigo-800/40 dark:bg-indigo-900/20">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-indigo-900 dark:text-indigo-200">
                                {kbName ?? 'Knowledge Base'}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                <RagStatusBadge status={ragStatus} />
                                <span className="font-mono text-[10px] text-gray-400 dark:text-slate-500 truncate max-w-[120px]">{kbId}</span>
                            </div>
                            {ragStatus === 'succeeded' && (
                                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                                    RAG indexed — agent retrieves from this doc during conversations.
                                </p>
                            )}
                            {ragStatus === 'failed' && (
                                <p className="mt-1 text-xs text-red-600 dark:text-red-400">Indexing failed. Try re-uploading.</p>
                            )}
                        </div>
                        {/* View + Delete buttons */}
                        <div className="flex shrink-0 items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setShowViewModal(true)}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 focus:outline-none"
                                title="View details"
                            >
                                <Info className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleUnlink}
                                disabled={deleting}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400 focus:outline-none disabled:opacity-50"
                                title="Unlink from this product only"
                            >
                                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Add / Replace section ── */}
                <div>
                    <p className="mb-2 text-xs font-medium text-gray-600 dark:text-slate-300">
                        {kbId ? 'Replace knowledge base' : 'Add knowledge base'}
                    </p>

                    {/* Mode tabs */}
                    <div className="mb-3 flex overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-slate-600 dark:bg-slate-700/50">
                        {TABS.map(([m, icon, label]) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => { setMode(m); setError(null); }}
                                className={`flex flex-1 items-center justify-center gap-1 py-1.5 text-[11px] font-medium transition ${
                                    mode === m
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-gray-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-600'
                                }`}
                            >
                                {icon}{label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    {mode === 'text' && (
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={6}
                            placeholder="Paste product details, FAQs, ingredient lists, usage instructions…"
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
                        />
                    )}

                    {mode === 'file' && (
                        <label
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 py-4 transition ${
                                dragging
                                    ? 'border-indigo-500 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-900/20'
                                    : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-slate-500 dark:bg-slate-700/50 dark:hover:border-indigo-400'
                            }`}
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleFileDrop}
                        >
                            <Upload className={`h-4 w-4 shrink-0 ${dragging ? 'text-indigo-500' : 'text-gray-400 dark:text-slate-400'}`} />
                            <span className="min-w-0 flex-1 text-xs text-gray-600 dark:text-slate-300">
                                {fileName
                                    ? <span className="block truncate font-medium text-indigo-700 dark:text-indigo-300">{fileName}</span>
                                    : <>Click or drag · <span className="text-gray-400">TXT, PDF, DOCX, HTML, EPUB</span></>
                                }
                            </span>
                            <input ref={fileInputRef} type="file" accept={ACCEPTED_FILE_TYPES} className="sr-only" onChange={handleFileChange} />
                        </label>
                    )}

                    {mode === 'reuse' && (
                        <ReusePicker currentSlug={product.slug} onSelect={handleAssign} onPurged={handlePurged} />
                    )}

                    {/* Editable KB name — only shown for text/file upload */}
                    {mode !== 'reuse' && (
                        <div className="mt-3">
                            {editingName ? (
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    onBlur={() => { if (!customName.trim()) setCustomName(defaultKbName); setEditingName(false); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { if (!customName.trim()) setCustomName(defaultKbName); setEditingName(false); } }}
                                    className="w-full rounded-lg border border-indigo-400 bg-white px-3 py-1.5 text-xs text-gray-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-indigo-500 dark:bg-slate-800 dark:text-slate-200"
                                    autoFocus
                                />
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.select(), 0); }}
                                    className="group flex w-full items-center gap-1.5 rounded-lg border border-dashed border-gray-200 px-3 py-1.5 text-left hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-600 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/10"
                                    title="Click to rename"
                                >
                                    <span className="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                        {customName}
                                    </span>
                                    <span className="shrink-0 text-[10px] text-gray-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400">rename</span>
                                </button>
                            )}
                        </div>
                    )}

                    {error && (
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
                        </p>
                    )}

                    {/* Action button (hidden for reuse tab — selection triggers action directly) */}
                    {mode !== 'reuse' && (
                        <button
                            type="button"
                            onClick={handleUpload}
                            disabled={uploading}
                            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 focus:outline-none"
                        >
                            {uploading
                                ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading &amp; indexing…</>
                                : <><Upload className="h-4 w-4" />{kbId ? 'Replace' : 'Upload'} knowledge base</>
                            }
                        </button>
                    )}

                    {assigning && (
                        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-slate-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />Assigning…
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
