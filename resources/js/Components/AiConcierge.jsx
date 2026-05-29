import { useConversation } from '@11labs/react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, ChevronLeft, ClipboardList, Loader2, MessageSquare, Mic, MicOff, Phone, PhoneOff, Send, Sparkles, X } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const AGENT_NAME = 'Hannah';
const AGENT_IMAGE = '/images/hannah-agent.png';

/** Agent TTS output = bronze · User mic input = honey-gold (same family, clearly distinct) */
const VOICE_PALETTE = {
    agent: { ring: '#b59100', glow: 'rgba(181,145,0,0.55)' },
    user: { ring: '#c9a227', glow: 'rgba(255,222,89,0.7)' },
    idle: { ring: '#b59100', glow: 'rgba(181,145,0,0.14)' },
};

async function fetchSignedUrl() {
    const res = await fetch(route('ai-concierge.signed-url'), {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to start AI session.');
    }
    const { signed_url } = await res.json();
    return signed_url;
}

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Build the session overrides object for startSession.
 * If the product has a RAG-indexed knowledge base, inject it per-conversation via
 * the knowledge_base override (requires the agent to have this override field enabled
 * — handled by AiConciergeController::ensureClientTools).
 */
function buildSessionOverrides(systemPrompt, product, textOnly) {
    const kbId     = product.elevenlabs_kb_id ?? null;
    const kbReady  = product.kb_rag_status === 'succeeded';

    const promptOverride = {
        prompt: systemPrompt,
        ...(kbId && kbReady ? {
            knowledge_base: [{
                type: product.kb_type ?? 'file',
                name: (product.product_name ?? 'Product') + ' Knowledge Base',
                id:   kbId,
                usage_mode: 'auto',
            }],
        } : {}),
    };

    const firstMessage = product.first_message?.trim()
        || `Hello! I'm Hannah. What question do you have about ${product.product_name} ?`;

    return {
        agent: {
            prompt:       promptOverride,
            firstMessage,
        },
        ...(product.voice_id?.trim() ? { tts: { voiceId: product.voice_id.trim() } } : {}),
        ...(textOnly ? { conversation: { textOnly: true } } : {}),
    };
}

function digitsUsNational(value) {
    let s = String(value ?? '').trim();
    if (s.startsWith('+1')) s = s.slice(2).trimStart();
    let d = s.replace(/\D/g, '');
    if (d.length >= 11 && d.startsWith('1')) d = d.slice(1);
    return d.slice(0, 10);
}

function formatNationalForDisplay(digits) {
    const d = digitsUsNational(digits);
    if (!d) return '';
    if (d.length <= 3) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function buildRetailersBlock(retailers, textMode) {
    if (!Array.isArray(retailers) || retailers.length === 0) return [];

    const lines = [
        ``,
        `Where to buy / availability:`,
    ];

    retailers.forEach((r) => {
        if (!r?.name) return;
        const actions = Array.isArray(r.actions) ? r.actions : [];
        if (actions.length === 0) {
            lines.push(`- ${r.name}`);
            return;
        }
        actions.forEach((a) => {
            const type  = a.type ?? '';
            const value = a.value ?? '';
            if (!value) return;
            if (textMode) {
                // Markdown-linked version for text chat
                if (type === 'link') {
                    const href = value.startsWith('http') ? value : `https://${value}`;
                    lines.push(`- **${r.name}** — [Visit website](${href})`);
                } else if (type === 'email') {
                    lines.push(`- **${r.name}** — [${value}](mailto:${value})`);
                } else if (type === 'phone') {
                    const digits = value.replace(/\D/g, '');
                    lines.push(`- **${r.name}** — [${value}](tel:+${digits})`);
                } else {
                    lines.push(`- **${r.name}** — ${value}`);
                }
            } else {
                // Plain text version for voice
                if (type === 'link')  lines.push(`- ${r.name}: ${value}`);
                else if (type === 'email') lines.push(`- ${r.name} (email): ${value}`);
                else if (type === 'phone') lines.push(`- ${r.name} (phone): ${value}`);
                else lines.push(`- ${r.name}: ${value}`);
            }
        });
    });

    lines.push(``);
    lines.push(`When a visitor asks where they can purchase or find this product, refer to the list above. Always mention relevant retailers by name and provide their contact/link.`);

    return lines;
}

function buildSystemPrompt(product, textMode = false) {
    const description = stripHtml(product.product_description);

    const formattingBlock = textMode ? [
        `## RESPONSE FORMAT — THIS IS A TEXT CHAT, NOT VOICE. YOU MUST FOLLOW THESE RULES IN EVERY REPLY:`,
        ``,
        `1. **Bold** any key terms, product names, figures, contact details, or anything worth emphasising — wrap them in **double asterisks**.`,
        `2. Never write one long unbroken paragraph. Break your reply into short paragraphs separated by a blank line.`,
        `3. Use a bullet list (- item) whenever you are listing features, steps, or options.`,
        `4. Format every email, phone number, and URL as a Markdown link:`,
        `   - Email → [sales@brand.com](mailto:sales@brand.com)`,
        `   - Phone → [+1 888 669 8999](tel:+18886698999)`,
        `   - Website → [provita-nutrition.ca](https://provita-nutrition.ca)`,
        `5. Your replies should look like a well-formatted ChatGPT or Claude response — clear headings if needed, bold highlights, clean spacing.`,
        ``,
        `Example of correct formatting:`,
        `**Provita Nutrition** products are available through the **official website** and trusted **wholesale partners** across Canada and internationally.`,
        ``,
        `For inquiries, contact the sales team:`,
        `- **Email:** [sales@provita-nutrition.ca](mailto:sales@provita-nutrition.ca)`,
        `- **Phone:** [+1 888 669 8999](tel:+18886698999)`,
        ``,
        `---`,
        ``,
    ] : [
        `## VOICE MODE — RESPONSE LENGTH RULES. YOU MUST FOLLOW THESE IN EVERY REPLY:`,
        ``,
        `1. Keep every response to 1-3 short spoken sentences maximum. Never more.`,
        `2. Never use lists, bullet points, markdown, headers, or special characters — they sound terrible when spoken aloud.`,
        `3. Speak naturally and conversationally — like a knowledgeable friend, not a brochure.`,
        `4. If the user needs a lot of information, break it into a short answer and then ask a follow-up question to continue the conversation.`,
        `5. Never read out URLs, email addresses, or phone numbers unless the user explicitly asks for them.`,
        ``,
        `---`,
        ``,
    ];

    const retailersBlock = buildRetailersBlock(product.retailers, textMode);

    return [
        ...formattingBlock,
        `You are helpful educational assistant, a knowledgeable and warm AI assistant. You dont work for a company, so dont mention that you work for a company or do not talk in first person. Always talk in third person about the company and products. Brand Name: ${product.product_name}.`,
        description ? ` About the brand: ${description}` : null,
        ...retailersBlock,
        ``,
        `Your role is to:`,
        `- Answer questions about the brand, its products, their features, benefits, and suitability`,
        `- Help visitors understand pricing, availability, and wholesale / retail opportunities`,
        `- Collect the visitor's details and submit a formal enquiry on their behalf`,
        `- Be concise, professional, and friendly — never pushy`,
        ``,
        `Use the knowledge base to answer detailed questions about specific products, ingredients, or company information.`,
        ``,
        `You have access to three tools to handle enquiries:`,
        `1. invoke_form — Show the enquiry form. Call this as soon as the user expresses interest in ordering or enquiring.`,
        `2. fill_form — Pre-fill the form fields as you learn the user's details through conversation. Fields: name, store_name, phone, email, message (optional).`,
        `3. submit_form — Submit the completed form. Always confirm with the user before calling this.`,
        ``,
        `Workflow: invoke_form → collect details via conversation and fill_form as you learn each piece → confirm all details → submit_form.`,
        `Always collect name, store_name, phone, and email before submitting. Message is optional.`,
        `If you are unsure of specific pricing or stock details, invite the visitor to submit a formal enquiry.`,
        `Always stay on topic about the brand and its products.`,
    ]
        .filter((l) => l !== null)
        .join('\n');
}

function ConnectingSpinner({ label = 'Connecting…', size = 'sm' }) {
    const icon = size === 'xs' ? 'h-3 w-3' : 'h-4 w-4';
    const text = size === 'xs' ? 'text-xs' : 'text-sm';
    return (
        <span className={`flex items-center gap-1.5 font-medium text-[#b59100] ${text}`}>
            <Loader2 className={`${icon} shrink-0 animate-spin`} aria-hidden />
            {label}
        </span>
    );
}

function HannahVoiceAvatar({ audioMode, audioLevel, status, compact = false }) {
    const active = status === 'connected';
    const palette = VOICE_PALETTE[audioMode] ?? VOICE_PALETTE.idle;
    const level = active ? audioLevel : 0;

    const imgSize = compact ? 'h-16 w-16' : 'h-36 w-36';
    const isUser = audioMode === 'user';
    const glowLo = compact
        ? (isUser ? 10 : 6)
        : (isUser ? 20 : 14);
    const glowHi = compact
        ? (isUser ? 16 + level * 22 : 14 + level * 12)
        : (isUser ? 34 + level * 40 : 28 + level * 28);
    const pulseDuration = audioMode === 'agent' ? 0.42 : audioMode === 'user' ? 0.55 : 1.1;

    return (
        <div className={`relative flex shrink-0 items-center justify-center ${compact ? 'p-0.5' : 'p-1'}`}>
            <motion.div
                key={audioMode}
                className={`relative overflow-hidden rounded-full border-2 ${imgSize}`}
                style={{ borderColor: palette.ring }}
                animate={
                    active && audioMode !== 'idle'
                        ? {
                              boxShadow: [
                                  `0 0 ${glowLo}px ${palette.glow}`,
                                  `0 0 ${glowHi}px ${palette.glow}`,
                                  `0 0 ${glowLo}px ${palette.glow}`,
                              ],
                          }
                        : active
                        ? { boxShadow: `0 0 ${glowLo}px ${palette.glow}` }
                        : { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
                }
                transition={
                    active && audioMode !== 'idle'
                        ? { duration: pulseDuration, repeat: Infinity, ease: 'easeInOut' }
                        : { duration: 0.2 }
                }
            >
                <img
                    src={AGENT_IMAGE}
                    alt={`${AGENT_NAME}, your AI concierge`}
                    className="h-full w-full object-cover scale-[1.12]"
                />
            </motion.div>
        </div>
    );
}

const agentMarkdownComponents = {
    p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    ul:     ({ children }) => <ul className="mb-2 list-disc pl-4 space-y-0.5">{children}</ul>,
    ol:     ({ children }) => <ol className="mb-2 list-decimal pl-4 space-y-0.5">{children}</ol>,
    li:     ({ children }) => <li className="leading-snug">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em:     ({ children }) => <em className="italic">{children}</em>,
    code:   ({ inline, children }) => inline
        ? <code className="rounded bg-gray-200/70 px-1 py-0.5 font-mono text-xs text-gray-700">{children}</code>
        : <pre className="mt-1 overflow-x-auto rounded-lg bg-gray-200/70 p-2 font-mono text-xs text-gray-700 whitespace-pre-wrap"><code>{children}</code></pre>,
    blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-300 pl-3 text-gray-500 italic">{children}</blockquote>,
    h1: ({ children }) => <p className="mb-1 font-bold text-base">{children}</p>,
    h2: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
    h3: ({ children }) => <p className="mb-1 font-semibold text-sm">{children}</p>,
    a:  ({ href, children }) => {
        const isExternal = href && !href.startsWith('mailto:') && !href.startsWith('tel:');
        return (
            <a
                href={href}
                {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="font-medium underline underline-offset-2 hover:opacity-75"
            >
                {children}
            </a>
        );
    },
    hr: () => <hr className="my-1.5 border-gray-300" />,
};

function ChatBubble({ role, text, streaming = false }) {
    const isUser = role === 'user';
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
        >
            <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    isUser
                        ? 'rounded-br-sm bg-[#b59100] text-white'
                        : 'rounded-bl-sm bg-gray-100 text-gray-800'
                }`}
            >
                {isUser ? (
                    text || '…'
                ) : (
                    <>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={agentMarkdownComponents}
                        >
                            {text || '…'}
                        </ReactMarkdown>
                        {streaming && (
                            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse rounded-full bg-gray-400 align-middle" />
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
}

const inputCls =
    'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#b59100] focus:outline-none focus:ring-1 focus:ring-[#b59100]/40';

const EnquiryFormOverlay = forwardRef(function EnquiryFormOverlay({ formData, onChange, onSubmit, onClose, submitting, submitted, errors }, ref) {
    const phoneDisplay = formatNationalForDisplay(digitsUsNational(formData.phone));

    const handlePhoneChange = (e) => {
        const d = digitsUsNational(e.target.value);
        onChange('phone', d ? `+1 ${formatNationalForDisplay(d)}` : '');
    };

    return (
        <motion.div
            ref={ref}
            key="form-overlay"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 z-10 flex flex-col bg-white"
        >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-3.5">
                <div>
                    <p className="text-sm font-semibold text-gray-900">Enquiry Form</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Fill in your details — the agent can help</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition focus:outline-none"
                    aria-label="Close form"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Scrollable fields */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3.5">
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Your name *</label>
                    <input
                        type="text"
                        className={inputCls}
                        value={formData.name}
                        onChange={(e) => onChange('name', e.target.value)}
                        placeholder="Jane Smith"
                        autoComplete="name"
                    />
                    {errors.name && <p className="mt-0.5 text-xs text-red-500">{errors.name}</p>}
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Store / business name *</label>
                    <input
                        type="text"
                        className={inputCls}
                        value={formData.store_name}
                        onChange={(e) => onChange('store_name', e.target.value)}
                        placeholder="Acme Retail"
                        autoComplete="organization"
                    />
                    {errors.store_name && <p className="mt-0.5 text-xs text-red-500">{errors.store_name}</p>}
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                    <div className="flex overflow-hidden rounded-lg border border-gray-300 focus-within:border-[#b59100] focus-within:ring-1 focus-within:ring-[#b59100]/40 bg-white">
                        <span className="flex shrink-0 select-none items-center border-r border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                            +1
                        </span>
                        <input
                            type="tel"
                            inputMode="numeric"
                            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                            placeholder="(555) 123-4567"
                            value={phoneDisplay}
                            onChange={handlePhoneChange}
                            autoComplete="tel-national"
                        />
                    </div>
                    {errors.phone && <p className="mt-0.5 text-xs text-red-500">{errors.phone}</p>}
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                    <input
                        type="email"
                        className={inputCls}
                        value={formData.email}
                        onChange={(e) => onChange('email', e.target.value)}
                        placeholder="jane@example.com"
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                    />
                    {errors.email && <p className="mt-0.5 text-xs text-red-500">{errors.email}</p>}
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                        Message <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <textarea
                        rows={3}
                        className={`${inputCls} resize-none`}
                        value={formData.message}
                        onChange={(e) => onChange('message', e.target.value)}
                        placeholder="How can we help?"
                    />
                    {errors.message && <p className="mt-0.5 text-xs text-red-500">{errors.message}</p>}
                </div>
            </div>

            {/* Submit row */}
            <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3.5">
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={submitting}
                    className="w-full rounded-xl bg-[#b59100] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9a7c00] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#b59100]/50"
                >
                    {submitting ? 'Sending…' : 'Submit Enquiry'}
                </button>
            </div>
        </motion.div>
    );
});

function BeforeStartDisclaimer({ onConfirm }) {
    return (
        <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="before-start-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: disclaimerEase }}
        >
            <motion.div
                className="absolute inset-0 bg-gray-900/25"
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: disclaimerEase }}
            />
            <motion.div
                className="relative w-full max-w-[17rem] rounded-2xl border border-gray-200 bg-white p-5 shadow-lg ring-1 ring-black/5"
                initial={{ opacity: 0, scale: 0.9, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 10 }}
                transition={{ duration: 0.26, ease: disclaimerEase }}
            >
                <div className="flex flex-col items-center gap-3 text-center">
                    <motion.img
                        src={AGENT_IMAGE}
                        alt={`${AGENT_NAME}, your AI concierge`}
                        className="h-16 w-16 rounded-full object-cover ring-2 ring-[#ffde59]/50"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.24, delay: 0.04, ease: disclaimerEase }}
                    />
                    <h3 id="before-start-title" className="text-base font-bold text-gray-900">
                        Before you start
                    </h3>
                    <p className="text-xs leading-relaxed text-gray-600">
                        {AGENT_NAME} is an AI assistant and can make mistakes.
                    </p>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="w-full rounded-lg bg-[#b59100] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9a7c00] focus:outline-none focus:ring-2 focus:ring-[#b59100]/50"
                    >
                        Okay
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

function ModeCard({ icon: Icon, label, description, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center transition-all duration-200 hover:border-[#b59100] hover:bg-amber-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#b59100]/40"
        >
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-colors group-hover:border-[#b59100]/50 group-hover:bg-amber-50">
                <Icon className="h-6 w-6 text-[#b59100]" />
            </span>
            <span>
                <p className="font-semibold text-gray-900">{label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{description}</p>
            </span>
        </button>
    );
}

const CARD_HEIGHT = 600;

const slideVariants = {
    enter: { opacity: 0, x: 24 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
};

const disclaimerEase = [0.22, 1, 0.36, 1];
const DISCLAIMER_EXIT_MS = 260;

const EMPTY_FORM = { name: '', store_name: '', phone: '', email: '', message: '' };

/**
 * Optional props for jumping straight into the chat from a parent CTA:
 *   - autoStart:           'mode' | 'text' | 'voice' — skips the idle splash
 *   - initialUserMessage:  string — once the agent sends its first message,
 *                          this is auto-sent as the user's first question
 *                          (only meaningful when autoStart === 'text')
 */
export default function AiConcierge({ product, autoStart = null, initialUserMessage = null, onBack = null }) {
    const [stage, setStage] = useState(autoStart === 'mode' ? 'mode' : 'idle'); // 'idle' | 'mode' | 'voice' | 'text'
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [sessionError, setSessionError] = useState(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);

    const [micMuted, setMicMuted] = useState(false);
    const [pendingStartMode, setPendingStartMode] = useState(null); // 'voice' | 'text' | null

    // Form overlay state
    const [formVisible, setFormVisible]     = useState(false);
    const [formData, setFormData]           = useState(EMPTY_FORM);
    const [formErrors, setFormErrors]       = useState({});
    const [formSubmitting, setFormSubmitting] = useState(false);
    const [formSubmitted, setFormSubmitted] = useState(false);
    // Ref mirror so tool handlers always access latest formData without stale closures
    const formDataRef = useRef(EMPTY_FORM);

    const updateFormField = useCallback((field, value) => {
        setFormData((prev) => {
            const next = { ...prev, [field]: value };
            formDataRef.current = next;
            return next;
        });
    }, []);

    // Track whether we are in text mode to avoid duplicating user messages
    // that are added optimistically in sendText.
    const isTextMode = useRef(false);

    // Streaming state: accumulates agent_chat_response_part chunks in text mode.
    const [streamingText, setStreamingText] = useState('');
    const streamingRef = useRef(''); // shadow ref so onDebug closure always has the latest value

    const clearStreaming = useCallback(() => {
        streamingRef.current = '';
        setStreamingText('');
    }, []);

    // Auto-send-on-first-agent-message support (driven by initialUserMessage prop).
    const pendingFirstUserMessage = useRef(null);
    // Ref-mirror of sendUserMessage so onMessage (defined above the hook) can call it.
    const sendUserMessageRef = useRef(null);

    // onMessage fires for BOTH voice and text mode.
    // SDK shape: { source: 'user' | 'ai', message: string }
    const onMessage = useCallback((event) => {
        console.log('[AiConcierge] onMessage', event);
        const source  = event?.source ?? event?.role ?? '';
        const message = event?.message ?? '';
        if (!message?.trim()) return;

        const isUser  = source === 'user';
        const isAgent = source === 'ai' || source === 'agent';

        if (isUser) {
            // In text mode the user bubble is already added optimistically in sendText.
            // In voice mode we add it here from the server transcript.
            if (!isTextMode.current) {
                setMessages((prev) => [...prev, { role: 'user', text: message }]);
            }
        } else if (isAgent) {
            // Final complete response — commit it and clear the streaming bubble.
            clearStreaming();
            setMessages((prev) => [...prev, { role: 'agent', text: message }]);

            // If a parent CTA queued an auto-question, dispatch it now that the
            // agent has greeted (text mode only — voice handles itself).
            if (pendingFirstUserMessage.current && isTextMode.current) {
                const queued = pendingFirstUserMessage.current;
                pendingFirstUserMessage.current = null;
                setTimeout(() => {
                    try {
                        sendUserMessageRef.current?.(queued);
                        setMessages((prev) => [...prev, { role: 'user', text: queued }]);
                    } catch (err) {
                        console.error('[AiConcierge] auto-send failed', err);
                    }
                }, 400);
            }
        }
    }, [clearStreaming]);

    // onDebug receives raw WebSocket events the SDK doesn't expose via callbacks.
    // agent_chat_response_part is streamed in text-only mode.
    // Confirmed payload shape: { type: 'agent_chat_response_part', agent_chat_response_part_event: { text_chunk: string } }
    const onDebug = useCallback((event) => {

        if (!isTextMode.current) return;
        if (event?.type !== 'agent_chat_response_part') return;

        const chunk = event?.agent_chat_response_part_event?.text_chunk ?? '';
        if (!chunk) return;

        streamingRef.current += chunk;
        setStreamingText(streamingRef.current);
    }, []);

    const { status, isSpeaking, startSession, endSession, sendUserMessage, getInputVolume, getOutputVolume } = useConversation({
        micMuted,
        onMessage,
        onConnect: () => console.log('[AiConcierge] connected'),
        onDebug,
        agent_chat_response_part: (event) => {
            console.log('[AiConcierge] agent_chat_response_part', event);
        },
        onDisconnect: (details) => {
            console.log('[AiConcierge] disconnected', details);
            clearStreaming();
        },
        onError: (msg) => {
            console.error('[AiConcierge] error', msg);
            clearStreaming();
            setSessionError(typeof msg === 'string' ? msg : 'Connection error. Please try again.');
            setStage('mode');
        },
    });

    const voicePrompt = buildSystemPrompt(product, false);
    const textPrompt  = buildSystemPrompt(product, true);

    const openForm = useCallback(() => {
        setFormVisible(true);
        setFormSubmitted(false);
        setFormErrors({});
    }, []);

    // Client tools — handlers defined here so they always close over stable refs/setters.
    const makeClientTools = useCallback(() => ({
        invoke_form: () => {
            console.log('[AiConcierge] agent called invoke_form');
            setFormVisible(true);
            setFormSubmitted(false);
            setFormErrors({});
            return 'The enquiry form is now visible to the user.';
        },
        fill_form: (params = {}) => {
            console.log('[AiConcierge] agent called fill_form', params);
            setFormData((prev) => {
                const next = { ...prev };
                ['name', 'store_name', 'phone', 'email', 'message'].forEach((f) => {
                    if (params[f] != null && params[f] !== '') next[f] = String(params[f]);
                });
                formDataRef.current = next;
                return next;
            });
            return 'Form fields updated.';
        },
        submit_form: async () => {
            console.log('[AiConcierge] agent called submit_form', formDataRef.current);
            setFormSubmitting(true);
            try {
                const payload = { ...formDataRef.current };
                const digits = digitsUsNational(payload.phone);
                if (digits.length === 10) payload.phone = `+1 ${formatNationalForDisplay(digits)}`;

                const csrfToken = document.head.querySelector('meta[name="csrf-token"]')?.content ?? '';
                const res = await fetch(route('ai-concierge.submit-enquiry', product.slug), {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                    },
                    body: JSON.stringify(payload),
                });
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    const errors = json.errors ?? {};
                    setFormErrors(errors);
                    setFormSubmitting(false);
                    const firstMsg = Object.values(errors)[0]?.[0] ?? json.message ?? 'Please check the form.';
                    return `Submission failed: ${firstMsg}`;
                }
                setFormSubmitted(true);
                setFormVisible(false);
                setFormSubmitting(false);
                return 'Enquiry submitted successfully. Thank you!';
            } catch (err) {
                setFormSubmitting(false);
                return `Submission error: ${err.message}`;
            }
        },
    }), [product.slug]);

    const handleFormSubmit = useCallback(async () => {
        setFormSubmitting(true);
        setFormErrors({});
        try {
            const payload = { ...formDataRef.current };
            const digits = digitsUsNational(payload.phone);
            if (digits.length === 10) payload.phone = `+1 ${formatNationalForDisplay(digits)}`;

            const csrfToken = document.head.querySelector('meta[name="csrf-token"]')?.content ?? '';
            const res = await fetch(route('ai-concierge.submit-enquiry', product.slug), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify(payload),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setFormErrors(json.errors ?? {});
                setFormSubmitting(false);
                return;
            }
            setFormSubmitted(true);
            setFormVisible(false);
            setFormSubmitting(false);
        } catch (err) {
            console.error('[AiConcierge] form submit error:', err);
            setFormSubmitting(false);
        }
    }, [product.slug]);

    const startVoice = useCallback(async () => {
        isTextMode.current = false;
        setStage('voice');
        setMessages([]);
        setSessionError(null);
        setFormVisible(false);
        setFormData(EMPTY_FORM);
        formDataRef.current = EMPTY_FORM;
        try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { /* SDK handles it */ }
        try {
            const signedUrl = await fetchSignedUrl();
            await startSession({
                signedUrl,
                connectionType: 'websocket',
                clientTools: makeClientTools(),
                overrides: buildSessionOverrides(voicePrompt, product, false),
            });
        } catch (err) {
            setSessionError(err.message ?? 'Could not start session.');
            setStage('mode');
        }
    }, [startSession, voicePrompt, product, makeClientTools]);

    const startText = useCallback(async () => {
        isTextMode.current = true;
        setStage('text');
        setMessages([]);
        setSessionError(null);
        setFormVisible(false);
        setFormData(EMPTY_FORM);
        formDataRef.current = EMPTY_FORM;
        try {
            const signedUrl = await fetchSignedUrl();
            await startSession({
                signedUrl,
                connectionType: 'websocket',
                textOnly: true,
                clientTools: makeClientTools(),
                overrides: buildSessionOverrides(textPrompt, product, true),
            });
        } catch (err) {
            setSessionError(err.message ?? 'Could not start session.');
            setStage('mode');
        }
    }, [startSession, textPrompt, product, makeClientTools]);

    const requestStartVoice = useCallback(() => setPendingStartMode('voice'), []);
    const requestStartText = useCallback(() => setPendingStartMode('text'), []);

    const confirmStart = useCallback(() => {
        const mode = pendingStartMode;
        if (!mode) return;
        setPendingStartMode(null);
        window.setTimeout(() => {
            if (mode === 'voice') startVoice();
            else if (mode === 'text') startText();
        }, DISCLAIMER_EXIT_MS);
    }, [pendingStartMode, startVoice, startText]);

    // Keep the ref-mirror for sendUserMessage fresh
    useEffect(() => {
        sendUserMessageRef.current = sendUserMessage;
    }, [sendUserMessage]);

    // One-shot auto-start triggered by a parent CTA (e.g. ShowV2 chip click)
    const autoStartTriggered = useRef(false);
    useEffect(() => {
        if (autoStartTriggered.current) return;
        if (!autoStart) return;
        autoStartTriggered.current = true;

        if (autoStart === 'text') {
            if (initialUserMessage) pendingFirstUserMessage.current = initialUserMessage;
            setPendingStartMode('text');
        } else if (autoStart === 'voice') {
            setPendingStartMode('voice');
        }
        // autoStart === 'mode' is already handled by initial stage state
    }, [autoStart, initialUserMessage, startText, startVoice]);

    const handleEnd = useCallback(async () => {
        if (status === 'connected' || status === 'connecting') await endSession();
        isTextMode.current = false;
        clearStreaming();
        pendingFirstUserMessage.current = null;
        setStage('idle');
        setMessages([]);
        setInputText('');
        setFormVisible(false);
        setFormData(EMPTY_FORM);
        formDataRef.current = EMPTY_FORM;
        setFormErrors({});
        setFormSubmitted(false);
        setMicMuted(false);
        setPendingStartMode(null);
    }, [endSession, status]);

    const sendText = useCallback(() => {
        const text = inputText.trim();
        if (!text || status !== 'connected') return;
        setMessages((prev) => [...prev, { role: 'user', text }]);
        sendUserMessage(text);
        setInputText('');
    }, [inputText, status, sendUserMessage]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); }
    };

    useEffect(() => {
        if (messages.length > 0 || streamingText) {
            requestAnimationFrame(() => {
                const el = messagesContainerRef.current;
                if (!el) return;
                const lastChild = el.lastElementChild;
                if (!lastChild) return;
                // Scroll so the last message sits ~50px below the top of the chat area.
                const containerTop = el.getBoundingClientRect().top;
                const lastTop = lastChild.getBoundingClientRect().top;
                el.scrollTop += lastTop - containerTop - 50;
            });
        }
    }, [messages, streamingText]);

    useEffect(() => {
        if (stage === 'text') setTimeout(() => inputRef.current?.focus(), 80);
    }, [stage]);

    const statusLabel =
        status === 'connecting' ? 'Connecting…'
        : status === 'connected' ? (isSpeaking ? 'Speaking…' : 'Listening…')
        : status === 'disconnecting' ? 'Ending call…'
        : null;

    const conversationStarted = status === 'connected';

    const [voiceAudioLevel, setVoiceAudioLevel] = useState(0.12);
    const [voiceAudioMode, setVoiceAudioMode] = useState('idle');

    useEffect(() => {
        if (stage !== 'voice' || status !== 'connected') {
            setVoiceAudioLevel(0.12);
            setVoiceAudioMode('idle');
            return undefined;
        }

        let raf = 0;
        const tick = () => {
            const inputRaw = getInputVolume?.() ?? 0;
            const outputRaw = getOutputVolume?.() ?? 0;
            // Mic levels are often quieter than agent output — boost input for visible pulse
            const inputLevel = Math.min(1, Math.sqrt(Math.max(0, inputRaw)) * 2.2);
            const outputLevel = Math.min(1, outputRaw * 1.5);

            const agentActive = isSpeaking || outputLevel > 0.08;
            const userActive = !agentActive && !micMuted && inputLevel > 0.05;

            if (agentActive) {
                setVoiceAudioMode('agent');
                setVoiceAudioLevel(Math.max(outputLevel, isSpeaking ? 0.55 : 0.3));
            } else if (userActive) {
                setVoiceAudioMode('user');
                setVoiceAudioLevel(Math.max(0.35, inputLevel));
            } else {
                setVoiceAudioMode('idle');
                setVoiceAudioLevel(0.12);
            }

            raf = requestAnimationFrame(tick);
        };

        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [stage, status, isSpeaking, micMuted, getInputVolume, getOutputVolume]);

    return (
        <>
            <section
                className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm"
                style={{ height: CARD_HEIGHT }}
            >
                {/* Persistent header */}
                <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                aria-label="Back"
                                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                        )}
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#b59100]/10 ring-1 ring-[#b59100]/30">
                            <Sparkles className="h-4 w-4 text-[#b59100]" />
                        </span>
                        <div>
                            <h2 className="barlow-condensed-semibold text-xl md:text-2xl font-bold text-gray-900 leading-tight">
                                Connect with Hannah
                            </h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {(stage === 'voice' || stage === 'text') && (
                            <button
                                type="button"
                                onClick={openForm}
                                className="flex items-center gap-1.5 rounded-full border border-[#b59100]/40 bg-amber-50 px-3 py-1.5 text-xs font-medium text-[#b59100] transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-[#b59100]/30"
                            >
                                <ClipboardList className="h-3 w-3" />
                                Enquiry Form
                            </button>
                        )}
                        {stage === 'voice' && (
                            <button
                                type="button"
                                disabled={!conversationStarted}
                                onClick={() => setMicMuted((m) => !m)}
                                aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                                aria-disabled={!conversationStarted}
                                title={conversationStarted ? undefined : 'Available once the conversation starts'}
                                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-inherit ${
                                    micMuted
                                        ? 'border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200 focus:ring-gray-300'
                                        : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 focus:ring-blue-300'
                                }`}
                            >
                                {micMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                                {micMuted ? 'Unmute' : 'Mute'}
                            </button>
                        )}
                        {(stage === 'voice' || stage === 'text') && (
                            <button
                                type="button"
                                disabled={!conversationStarted}
                                onClick={handleEnd}
                                aria-disabled={!conversationStarted}
                                title={conversationStarted ? undefined : 'Available once the conversation starts'}
                                className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-red-50"
                            >
                                <PhoneOff className="h-3 w-3" />
                                End
                            </button>
                        )}
                    </div>
                </div>

                {/* Stage body — all transitions happen in this fixed-height area */}
                <div className="relative flex-1 overflow-hidden">
                    <AnimatePresence>
                        {pendingStartMode && (
                            <BeforeStartDisclaimer key="before-start-disclaimer" onConfirm={confirmStart} />
                        )}
                    </AnimatePresence>
                    <AnimatePresence mode="wait" initial={false}>
                        {/* ── Idle ── */}
                        {stage === 'idle' && (
                            <motion.div
                                key="idle"
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center"
                            >
                                <div className="flex h-48 w-48 items-center justify-center rounded-full border-2 border-[#ffde59]/60 overflow-hidden" style={{ boxShadow: '0 0 24px rgba(255, 222, 89, 0.65)' }}>
                                    <img
                                        src="/images/hannah-agent.png"
                                        alt="Hannah, your AI concierge"
                                        className="w-full h-full rounded-full object-cover shadow-md scale-[1.15]"
                                    />
                                </div>
                                <div>
                                    <p className="text-base font-semibold text-gray-900">
                                        Got questions? Ask Hannah.
                                    </p>
                                    <p className="mt-2 text-sm leading-relaxed text-gray-500">
                                        Chat or speak with Hannah for instant answers about{' '}
                                        <span className="font-medium text-gray-700">{product.product_name}</span>.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setStage('mode')}
                                    className="flex items-center gap-2 rounded-xl bg-[#b59100] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9a7c00] focus:outline-none focus:ring-2 focus:ring-[#b59100]/50 focus:ring-offset-2"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    Connect with Hannah
                                </button>
                                <button
                                    type="button"
                                    onClick={openForm}
                                    className="flex items-center gap-1.5 text-xs text-gray-400 transition hover:text-[#b59100] focus:outline-none"
                                >
                                    <ClipboardList className="h-3.5 w-3.5" />
                                    Or send an enquiry directly
                                </button>
                            </motion.div>
                        )}

                        {/* ── Mode picker ── */}
                        {stage === 'mode' && (
                            <motion.div
                                key="mode"
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="absolute inset-0 flex flex-col justify-center gap-5 px-6"
                            >
                                {sessionError && (
                                    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-center text-sm text-red-600">
                                        {sessionError}
                                    </p>
                                )}
                                <div className="flex items-center justify-center mb-2">
                                    <motion.div
                                        whileHover={{ scale: 1.08 }}
                                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                                        className="h-48 w-48 rounded-full overflow-hidden border-2 border-[#ffde59]/60"
                                        style={{ boxShadow: '0 0 24px rgba(255, 222, 89, 0.65)' }}
                                    >
                                        <img
                                            src="/images/hannah-agent.png"
                                            alt="Hannah, your AI concierge"
                                            className="w-full h-full rounded-full object-cover shadow-md scale-[1.15]"
                                        />
                                    </motion.div>
                                </div>
                          
                                <p className="text-center text-sm font-medium text-gray-600">
                                    How would you like to connect?
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <ModeCard
                                        icon={Mic}
                                        label="Voice"
                                        description="Speak naturally"
                                        onClick={requestStartVoice}
                                    />
                                    <ModeCard
                                        icon={MessageSquare}
                                        label="Text"
                                        description="Chat via messages"
                                        onClick={requestStartText}
                                    />
                                </div>
                                {/* <button
                                    type="button"
                                    onClick={() => setStage('idle')}
                                    className="text-center text-xs text-gray-400 transition hover:text-gray-600 focus:outline-none"
                                >
                                    ← Back
                                </button> */}
                            </motion.div>
                        )}

                        {/* ── Voice mode ── */}
                        {stage === 'voice' && (
                            <motion.div
                                key="voice"
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="absolute inset-0 flex flex-col"
                            >
                                {/* Orb — full-size centered when no form, compact row when form is visible */}
                                <AnimatePresence mode="wait" initial={false}>
                                    {formVisible ? (
                                        <motion.div
                                            key="orb-compact"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="shrink-0 flex items-center gap-3 border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-[#fffdf0] to-white overflow-hidden"
                                        >
                                            <HannahVoiceAvatar
                                                audioMode={voiceAudioMode}
                                                audioLevel={voiceAudioLevel}
                                                status={status}
                                                compact
                                            />
                                            <div className="flex-1 min-w-0">
                                                {status === 'connecting' ? (
                                                    <ConnectingSpinner size="xs" />
                                                ) : (
                                                    <p className="text-xs font-semibold text-[#b59100] leading-tight">
                                                        {statusLabel ?? 'Voice active'}
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-gray-400 leading-tight mt-0.5 truncate">
                                                    {status === 'connecting'
                                                        ? 'Please wait…'
                                                        : isSpeaking
                                                        ? 'Agent is speaking…'
                                                        : 'Speak to fill the form or type below'}
                                                </p>
                                            </div>
                                            {/* Live / muted indicator */}
                                            {status === 'connecting' ? null : micMuted ? (
                                                <span className="shrink-0 flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 border border-gray-200">
                                                    <MicOff className="h-3 w-3" />
                                                    Muted
                                                </span>
                                            ) : (
                                                <span className="shrink-0 flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-600 border border-green-200">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                                    Live
                                                </span>
                                            )}
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="orb-full"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.18 }}
                                            className="flex shrink-0 flex-col items-center justify-center gap-2.5 py-6"
                                        >
                                            <HannahVoiceAvatar
                                                audioMode={voiceAudioMode}
                                                audioLevel={voiceAudioLevel}
                                                status={status}
                                            />
                                            {status === 'connecting' ? (
                                                <ConnectingSpinner />
                                            ) : micMuted ? (
                                                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                                                    <MicOff className="h-4 w-4" />
                                                    Microphone muted
                                                </span>
                                            ) : statusLabel && (
                                                <p className="text-sm font-medium text-[#b59100]">{statusLabel}</p>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Body — transcript or inline form (animated switch) */}
                                <AnimatePresence mode="wait" initial={false}>
                                    {formVisible ? (
                                        <motion.div
                                            key="voice-form"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                            className="flex flex-1 min-h-0 flex-col"
                                        >
                                            {/* Scrollable fields */}
                                            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3.5 space-y-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Your name *</label>
                                                    <input
                                                        type="text"
                                                        className={inputCls}
                                                        value={formData.name}
                                                        onChange={(e) => updateFormField('name', e.target.value)}
                                                        placeholder="Jane Smith"
                                                        autoComplete="name"
                                                    />
                                                    {formErrors.name && <p className="mt-0.5 text-xs text-red-500">{formErrors.name}</p>}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Store / business name *</label>
                                                    <input
                                                        type="text"
                                                        className={inputCls}
                                                        value={formData.store_name}
                                                        onChange={(e) => updateFormField('store_name', e.target.value)}
                                                        placeholder="Acme Retail"
                                                        autoComplete="organization"
                                                    />
                                                    {formErrors.store_name && <p className="mt-0.5 text-xs text-red-500">{formErrors.store_name}</p>}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                                                    <div className="flex overflow-hidden rounded-lg border border-gray-300 focus-within:border-[#b59100] focus-within:ring-1 focus-within:ring-[#b59100]/40 bg-white">
                                                        <span className="flex shrink-0 select-none items-center border-r border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                                                            +1
                                                        </span>
                                                        <input
                                                            type="tel"
                                                            inputMode="numeric"
                                                            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                                            placeholder="(555) 123-4567"
                                                            value={formatNationalForDisplay(digitsUsNational(formData.phone))}
                                                            onChange={(e) => {
                                                                const d = digitsUsNational(e.target.value);
                                                                updateFormField('phone', d ? `+1 ${formatNationalForDisplay(d)}` : '');
                                                            }}
                                                            autoComplete="tel-national"
                                                        />
                                                    </div>
                                                    {formErrors.phone && <p className="mt-0.5 text-xs text-red-500">{formErrors.phone}</p>}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
                                                    <input
                                                        type="email"
                                                        className={inputCls}
                                                        value={formData.email}
                                                        onChange={(e) => updateFormField('email', e.target.value)}
                                                        placeholder="jane@example.com"
                                                        autoComplete="email"
                                                        autoCapitalize="none"
                                                        autoCorrect="off"
                                                    />
                                                    {formErrors.email && <p className="mt-0.5 text-xs text-red-500">{formErrors.email}</p>}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Message <span className="font-normal text-gray-400">(optional)</span>
                                                    </label>
                                                    <textarea
                                                        rows={2}
                                                        className={`${inputCls} resize-none`}
                                                        value={formData.message}
                                                        onChange={(e) => updateFormField('message', e.target.value)}
                                                        placeholder="How can we help?"
                                                    />
                                                    {formErrors.message && <p className="mt-0.5 text-xs text-red-500">{formErrors.message}</p>}
                                                </div>
                                            </div>

                                            {/* Submit row */}
                                            <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3">
                                                <button
                                                    type="button"
                                                    onClick={handleFormSubmit}
                                                    disabled={formSubmitting}
                                                    className="w-full rounded-xl bg-[#b59100] py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#9a7c00] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#b59100]/50"
                                                >
                                                    {formSubmitting ? 'Sending…' : 'Submit Enquiry'}
                                                </button>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="voice-transcript"
                                            ref={messagesContainerRef}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.18 }}
                                            className="flex-1 min-h-0 overflow-y-auto space-y-2 border-t border-gray-100 bg-gray-50/70 px-4 py-3"
                                        >
                                            {messages.length === 0 ? (
                                                <p className="text-center text-xs text-gray-400 mt-4">Transcript will appear here…</p>
                                            ) : (
                                                messages.slice(-10).map((m, i) => (
                                                    <ChatBubble key={i} role={m.role} text={m.text} />
                                                ))
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}

                        {/* ── Text mode ── */}
                        {stage === 'text' && (
                            <motion.div
                                key="text"
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="absolute inset-0 flex flex-col"
                            >
                                {/* Messages */}
                                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-2.5 px-4 py-4">
                                    {status === 'connecting' && (
                                        <div className="flex justify-center py-8">
                                            <ConnectingSpinner />
                                        </div>
                                    )}
                                    {messages.map((m, i) => (
                                        <ChatBubble key={i} role={m.role} text={m.text} />
                                    ))}

                                    {/* Streaming bubble — live markdown chunks before the final message arrives */}
                                    {streamingText && (
                                        <ChatBubble role="agent" text={streamingText} streaming />
                                    )}
                                </div>

                                {/* Input row */}
                                <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
                                    <div className="flex items-end gap-2">
                                        <textarea
                                            ref={inputRef}
                                            rows={1}
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder={status === 'connected' ? 'Type a message…' : 'Connecting…'}
                                            disabled={status !== 'connected'}
                                            className="flex-1 resize-none rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#b59100] focus:outline-none focus:ring-1 focus:ring-[#b59100]/40 disabled:bg-gray-50 disabled:text-gray-400"
                                            style={{ maxHeight: 88, overflowY: 'auto' }}
                                        />
                                        <button
                                            type="button"
                                            onClick={sendText}
                                            disabled={!inputText.trim() || status !== 'connected'}
                                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b59100] text-white transition hover:bg-[#9a7c00] disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#b59100]/40"
                                            aria-label="Send"
                                        >
                                            <Send className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Enquiry form overlay — text mode only (voice uses inline layout) ── */}
                    <AnimatePresence>
                        {formVisible && stage !== 'voice' && (
                            <EnquiryFormOverlay
                                key="enquiry-form-overlay"
                                formData={formData}
                                onChange={updateFormField}
                                onSubmit={handleFormSubmit}
                                onClose={() => setFormVisible(false)}
                                submitting={formSubmitting}
                                submitted={formSubmitted}
                                errors={formErrors}
                            />
                        )}
                    </AnimatePresence>

                    {/* ── Submission success toast (inside the box) ── */}
                    <AnimatePresence>
                        {formSubmitted && (
                            <motion.div
                                key="form-success"
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 16 }}
                                transition={{ duration: 0.3 }}
                                className="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-sm"
                            >
                                <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                                <p className="text-sm font-medium text-green-800">
                                    Enquiry submitted — we'll be in touch soon!
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setFormSubmitted(false)}
                                    className="ml-auto text-green-500 hover:text-green-700 focus:outline-none"
                                    aria-label="Dismiss"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </section>

        </>
    );
}
