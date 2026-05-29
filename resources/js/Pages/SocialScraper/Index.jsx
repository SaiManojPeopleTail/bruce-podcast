import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    ArrowLeft,
    Bot,
    CheckCircle2,
    ExternalLink,
    Image as ImageIcon,
    Loader2,
    Maximize2,
    Minimize2,
    Save,
    Sparkles,
    Trash2,
    Wand2,
    X,
    Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    detectPlatformFromUrl,
    fetchSavedScrape,
    mergeSavedIntoPosts,
    normalizePostFromScrape,
    platformLabel,
    saveScrape,
    toggleSavedPost,
} from '@/lib/socialScraperStorage';

/* ─────────────────────────────────────────────────────────────────────────
   Hosts that need the real-browser Agent mode
───────────────────────────────────────────────────────────────────────── */
const AGENT_HOSTS = new Set([
    'instagram.com', 'www.instagram.com',
    'linkedin.com', 'www.linkedin.com',
    'twitter.com', 'www.twitter.com',
    'x.com', 'www.x.com',
    'facebook.com', 'www.facebook.com',
    'tiktok.com', 'www.tiktok.com',
]);

function hostNeedsAgent(rawUrl) {
    try { return AGENT_HOSTS.has(new URL(rawUrl).hostname); }
    catch { return false; }
}

/* ─────────────────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────────────────── */
export default function SocialScraperPage() {
    const [url, setUrl]       = useState('');
    const [mode, setMode]     = useState('auto');
    const [groups, setGroups] = useState([]);
    const [running, setRunning] = useState(false);
    const [error, setError]   = useState(null);
    const abortRef   = useRef(null);
    const counterRef = useRef(0);

    const updateGroup = useCallback((id, updater) =>
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...updater(g) } : g))),
    []);

    const removeGroup = (id) => setGroups((prev) => prev.filter((g) => g.id !== id));

    const removePostFromGroup = useCallback((groupId, postIndex) => {
        setGroups((prev) =>
            prev.map((g) =>
                g.id === groupId
                    ? { ...g, posts: g.posts.filter((_, i) => i !== postIndex) }
                    : g,
            ),
        );
    }, []);

    const onSavedLoaded = useCallback((groupId, data) => {
        updateGroup(groupId, (g) => {
            const platform = data.platform ?? g.platform ?? detectPlatformFromUrl(g.url);
            const savedMeta = data.saved ? data.scrape : null;
            const posts = g.posts.length > 0
                ? mergeSavedIntoPosts(g.posts, data.posts ?? [])
                : (data.posts ?? []).map(normalizePostFromScrape);
            return { platform, savedMeta, posts };
        });
    }, [updateGroup]);

    const handleSaveGroup = useCallback(async (groupId) => {
        let group;
        setGroups((prev) => {
            group = prev.find((g) => g.id === groupId);
            return prev.map((g) =>
                g.id === groupId ? { ...g, saving: true, saveError: null, saveMessage: null } : g,
            );
        });
        if (!group?.url || group.posts.length === 0) return;

        try {
            const payload = await saveScrape({
                url: group.url,
                notes: group.parsed?.notes ?? null,
                posts: group.posts.map((p) => ({
                    type: p.type ?? 'image',
                    media_url: p.media_url,
                    description: p.description ?? '',
                    post_url: p.post_url,
                    posted_at: p.posted_at,
                    is_active: p.is_active !== false,
                })),
            });
            updateGroup(groupId, () => ({
                saving: false,
                savedMeta: payload.scrape,
                saveMessage: 'Saved to library.',
                posts: (payload.posts ?? []).map(normalizePostFromScrape),
            }));
        } catch (err) {
            updateGroup(groupId, () => ({
                saving: false,
                saveError: err.message ?? 'Save failed.',
            }));
        }
    }, [updateGroup]);

    const handleTogglePostActive = useCallback(async (groupId, postIndex, isActive) => {
        let post;
        setGroups((prev) => {
            const group = prev.find((g) => g.id === groupId);
            post = group?.posts[postIndex];
            return prev.map((g) =>
                g.id === groupId
                    ? {
                        ...g,
                        posts: g.posts.map((p, i) =>
                            i === postIndex ? { ...p, is_active: isActive } : p,
                        ),
                    }
                    : g,
            );
        });
        if (!post) return;

        if (!post.id) return;

        try {
            await toggleSavedPost(post.id, isActive);
            updateGroup(groupId, (g) => {
                const activeCount = g.posts.filter((p) => p.is_active !== false).length;
                return {
                    savedMeta: g.savedMeta
                        ? { ...g.savedMeta, active_count: activeCount }
                        : g.savedMeta,
                };
            });
        } catch (err) {
            updateGroup(groupId, (g) => ({
                posts: g.posts.map((p, i) => (i === postIndex ? { ...p, is_active: !isActive } : p)),
                saveError: err.message ?? 'Could not update post status.',
            }));
        }
    }, [updateGroup]);

    const effectiveMode = (rawUrl) =>
        mode === 'auto' ? (hostNeedsAgent(rawUrl) ? 'agent' : 'lite') : mode;

    const handleScrape = async () => {
        const trimmed = url.trim();
        if (!trimmed || running) return;
        let parsed;
        try { parsed = new URL(trimmed); }
        catch { setError('Please enter a valid URL (must include https://).'); return; }

        setError(null);
        const id  = ++counterRef.current;
        const em  = effectiveMode(trimmed);

        setGroups((prev) => [{
            id, index: id, url: trimmed, host: parsed.hostname.replace(/^www\./, ''),
            platform: detectPlatformFromUrl(trimmed),
            mode: em, status: 'starting', statusMessage: 'Starting…',
            thoughts: [], textBuffer: '', parsed: null, posts: [],
            errorMessage: null, startedAt: Date.now(), finishedAt: null,
            sessionId: null, cancelToken: null, liveWsUrl: null, eventsWsUrl: null,
            agentBaseUrl: null,
            savedMeta: null, saving: false, saveError: null, saveMessage: null,
        }, ...prev]);
        setRunning(true);
        setUrl('');

        if (em === 'agent') {
            await runAgentScrape(id, trimmed, updateGroup, setRunning);
        } else {
            const controller = new AbortController();
            abortRef.current = controller;
            await runLiteScrape(id, trimmed, controller, updateGroup, setRunning);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleScrape(); }
    };

    const activeGroup = groups.find((g) =>
        ['starting', 'connecting', 'streaming', 'running'].includes(g.status),
    );

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center gap-3">
                    <Link
                        href={route('product-qr-lists.index')}
                        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Rise Brands
                    </Link>
                    <span className="text-gray-300 dark:text-slate-600">/</span>
                    <h2 className="flex items-center gap-2 text-xl font-semibold leading-tight text-gray-800 dark:text-slate-200">
                        <Wand2 className="h-5 w-5 text-[#b59100]" />
                        Social Scraper
                    </h2>
                </div>
            }
        >
            <Head title="Social Scraper" />

            <div className="w-full py-6">
                {/* ── Sticky input bar ── */}
                <div className="sticky top-0 z-10 -mx-4 mb-6 bg-white/90 px-4 pb-4 pt-1 backdrop-blur-sm dark:bg-slate-900/90 sm:-mx-6 sm:px-6">
                    <div className="mx-auto max-w-5xl space-y-3">
                        {/* Mode toggle */}
                        <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium text-gray-600 dark:text-slate-400">Mode:</span>
                            {[
                                { key: 'auto',  label: 'Auto',            icon: <Sparkles className="h-3 w-3" /> },
                                { key: 'lite',  label: 'Lite (fast)',      icon: <Zap className="h-3 w-3" /> },
                                { key: 'agent', label: 'Agent (browser)',  icon: <Bot className="h-3 w-3" /> },
                            ].map(({ key, label, icon }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setMode(key)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium transition ${
                                        mode === key
                                            ? 'border-[#b59100] bg-[#b59100]/10 text-[#7a6300] dark:text-amber-300'
                                            : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    {icon}{label}
                                </button>
                            ))}
                            <span className="ml-auto text-[11px] text-gray-400 dark:text-slate-500">
                                Auto picks "Agent" for IG / LinkedIn
                            </span>
                        </div>

                        {/* URL input */}
                        <div className="flex gap-2">
                            <input
                                type="url"
                                inputMode="url"
                                autoComplete="off"
                                placeholder="https://www.instagram.com/yourbrand/  or  https://www.linkedin.com/company/yourbrand/"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={onKeyDown}
                                disabled={running}
                                className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-[#b59100] focus:ring-[#b59100] disabled:bg-gray-50 disabled:text-gray-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:disabled:bg-slate-800"
                            />
                            <button
                                type="button"
                                onClick={handleScrape}
                                disabled={running || !url.trim()}
                                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#b59100] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9a7c00] disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-slate-600"
                            >
                                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                {running ? 'Scraping…' : 'Scrape'}
                            </button>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p>{error}</p>
                            </div>
                        )}

                        {running && (
                            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                                <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                                </span>
                                Don't navigate away — Gemini is working on your scrape.
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Main content ── */}
                <div className="mx-auto max-w-5xl space-y-6">
                    {/* Live view + thinking side by side (agent) */}
                    {activeGroup &&
                        ((activeGroup.mode === 'agent' && activeGroup.liveWsUrl) ||
                            activeGroup.thoughts.length > 0) && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`grid min-w-0 gap-3 ${
                                activeGroup.mode === 'agent' && activeGroup.liveWsUrl
                                    ? 'grid-cols-2'
                                    : 'grid-cols-1'
                            }`}
                        >
                            {activeGroup.mode === 'agent' && activeGroup.liveWsUrl && (
                                <LiveView
                                    liveWsUrl={activeGroup.liveWsUrl}
                                    status={activeGroup.statusMessage}
                                    onCancel={() => cancelAgentSession(
                                        activeGroup.cancelToken,
                                        updateGroup,
                                        activeGroup.id,
                                    )}
                                />
                            )}
                            {(activeGroup.thoughts.length > 0 ||
                                (activeGroup.mode === 'agent' && activeGroup.liveWsUrl)) && (
                                <ThinkingLog
                                    thoughts={activeGroup.thoughts}
                                    status={activeGroup.statusMessage}
                                />
                            )}
                        </motion.div>
                    )}

                    {/* Scrape result groups */}
                    <AnimatePresence initial={false}>
                        {groups.map((g) => (
                            <ScrapeCard
                                key={g.id}
                                group={g}
                                onRemove={() => removeGroup(g.id)}
                                onRemovePost={(postIndex) => removePostFromGroup(g.id, postIndex)}
                                onSavedLoaded={onSavedLoaded}
                                onSave={() => handleSaveGroup(g.id)}
                                onTogglePostActive={(postIndex, isActive) =>
                                    handleTogglePostActive(g.id, postIndex, isActive)
                                }
                            />
                        ))}
                    </AnimatePresence>

                    {groups.length === 0 && !running && <EmptyState />}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   Live View
───────────────────────────────────────────────────────────────────────── */
function LiveView({ liveWsUrl, status, onCancel }) {
    const [frame, setFrame]           = useState(null);
    const [fullscreen, setFullscreen] = useState(false);
    const wsRef = useRef(null);

    useEffect(() => {
        if (!liveWsUrl) return;
        const ws = new WebSocket(liveWsUrl);
        wsRef.current = ws;
        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);
                if (msg.type === 'frame' && msg.data) setFrame(`data:image/jpeg;base64,${msg.data}`);
            } catch { /* ignore */ }
        };
        return () => { ws.close(); wsRef.current = null; };
    }, [liveWsUrl]);

    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-black shadow-lg dark:border-slate-700 ${
                fullscreen ? 'fixed inset-4 z-50' : 'relative'
            }`}
        >
            <div className="flex items-center justify-between border-b border-white/10 bg-gray-900 px-3 py-2">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-xs font-medium text-gray-300">Live browser view</span>
                    <span className="max-w-sm truncate text-[11px] text-gray-500">— {status}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setFullscreen((f) => !f)}
                        className="rounded p-1 text-gray-400 hover:text-gray-200"
                        title={fullscreen ? 'Restore' : 'Fullscreen'}
                    >
                        {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </button>
                    <button type="button" onClick={onCancel}
                        className="inline-flex items-center gap-1 rounded border border-red-800/50 bg-red-900/40 px-2 py-0.5 text-[11px] font-medium text-red-300 hover:bg-red-900/70"
                    >
                        <X className="h-3 w-3" /> Cancel
                    </button>
                </div>
            </div>
            <div className={`relative flex min-h-0 items-center justify-center bg-gray-950 ${
                fullscreen ? 'h-[calc(100%-2.5rem)]' : 'h-36'
            }`}>
                {frame
                    ? <img src={frame} alt="Live browser" className="h-full w-full object-contain" />
                    : <div className="flex flex-col items-center gap-2 text-gray-600">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-xs">Connecting to browser…</span>
                      </div>
                }
            </div>
        </motion.div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   Thinking Log
───────────────────────────────────────────────────────────────────────── */
function ThinkingLog({ thoughts, status }) {
    const ref = useRef(null);
    useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [thoughts]);
    const joined = useMemo(() => thoughts.join('\n\n').trim(), [thoughts]);

    return (
        <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800"
        >
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-500 dark:border-slate-700 dark:text-slate-400">
                <span className="flex shrink-0 items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#b59100]" />
                    Thinking
                </span>
                <span className="min-w-0 truncate text-[11px] text-gray-400 dark:text-slate-500">{status}</span>
            </div>
            <div
                ref={ref}
                className="h-36 min-w-0 overflow-x-hidden overflow-y-auto break-words px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap text-gray-600 [overflow-wrap:anywhere] dark:text-slate-300"
            >
                {joined || <span className="italic text-gray-400 dark:text-slate-500">Waiting for first thought from Gemini…</span>}
            </div>
        </motion.div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   Scrape Card
───────────────────────────────────────────────────────────────────────── */
function PlatformBadge({ platform }) {
    const label = platformLabel(platform);
    const cls =
        platform === 'instagram'
            ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white'
            : platform === 'linkedin'
                ? 'bg-[#0A66C2] text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-slate-600 dark:text-slate-200';

    return (
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
            {label}
        </span>
    );
}

function ScrapeCard({ group, onRemove, onRemovePost, onSavedLoaded, onSave, onTogglePostActive }) {
    const isRunning = ['starting', 'connecting', 'streaming', 'running'].includes(group.status);
    const isError   = group.status === 'error';
    const isDone    = group.status === 'done';
    const isAborted = group.status === 'aborted' || group.status === 'cancelled';

    useEffect(() => {
        if ((!isDone && !isAborted) || !group.url || !onSavedLoaded) return;
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchSavedScrape(group.url);
                if (!cancelled) onSavedLoaded(group.id, data);
            } catch {
                // non-fatal
            }
        })();
        return () => { cancelled = true; };
    }, [isDone, isAborted, group.url, group.id, onSavedLoaded]);

    return (
        <motion.section
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
            {/* Card header */}
            <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-slate-700">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-full bg-[#b59100]/10 px-3 py-0.5 text-xs font-semibold text-[#b59100]">
                        Scrape {group.index}
                    </span>
                    <PlatformBadge platform={group.platform ?? detectPlatformFromUrl(group.url)} />
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        group.mode === 'agent'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                        {group.mode === 'agent' ? <><Bot className="h-3 w-3" /> Agent</> : <><Zap className="h-3 w-3" /> Lite</>}
                    </span>
                    <a href={group.url} target="_blank" rel="noopener noreferrer"
                        className="max-w-md truncate text-sm font-medium text-gray-700 hover:text-[#b59100] dark:text-slate-200"
                        title={group.url}
                    >
                        {group.url}
                    </a>
                    <StatusBadge status={group.status} count={group.posts?.length ?? 0} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {(isDone || isAborted) && group.posts.length > 0 && (
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={group.saving}
                            className="inline-flex items-center gap-1.5 rounded-md bg-[#b59100] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#9a7c00] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {group.saving
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Save className="h-3.5 w-3.5" />}
                            {group.saving ? 'Saving…' : 'Save'}
                        </button>
                    )}
                    <button type="button" onClick={onRemove}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-red-900/50 dark:hover:bg-red-900/20 dark:hover:text-red-300"
                    >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                </div>
            </header>

            <div className="px-5 py-4">
                {group.saveMessage && (
                    <p className="mb-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">{group.saveMessage}</p>
                )}
                {group.saveError && (
                    <p className="mb-3 text-xs text-red-600 dark:text-red-300">{group.saveError}</p>
                )}
                {group.savedMeta && (
                    <div className="mb-4 rounded-md border border-sky-200 bg-sky-50/80 px-4 py-2.5 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-100">
                        <span className="font-semibold">Previously saved</span>
                        {' · '}
                        {platformLabel(group.savedMeta.platform)}
                        {' · '}
                        {group.savedMeta.posts_count} post{group.savedMeta.posts_count === 1 ? '' : 's'}
                        {' ('}
                        {group.savedMeta.active_count} active)
                        {group.savedMeta.saved_at && (
                            <>
                                {' · '}
                                {formatDate(group.savedMeta.saved_at)}
                            </>
                        )}
                    </div>
                )}
                {isError && (
                    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                            <p className="font-medium">Scrape failed</p>
                            {group.errorMessage && <p className="mt-0.5 break-words text-xs">{group.errorMessage}</p>}
                        </div>
                    </div>
                )}

                {isAborted && (
                    <p className={`text-sm italic text-gray-500 dark:text-slate-400 ${group.posts.length > 0 ? 'mb-4' : ''}`}>
                        Cancelled — {group.posts.length > 0 ? `${group.posts.length} post(s) collected.` : 'No posts collected.'}
                    </p>
                )}

                {!isError && (
                    <>
                        {group.parsed?.notes && (
                            <div className="mb-4 rounded-md border border-amber-100 bg-amber-50/60 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                                <span className="font-semibold">Notes: </span>{group.parsed.notes}
                            </div>
                        )}

                        {group.posts.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {group.posts.map((p, i) => (
                                    <PostCard
                                        key={p.id ?? p.post_url ?? `post-${group.id}-${i}`}
                                        post={p}
                                        agentBaseUrl={group.agentBaseUrl}
                                        showActiveToggle={isDone || isAborted}
                                        onRemove={() => onRemovePost(i)}
                                        onToggleActive={(active) => onTogglePostActive?.(i, active)}
                                    />
                                ))}
                            </div>
                        ) : isDone ? (
                            <p className="text-sm italic text-gray-500 dark:text-slate-400">No posts could be extracted from this URL.</p>
                        ) : isRunning ? (
                            <p className="text-sm italic text-gray-500 dark:text-slate-400">Working…</p>
                        ) : null}
                    </>
                )}
            </div>
        </motion.section>
    );
}

function StatusBadge({ status, count }) {
    const map = {
        starting:   { label: 'Starting…',   cls: 'bg-gray-100 text-gray-600' },
        connecting: { label: 'Connecting…', cls: 'bg-gray-100 text-gray-600' },
        streaming:  { label: 'Streaming…',  cls: 'bg-amber-100 text-amber-700' },
        running:    { label: 'Running…',    cls: 'bg-amber-100 text-amber-700' },
        done:       { label: `${count} post${count === 1 ? '' : 's'}`, cls: 'bg-emerald-100 text-emerald-700' },
        aborted:    { label: 'Cancelled',   cls: 'bg-gray-200 text-gray-600' },
        cancelled:  { label: 'Cancelled',   cls: 'bg-gray-200 text-gray-600' },
        error:      { label: 'Error',       cls: 'bg-red-100 text-red-700' },
    };
    const v = map[status] ?? map.starting;
    return (
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${v.cls}`}>
            {status === 'done' && <CheckCircle2 className="mr-1 h-3 w-3" />}
            {v.label}
        </span>
    );
}

function PostCard({ post, agentBaseUrl, onRemove, showActiveToggle, onToggleActive }) {
    const isActive = post.is_active !== false;
    const rawMedia = post.media_url ?? null;
    // Resolve /captures/ paths to the sidecar's base URL
    const media = rawMedia && rawMedia.startsWith('/captures/')
        ? `${agentBaseUrl ?? 'http://127.0.0.1:7501'}${rawMedia}`
        : rawMedia;

    return (
        <article className={`relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-900/40 ${!isActive ? 'opacity-60' : ''}`}>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-gray-200/80 bg-white/95 px-2 py-1 text-[10px] font-medium text-gray-600 shadow-sm backdrop-blur-sm hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-red-900/50 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                    aria-label="Remove post"
                >
                    <Trash2 className="h-3 w-3" />
                    Remove
                </button>
            )}
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-gray-100 dark:bg-slate-800">
                {media ? (
                    <img src={media} alt={post.description?.slice(0, 80) ?? 'Post thumbnail'}
                        className="h-full w-full object-cover" loading="lazy"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400 dark:text-slate-500">
                        <ImageIcon className="h-7 w-7" />
                        <span className="text-[11px] uppercase tracking-wide">No thumbnail</span>
                    </div>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
                {showActiveToggle && (
                    <label className="flex items-center justify-between gap-2 border-b border-gray-200/80 pb-2 dark:border-slate-700">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                            {isActive ? 'Active' : 'Inactive'}
                        </span>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isActive}
                            onClick={() => onToggleActive?.(!isActive)}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                                isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                                    isActive ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                            />
                        </button>
                    </label>
                )}
                {post.description && (
                    <p className="line-clamp-5 whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-slate-300">
                        {post.description}
                    </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11px] text-gray-500 dark:text-slate-400">
                    <span>{formatDate(post.posted_at)}</span>
                    {post.post_url && (
                        <a href={post.post_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-[#b59100] hover:underline"
                        >
                            Open <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
            </div>
        </article>
    );
}

function EmptyState() {
    return (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <Wand2 className="mx-auto h-8 w-8 text-[#b59100]" />
            <p className="mt-3 text-sm font-medium text-gray-700 dark:text-slate-200">
                Drop in a social URL above to get started.
            </p>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400">
                Auto mode picks Agent for Instagram, LinkedIn, etc., and Lite for everything else.<br />
                Each scrape stacks below so you can compare multiple sources before saving.
            </p>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   Lite scrape (SSE)
───────────────────────────────────────────────────────────────────────── */
async function runLiteScrape(id, trimmed, controller, updateGroup, setRunning) {
    try {
        const res = await fetch(route('social-scrape.run'), {
            method: 'POST', credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
                Accept: 'text/event-stream',
            },
            body: JSON.stringify({ url: trimmed }),
            signal: controller.signal,
        });

        if (!res.ok || !res.body) {
            throw new Error((await safeReadText(res)) || `Request failed (HTTP ${res.status})`);
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer    = '';

        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let sep;
            while ((sep = buffer.indexOf('\n\n')) !== -1) {
                const block = buffer.slice(0, sep);
                buffer = buffer.slice(sep + 2);
                const evt = parseSseBlock(block);
                if (evt) updateGroup(id, (g) => applyLiteEvent(g, evt.event, evt.data));
            }
        }

        updateGroup(id, (g) => {
            if (g.parsed || !g.textBuffer) return { finishedAt: Date.now() };
            const parsed = extractJson(g.textBuffer);
            return {
                parsed, posts: parsed?.posts ?? [],
                status: g.status === 'error' ? g.status : 'done',
                statusMessage: parsed ? 'Scrape complete.' : 'Finished, no structured posts found.',
                finishedAt: Date.now(),
            };
        });
    } catch (err) {
        if (err.name === 'AbortError') {
            updateGroup(id, () => ({ status: 'aborted', statusMessage: 'Cancelled.', finishedAt: Date.now() }));
        } else {
            updateGroup(id, () => ({ status: 'error', statusMessage: 'Scrape failed.', errorMessage: err.message, finishedAt: Date.now() }));
        }
    } finally {
        setRunning(false);
    }
}

/* ─────────────────────────────────────────────────────────────────────────
   Agent scrape (WebSocket)
───────────────────────────────────────────────────────────────────────── */
async function runAgentScrape(id, trimmed, updateGroup, setRunning) {
    try {
        const res = await fetch(route('social-scrape.agent'), {
            method: 'POST', credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
            },
            body: JSON.stringify({ url: trimmed }),
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `Agent start failed (HTTP ${res.status})`);
        }

        const session = await res.json();
        updateGroup(id, () => ({
            status: 'running',
            statusMessage: 'Browser launching…',
            sessionId: session.sessionId,
            cancelToken: session.cancelToken,
            liveWsUrl: session.liveWsUrl,
            eventsWsUrl: session.eventsWsUrl,
            agentBaseUrl: session.agentBaseUrl ?? null,
        }));

        await new Promise((resolve, reject) => {
            const eventsWs = new WebSocket(session.eventsWsUrl);
            eventsWs.onopen    = () => resolve();
            eventsWs.onerror   = () => reject(new Error('Events WS connection failed'));
            eventsWs.onmessage = (evt) => {
                try {
                    const msg = JSON.parse(evt.data);
                    updateGroup(id, (g) => applyAgentEvent(g, msg.type, msg.data ?? {}));
                    if (msg.type === 'done' || msg.type === 'error' || msg.type === 'cancelled') {
                        setRunning(false);
                        eventsWs.close();
                    }
                } catch { /* ignore */ }
            };
            eventsWs.onclose = (e) => {
                updateGroup(id, (g) => {
                    if (['done', 'error', 'cancelled'].includes(g.status)) return {};
                    if (g.posts.length > 0) {
                        return { status: 'done', statusMessage: `Connection closed — ${g.posts.length} post(s) collected.`, finishedAt: Date.now() };
                    }
                    if (e.code !== 1000 && e.code !== 1001) {
                        return { status: 'error', statusMessage: 'Connection closed unexpectedly.', errorMessage: `WS closed (code ${e.code})`, finishedAt: Date.now() };
                    }
                    return { status: 'done', statusMessage: 'Complete.', finishedAt: Date.now() };
                });
                setRunning(false);
            };
        });
    } catch (err) {
        updateGroup(id, () => ({ status: 'error', statusMessage: 'Agent failed to start.', errorMessage: err.message, finishedAt: Date.now() }));
        setRunning(false);
    }
}

async function cancelAgentSession(cancelToken, updateGroup, groupId) {
    if (!cancelToken) return;
    try {
        await fetch(route('social-scrape.agent.cancel'), {
            method: 'POST', credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content ?? '',
            },
            body: JSON.stringify({ cancelToken }),
        });
    } catch { /* best-effort */ }
    updateGroup(groupId, () => ({ status: 'cancelled', statusMessage: 'Cancelled.', finishedAt: Date.now() }));
}

/* ─────────────────────────────────────────────────────────────────────────
   Event appliers
───────────────────────────────────────────────────────────────────────── */
function applyLiteEvent(group, event, data) {
    switch (event) {
        case 'open':    return { status: 'connecting', statusMessage: 'Connected. Waiting for Gemini…' };
        case 'status':  return { status: data.stage === 'streaming' ? 'streaming' : group.status, statusMessage: data.message ?? group.statusMessage };
        case 'thought': return { status: 'streaming', thoughts: [...group.thoughts, data.text], statusMessage: 'Thinking…' };
        case 'text':    return { status: 'streaming', textBuffer: group.textBuffer + data.text, statusMessage: 'Writing result…' };
        case 'urlMeta': return { urlsFetched: Array.isArray(data.urls) ? data.urls : group.urlsFetched };
        case 'finish':
        case 'done': {
            if (event === 'done' && (group.status === 'done' || group.status === 'error')) return {};
            const parsed = extractJson(group.textBuffer);
            const posts = (parsed?.posts ?? []).map(normalizePostFromScrape);
            return {
                status: 'done',
                statusMessage: parsed ? 'Scrape complete.' : 'Finished, no structured posts.',
                parsed,
                posts,
                platform: group.platform ?? detectPlatformFromUrl(group.url),
                finishedAt: Date.now(),
            };
        }
        case 'error':   return { status: 'error', statusMessage: 'Scrape failed.', errorMessage: data.message + (data.detail ? `\n${data.detail}` : ''), finishedAt: Date.now() };
        default:        return {};
    }
}

function workerTag(data) {
    return data.workerIndex != null ? `[W${data.workerIndex + 1}] ` : '';
}

function mergeAgentPosts(existing, incoming) {
    const finalPosts = [...existing];
    if (!Array.isArray(incoming)) return finalPosts;
    for (const p of incoming) {
        if (!finalPosts.some((e) => e.post_url && e.post_url === p.post_url)) {
            finalPosts.push(p);
        }
    }
    return finalPosts;
}

function applyAgentEvent(group, type, data) {
    const tag = workerTag(data);
    switch (type) {
        case 'connected':   return { statusMessage: tag + 'Browser connected.' };
        case 'status':      return { statusMessage: tag + (data.message ?? group.statusMessage) };
        case 'thought':     return { thoughts: [...group.thoughts, (tag ? tag : '') + data.text], statusMessage: tag + 'Thinking…' };
        case 'text':        return { textBuffer: group.textBuffer + data.text };
        case 'action':      return { statusMessage: tag + `${data.name}(${JSON.stringify(data.args ?? {}).slice(0, 80)})` };
        case 'post': {
            const post = data.post;
            if (!post) return {};
            return {
                status: 'running',
                posts: [...group.posts, normalizePostFromScrape(post)],
                statusMessage: tag + `Collected post ${group.posts.length + 1}…`,
            };
        }
        case 'done': {
            const result = data.result;
            const finalPosts = mergeAgentPosts(group.posts, result?.posts).map(normalizePostFromScrape);
            return {
                status: 'done',
                statusMessage: finalPosts.length > 0 ? `Scrape complete — ${finalPosts.length} post(s).` : 'Scrape complete.',
                parsed: result ?? null,
                posts: finalPosts,
                platform: group.platform ?? detectPlatformFromUrl(group.url),
                finishedAt: Date.now(),
            };
        }
        case 'cancelled':
            return {
                status: 'cancelled',
                statusMessage: group.posts.length > 0
                    ? `Cancelled — ${group.posts.length} post(s) collected.`
                    : 'Cancelled.',
                finishedAt: Date.now(),
            };
        case 'error': {
            const msg = String(data.message ?? 'Unknown error');
            if (msg === 'cancelled') {
                return {
                    status: 'cancelled',
                    statusMessage: group.posts.length > 0
                        ? `Cancelled — ${group.posts.length} post(s) collected.`
                        : 'Cancelled.',
                    finishedAt: Date.now(),
                };
            }
            return { status: 'error', statusMessage: tag + 'Agent error.', errorMessage: msg, finishedAt: Date.now() };
        }
        default:            return {};
    }
}

/* ─────────────────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────────────────── */
function parseSseBlock(block) {
    let event = 'message', dataStr = '';
    for (const raw of block.split('\n')) {
        const line = raw.replace(/\r$/, '');
        if (line.startsWith('event: '))      event   = line.slice(7).trim();
        else if (line.startsWith('event:'))  event   = line.slice(6).trim();
        else if (line.startsWith('data: '))  dataStr += line.slice(6);
        else if (line.startsWith('data:'))   dataStr += line.slice(5);
    }
    if (!dataStr.trim()) return null;
    try { return { event, data: JSON.parse(dataStr) }; } catch { return null; }
}

function extractJson(text) {
    if (!text) return null;
    const fence = text.match(/```json\s*([\s\S]*?)\s*```/i);
    let candidate = fence ? fence[1] : null;
    if (!candidate) {
        const first = text.indexOf('{'), last = text.lastIndexOf('}');
        if (first !== -1 && last > first) candidate = text.slice(first, last + 1);
    }
    if (!candidate) return null;
    try { return JSON.parse(candidate); } catch { return null; }
}

function formatDate(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
}

async function safeReadText(res) {
    try { return (await res.text())?.slice(0, 400); } catch { return ''; }
}
