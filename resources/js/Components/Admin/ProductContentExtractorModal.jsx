import Modal from '@/Components/Modal';
import { Check, CheckCircle2, ExternalLink, Instagram, Linkedin, Loader2, RefreshCw, Sparkles, Store, X } from 'lucide-react';
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
function makeKbFilename(companyName) {
    const slugPart = (s) =>
        String(s ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5).replace(':', '-');
    const c = slugPart(companyName) || 'company';
    return `${c}-KB-${date}-${time}`;
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

    // Shopify detection state
    const [shopifyStatus, setShopifyStatus] = useState(null); // null | 'checking' | 'found' | 'not_found'
    const [shopifyImages, setShopifyImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState(new Set());

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
        setShopifyStatus(null);
        setShopifyImages([]);
        setSelectedImages(new Set());
    };

    const detectShopify = async (url) => {
        if (!url?.trim()) return;
        if (shopifyStatus === 'checking' || shopifyStatus === 'found') return;
        setShopifyStatus('checking');
        setShopifyImages([]);
        setSelectedImages(new Set());
        try {
            const { protocol, hostname } = new URL(url.trim());
            const domain = `${protocol}//${hostname}`;
            const res = await fetch(`${domain}/products.json?limit=250`);
            if (!res.ok) { setShopifyStatus('not_found'); return; }
            const data = await res.json();
            if (!Array.isArray(data?.products) || data.products.length === 0) {
                setShopifyStatus('not_found'); return;
            }
            const seen = new Set();
            const imgs = [];
            for (const product of data.products) {
                for (const img of product.images ?? []) {
                    const src = img.src?.split('?')[0]; // strip query params for dedup
                    if (src && !seen.has(src)) { seen.add(src); imgs.push(img.src); }
                }
            }
            if (imgs.length > 0) {
                setShopifyStatus('found');
                setShopifyImages(imgs);
            } else {
                setShopifyStatus('not_found');
            }
        } catch (err) {
            console.warn('[Shopify detect]', err);
            setShopifyStatus('not_found');
        }
    };

    const toggleImage = (url) => {
        setSelectedImages((prev) => {
            const next = new Set(prev);
            if (next.has(url)) { next.delete(url); }
            else if (next.size < 20) { next.add(url); }
            return next;
        });
    };

    const runExtraction = async () => {
        if (running || !companyUrl.trim()) return;

        // Trigger Shopify detection in parallel if not already done
        if (shopifyStatus === null) {
            detectShopify(companyUrl.trim());
        }

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
        onApply?.({ ...result, shopify_image_urls: [...selectedImages] });
        onClose();
    };

    const kbText = result?.about ?? '';

    const kbFilename = result
        ? makeKbFilename(result.name?.company_name, '')
        : '';

    return (
        <Modal show={show} onClose={running ? () => {} : onClose} maxWidth="full">
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
                                onChange={(e) => { setCompanyUrl(e.target.value); setShopifyStatus(null); setShopifyImages([]); setSelectedImages(new Set()); }}
                                onBlur={(e) => detectShopify(e.target.value)}
                                placeholder="https://company.com/products/product-name"
                                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-[#b59100] focus:ring-[#b59100] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                            {/* Shopify status badge */}
                            {shopifyStatus === 'checking' && (
                                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Checking for Shopify product catalogue…
                                </p>
                            )}
                            {shopifyStatus === 'found' && (
                                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                    <Store className="h-3 w-3" />
                                    Shopify detected — {shopifyImages.length} product images found. Select below.
                                </p>
                            )}
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
                                    {shopifyStatus === 'checking' ? '\nChecking for Shopify product catalogue…' : ''}
                                    {shopifyStatus === 'found' ? `\nShopify detected — ${shopifyImages.length} product images loaded.` : ''}
                                </pre>
                            </div>
                        )}

                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                {error}
                            </div>
                        )}

                        {/* ── Shopify image picker (shown as soon as images load, independent of result) ── */}
                        {shopifyImages.length > 0 && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/20">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Store className="h-4 w-4 text-emerald-600" />
                                        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Shopify product images</span>
                                        <span className="rounded-full bg-emerald-200 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-800 dark:text-emerald-300">
                                            {shopifyImages.length}
                                        </span>
                                    </div>
                                    <span className={`text-xs font-medium ${selectedImages.size >= 20 ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {selectedImages.size}/20 selected
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 overflow-y-auto" style={{ maxHeight: 320 }}>
                                    {shopifyImages.map((imgUrl) => {
                                        const checked = selectedImages.has(imgUrl);
                                        const disabled = !checked && selectedImages.size >= 20;
                                        return (
                                            <button
                                                key={imgUrl}
                                                type="button"
                                                onClick={() => toggleImage(imgUrl)}
                                                disabled={disabled}
                                                style={{ width: 100, height: 100, flexShrink: 0 }}
                                                className={`group relative overflow-hidden rounded-lg border-2 transition focus:outline-none
                                                    ${checked ? 'border-[#b59100] shadow-md' : 'border-transparent hover:border-emerald-400'}
                                                    ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
                                                `}
                                            >
                                                <img src={imgUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                                                {checked && <div className="absolute inset-0 bg-[#b59100]/20" />}
                                                <div className={`absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full shadow transition
                                                    ${checked ? 'bg-[#b59100] opacity-100' : 'bg-white/80 opacity-0 group-hover:opacity-100'}`}>
                                                    <Check className="h-2.5 w-2.5 text-white" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {selectedImages.size > 0 && (
                                    <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{selectedImages.size} image{selectedImages.size > 1 ? 's' : ''} will be inserted when you apply</p>
                                )}
                            </div>
                        )}

                        {result && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                                <div className="space-y-4">
                                    {/* Company name */}
                                    {result.name?.company_name && (
                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                                Company name
                                            </label>
                                            <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-slate-100">
                                                {result.name.company_name}
                                            </p>
                                        </div>
                                    )}

                                    {/* Description → fills form */}
                                    <div>
                                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                            Description
                                            <span className="ml-1 font-normal normal-case text-[#b59100]">→ fills description field</span>
                                        </label>
                                        <textarea
                                            readOnly
                                            value={result.description ?? ''}
                                            rows={4}
                                            className="mt-1 block w-full rounded-md border-gray-200 bg-white text-sm text-gray-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                        />
                                    </div>

                                    {/* KB preview */}
                                    {kbText && (
                                        <div>
                                            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                                Knowledge base
                                                <span className="ml-1 font-normal normal-case text-indigo-500">→ pre-fills KB card</span>
                                            </label>
                                            <p className="mt-0.5 font-mono text-[10px] text-gray-400 dark:text-slate-500">
                                                {kbFilename}
                                            </p>
                                            <textarea
                                                readOnly
                                                value={kbText}
                                                rows={6}
                                                className="mt-1 block w-full rounded-md border-gray-200 bg-white text-xs text-gray-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                            />
                                        </div>
                                    )}

                                    {result.notes && (
                                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                                            {result.notes}
                                        </div>
                                    )}
                                </div>

                                {/* Apply button */}
                                <div className="mt-4 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={applyResult}
                                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Apply to form
                                    </button>
                                    {selectedImages.size > 0 && (
                                        <span className="text-xs text-gray-500">{selectedImages.size} image{selectedImages.size > 1 ? 's' : ''} will be inserted</span>
                                    )}
                                </div>
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
