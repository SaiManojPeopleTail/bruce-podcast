import Modal from '@/Components/Modal';
import { CheckCircle2, ExternalLink, Instagram, Linkedin, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

function parseSseBlock(block) {
    let event = 'message';
    let data = '';

    for (const raw of block.split('\n')) {
        const line = raw.replace(/\r$/, '');
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data: ')) data += line.slice(6);
        else if (line.startsWith('data:')) data += line.slice(5);
    }

    if (!data.trim()) return null;

    try {
        return { event, data: JSON.parse(data) };
    } catch {
        return null;
    }
}

function normalizePlatform(platform) {
    return String(platform ?? '').toLowerCase();
}

/** Generate a KB filename from company + product names */
function makeKbFilename(companyName, productName) {
    const slugPart = (s) =>
        String(s ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5).replace(':', '-');
    const c = slugPart(companyName) || 'company';
    const p = slugPart(productName) || 'product';
    return `${c}-${p}-KB-${date}-${time}`;
}

function PostCard({ post }) {
    const platform = normalizePlatform(post.platform);
    const isInstagram = platform === 'instagram';

    return (
        <a
            href={post.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-[#b59100]/40 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-[#b59100]/30"
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    isInstagram
                        ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-200'
                        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200'
                }`}>
                    {isInstagram
                        ? <Instagram className="h-2.5 w-2.5" />
                        : <Linkedin className="h-2.5 w-2.5" />
                    }
                    {platform}
                </span>
                <ExternalLink className="h-3 w-3 shrink-0 text-gray-300 transition group-hover:text-[#b59100] dark:text-slate-600" />
            </div>

            {/* URL pill */}
            <p className="truncate font-mono text-[10px] text-gray-400 dark:text-slate-500">
                {post.post_url.replace(/^https?:\/\/(www\.)?/, '')}
            </p>

            {/* Caption */}
            {post.description && (
                <p className="line-clamp-3 text-xs leading-relaxed text-gray-600 dark:text-slate-300">
                    {post.description}
                </p>
            )}
        </a>
    );
}

export default function ProductContentExtractorModal({ show, onClose, onApply }) {
    const [companyUrl, setCompanyUrl] = useState('');
    const [instagramHandle, setInstagramHandle] = useState('');
    const [linkedinHandle, setLinkedinHandle] = useState('');
    const [running, setRunning] = useState(false);
    const [thoughts, setThoughts] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // Keep state across open/close — only reset on explicit clear
    const abortRef = useRef(null);

    const joinedThoughts = useMemo(() => thoughts.join('\n'), [thoughts]);
    const thoughtsRef = useRef(null);
    useEffect(() => {
        if (thoughtsRef.current) {
            thoughtsRef.current.scrollTop = thoughtsRef.current.scrollHeight;
        }
    }, [joinedThoughts]);

    const handleClear = () => {
        if (running) return;
        setCompanyUrl('');
        setInstagramHandle('');
        setLinkedinHandle('');
        setThoughts([]);
        setResult(null);
        setError(null);
    };

    const runExtraction = async () => {
        if (running || !companyUrl.trim()) return;

        setRunning(true);
        setThoughts(['Preparing GPT web-search extraction...']);
        setResult(null);
        setError(null);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const response = await fetch(route('product-qr-lists.extract-content'), {
                method: 'POST',
                credentials: 'same-origin',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                    Accept: 'text/event-stream',
                },
                body: JSON.stringify({
                    company_url: companyUrl.trim(),
                    instagram_handle: instagramHandle.trim().replace(/^@+/, ''),
                    linkedin_handle: linkedinHandle.trim().replace(/^@+/, ''),
                }),
            });

            if (!response.ok || !response.body) {
                throw new Error(`Request failed (HTTP ${response.status})`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                let sep;
                while ((sep = buffer.indexOf('\n\n')) !== -1) {
                    const block = buffer.slice(0, sep);
                    buffer = buffer.slice(sep + 2);
                    const evt = parseSseBlock(block);
                    if (!evt) continue;

                    if (evt.event === 'thought') {
                        setThoughts((prev) => [...prev, evt.data.text]);
                    } else if (evt.event === 'result') {
                        setResult(evt.data.result);
                    } else if (evt.event === 'error') {
                        throw new Error(evt.data.detail || evt.data.message || 'Extraction failed.');
                    }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                setError(err.message ?? 'Extraction failed.');
            }
        } finally {
            setRunning(false);
            abortRef.current = null;
        }
    };

    const applyResult = () => {
        if (!result) return;
        onApply?.(result);
        onClose();
    };

    const kbText = result
        ? [
            result.about_company ? `ABOUT THE COMPANY\n${result.about_company}` : '',
            result.about_product ? `ABOUT THE PRODUCT\n${result.about_product}` : '',
          ].filter(Boolean).join('\n\n')
        : '';

    const kbFilename = result
        ? makeKbFilename(result.name?.company_name, result.name?.product_name)
        : '';

    return (
        <Modal show={show} onClose={running ? () => {} : onClose} maxWidth="5xl">
            <div className="max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900">
                <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-slate-700">
                    <div>
                        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-slate-100">
                            <Sparkles className="h-4 w-4 text-[#b59100]" />
                            Automatic product extraction
                        </h3>
                        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                            Uses GPT web search against official website, Instagram, and LinkedIn only.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {!running && (companyUrl || result) && (
                            <button
                                type="button"
                                onClick={handleClear}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                                <RefreshCw className="h-3 w-3" />
                                Clear
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={running}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </header>

                <div className="space-y-5 p-5">
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
                                Product URL on company website *
                            </label>
                            <input
                                type="url"
                                value={companyUrl}
                                onChange={(e) => setCompanyUrl(e.target.value)}
                                placeholder="https://company.com/products/product-name"
                                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-[#b59100] focus:ring-[#b59100] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
                                    Instagram handle
                                    <span className="ml-1 text-xs font-normal text-gray-400 dark:text-slate-500">(optional)</span>
                                </label>
                                <div className="relative mt-1">
                                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400 dark:text-slate-500">@</span>
                                    <input
                                        type="text"
                                        value={instagramHandle}
                                        onChange={(e) => setInstagramHandle(e.target.value.replace(/^@+/, ''))}
                                        placeholder="companyhandle"
                                        className="block w-full rounded-md border-gray-300 pl-7 text-sm shadow-sm focus:border-[#b59100] focus:ring-[#b59100] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
                                    LinkedIn handle
                                    <span className="ml-1 text-xs font-normal text-gray-400 dark:text-slate-500">(optional)</span>
                                </label>
                                <div className="relative mt-1">
                                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400 dark:text-slate-500">@</span>
                                    <input
                                        type="text"
                                        value={linkedinHandle}
                                        onChange={(e) => setLinkedinHandle(e.target.value.replace(/^@+/, ''))}
                                        placeholder="company-name"
                                        className="block w-full rounded-md border-gray-300 pl-7 text-sm shadow-sm focus:border-[#b59100] focus:ring-[#b59100] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={runExtraction}
                            disabled={running || !companyUrl.trim()}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#b59100] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#9a7c00] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            {running ? 'Extracting...' : 'Run automatic extraction'}
                        </button>

                        {(running || thoughts.length > 0) && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                                <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                                    {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                    Thinking
                                </h4>
                                <pre ref={thoughtsRef} className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-amber-800 dark:text-amber-100">
                                    {joinedThoughts || 'Starting extraction...'}
                                </pre>
                            </div>
                        )}

                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                {error}
                            </div>
                        )}

                        {result && (
                            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                                {/* Names */}
                                {(result.name?.product_name || result.name?.company_name) && (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                                Product name
                                            </label>
                                            <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-slate-100">
                                                {result.name.product_name || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                                Company name
                                            </label>
                                            <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-slate-100">
                                                {result.name.company_name || '—'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Product description (goes into form) */}
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                        Product description
                                        <span className="ml-1 font-normal normal-case text-[#b59100]">→ fills description field</span>
                                    </label>
                                    <textarea
                                        readOnly
                                        value={result.product_description ?? ''}
                                        rows={4}
                                        className="mt-1 block w-full rounded-md border-gray-200 bg-white text-sm text-gray-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    />
                                </div>

                                {/* KB preview */}
                                {kbText && (
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                            Knowledge base content
                                            <span className="ml-1 font-normal normal-case text-indigo-500">→ pre-fills KB card</span>
                                        </label>
                                        <p className="mt-0.5 font-mono text-[10px] text-gray-400 dark:text-slate-500">
                                            {kbFilename}
                                        </p>
                                        <textarea
                                            readOnly
                                            value={kbText}
                                            rows={5}
                                            className="mt-1 block w-full rounded-md border-gray-200 bg-white text-xs text-gray-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                        />
                                    </div>
                                )}

                                {result.notes && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                                        {result.notes}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={applyResult}
                                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Apply to form
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ── Social posts grid ── */}
                    {result?.social_links?.length > 0 && (
                        <div>
                            <div className="mb-3 flex items-center gap-3">
                                <h4 className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                                    Social posts
                                </h4>
                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-slate-700 dark:text-slate-400">
                                    {result.social_links.length}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                                {result.social_links.map((post, index) => (
                                    <PostCard key={`${post.post_url}-${index}`} post={post} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
