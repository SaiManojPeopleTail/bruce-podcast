import Modal from '@/Components/Modal';
import { Loader2, ShoppingBag, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function csrfToken() {
    return document.querySelector('meta[name="csrf-token"]')?.content ?? '';
}

export default function KbGeneratorModal({ show, onClose, onApply }) {
    const [url, setUrl]                   = useState('');
    const [running, setRunning]           = useState(false);
    const [thoughts, setThoughts]         = useState([]);
    const [result, setResult]             = useState(null);
    const [error, setError]               = useState(null);
    const [shopifyStatus, setShopifyStatus] = useState(null); // null | 'checking' | 'found' | 'not_found'
    const thoughtsRef                     = useRef(null);
    const abortRef                        = useRef(null);

    // Auto-scroll thinking block
    useEffect(() => {
        if (thoughtsRef.current) {
            thoughtsRef.current.scrollTop = thoughtsRef.current.scrollHeight;
        }
    }, [thoughts]);

    const reset = () => {
        setThoughts([]);
        setResult(null);
        setError(null);
    };

    const detectShopify = async (rawUrl) => {
        if (!rawUrl?.trim()) return;
        if (shopifyStatus === 'checking' || shopifyStatus === 'found') return;
        setShopifyStatus('checking');
        try {
            const { protocol, hostname } = new URL(rawUrl.trim());
            const res = await fetch(`${protocol}//${hostname}/products.json?limit=1`);
            if (!res.ok) { setShopifyStatus('not_found'); return; }
            const data = await res.json();
            setShopifyStatus(Array.isArray(data?.products) && data.products.length > 0 ? 'found' : 'not_found');
        } catch {
            setShopifyStatus('not_found');
        }
    };

    const handleClose = () => {
        if (running) {
            abortRef.current?.abort();
            setRunning(false);
        }
        onClose();
    };

    const runGeneration = async () => {
        if (running || !url.trim()) return;
        reset();
        setRunning(true);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch('/admin/product-qr-lists/generate-kb', {
                method: 'POST',
                signal: controller.signal,
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                    Accept: 'text/event-stream',
                },
                body: JSON.stringify({ company_url: url.trim() }),
            });

            if (!res.ok) {
                setError('Request failed. Please try again.');
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let currentEvent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const raw of lines) {
                    const line = raw.trimEnd();
                    if (!line) { currentEvent = ''; continue; }

                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                        continue;
                    }
                    if (!line.startsWith('data: ')) continue;

                    const json = line.slice(6);
                    if (json === '[DONE]') break;
                    try {
                        const data = JSON.parse(json);
                        if (currentEvent === 'thought' && data.text) {
                            setThoughts((p) => [...p, data.text]);
                        } else if (currentEvent === 'result' && data.kb_text) {
                            setResult(data.kb_text);
                        } else if (currentEvent === 'error') {
                            setError(data.message ?? 'An error occurred.');
                        }
                    } catch { /* ignore parse errors */ }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') setError(err.message ?? 'Unexpected error.');
        } finally {
            setRunning(false);
        }
    };

    const handleApply = () => {
        if (result) {
            onApply(result);
            onClose();
        }
    };

    return (
        <Modal show={show} onClose={handleClose} maxWidth="2xl">
            <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#b59100]" />
                        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                            Generate Knowledge Base
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <p className="text-xs text-gray-500 dark:text-slate-400">
                    Enter the company website URL. GPT will browse the site and Shopify catalogue (if available) to generate a detailed knowledge base.
                </p>

                {/* URL input */}
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-200">
                        Company website URL
                    </label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); setShopifyStatus(null); }}
                        onBlur={(e) => detectShopify(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && runGeneration()}
                        placeholder="https://company.com"
                        disabled={running}
                        className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-[#b59100] focus:ring-[#b59100] disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                    {shopifyStatus === 'checking' && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Checking for Shopify catalogue…
                        </p>
                    )}
                    {shopifyStatus === 'found' && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <ShoppingBag className="h-3 w-3" />
                            Shopify store detected — product catalogue will be included
                        </p>
                    )}
                    {shopifyStatus === 'not_found' && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
                            Not a Shopify store — GPT will use web search only
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={runGeneration}
                    disabled={running || !url.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#b59100] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#9a7c00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {running ? 'Generating…' : 'Generate'}
                </button>

                {/* Thinking block */}
                {(running || thoughts.length > 0) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                            {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Thinking
                        </h4>
                        <pre
                            ref={thoughtsRef}
                            className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-amber-800 dark:text-amber-100"
                        >
                            {thoughts.join('\n') || 'Starting…'}
                        </pre>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                        {error}
                    </div>
                )}

                {/* Result preview */}
                {result && (
                    <div className="space-y-3">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                                Generated KB — {result.length} chars
                            </label>
                            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-slate-300">
                                {result}
                            </pre>
                        </div>
                        <button
                            type="button"
                            onClick={handleApply}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                            Use this KB
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
}
