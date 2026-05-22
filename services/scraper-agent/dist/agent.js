"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.planTabSlices = planTabSlices;
exports.planWorkerSlices = planWorkerSlices;
exports.resolveCredentials = resolveCredentials;
exports.runAgent = runAgent;
const genai_1 = require("@google/genai");
const ws_1 = __importDefault(require("ws"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CAPTURES_DIR = path_1.default.join(process.env.STORAGE_DIR ?? path_1.default.join(process.cwd(), 'data'), 'captures');
if (!fs_1.default.existsSync(CAPTURES_DIR))
    fs_1.default.mkdirSync(CAPTURES_DIR, { recursive: true });
const MAX_ITERATIONS = 80;
// Wall-clock limit excludes retry sleep time — configurable via SCRAPER_TIMEOUT_MIN env var (default 20 min)
const MAX_ACTIVE_MS = (parseInt(process.env.SCRAPER_TIMEOUT_MIN ?? '20', 10) || 20) * 60 * 1000;
const GEMINI_MAX_RETRIES = 10;
const GEMINI_RETRY_DELAYS_MS = [3000, 5000, 8000, 15000, 30000, 60000, 90000, 120000, 180000, 240000]; // adjusted backoff for 503/429
// Max posts per scrape — configurable via SCRAPER_MAX_POSTS env var (default 8)
const MAX_POSTS = Math.max(1, parseInt(process.env.SCRAPER_MAX_POSTS ?? '8', 10) || 8);
const PARALLEL_THRESHOLD = Math.max(1, parseInt(process.env.SCRAPER_PARALLEL_THRESHOLD ?? '3', 10) || 3);
const POSTS_PER_WORKER = Math.max(1, parseInt(process.env.SCRAPER_POSTS_PER_WORKER ?? '2', 10) || 2);
/** Plans post slices; each slice maps to one browser tab when parallel. */
function planTabSlices(totalPosts, threshold, perWorker, maxTabs) {
    const tp = Math.max(1, totalPosts);
    const th = Math.max(1, threshold);
    let pw = Math.max(1, perWorker);
    const cap = Math.max(1, maxTabs);
    if (tp <= th) {
        return [
            {
                postOffset: 0,
                postLimit: tp,
                workerIndex: 0,
                workerTotal: 1,
                totalTarget: tp,
            },
        ];
    }
    let workerTotal = Math.ceil(tp / pw);
    if (workerTotal > cap) {
        workerTotal = cap;
        pw = Math.ceil(tp / workerTotal);
    }
    const slices = [];
    for (let i = 0; i < workerTotal; i++) {
        const postOffset = i * pw;
        const postLimit = Math.min(pw, tp - postOffset);
        if (postLimit <= 0)
            break;
        slices.push({
            postOffset,
            postLimit,
            workerIndex: i,
            workerTotal,
            totalTarget: tp,
        });
    }
    return slices;
}
/** @deprecated use planTabSlices — kept for older imports */
function planWorkerSlices(totalPosts = MAX_POSTS) {
    return planTabSlices(totalPosts, PARALLEL_THRESHOLD, POSTS_PER_WORKER, parseInt(process.env.MAX_CONCURRENT_SESSIONS ?? '8', 10) || 8);
}
/* ---------- tool schema exposed to Gemini ---------- */
const TOOLS_RAW = [
    {
        functionDeclarations: [
            {
                name: 'screenshot',
                description: 'Capture a screenshot of the current browser viewport and return it so you can see the page state.',
                parameters: { type: genai_1.Type.OBJECT, properties: {} },
            },
            {
                name: 'goto',
                description: 'Navigate the browser to a URL.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        url: {
                            type: genai_1.Type.STRING,
                            description: 'The full URL to navigate to.',
                        },
                    },
                    required: ['url'],
                },
            },
            {
                name: 'click',
                description: 'Click at an (x, y) coordinate in the viewport. Prefer clickText when you know the element label.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        x: { type: genai_1.Type.NUMBER, description: 'X pixel coordinate.' },
                        y: { type: genai_1.Type.NUMBER, description: 'Y pixel coordinate.' },
                    },
                    required: ['x', 'y'],
                },
            },
            {
                name: 'clickText',
                description: 'Click the first visible element whose text or accessible label matches the given string.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        text: {
                            type: genai_1.Type.STRING,
                            description: 'The visible text label of the element to click.',
                        },
                    },
                    required: ['text'],
                },
            },
            {
                name: 'type',
                description: 'Type text into the currently focused element (e.g. after clicking an input).',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        text: {
                            type: genai_1.Type.STRING,
                            description: 'The text to type.',
                        },
                    },
                    required: ['text'],
                },
            },
            {
                name: 'fillField',
                description: 'Reliably fill a form input or textarea by CSS selector. ' +
                    'This focuses the element automatically before filling — use this for login forms, search boxes, and any text input instead of click+type. ' +
                    'Common selectors: input[name="username"], input[name="password"], input[type="email"], input[type="text"], textarea. ' +
                    'Returns { ok: true } on success or { ok: false, error: string } if the element is not found.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        selector: {
                            type: genai_1.Type.STRING,
                            description: 'CSS selector for the input element, e.g. "input[name=\'username\']".',
                        },
                        value: {
                            type: genai_1.Type.STRING,
                            description: 'The value to fill into the field.',
                        },
                    },
                    required: ['selector', 'value'],
                },
            },
            {
                name: 'clickSelector',
                description: 'Click an element on the page identified by a CSS selector — more reliable than coordinate-based click for buttons and links. ' +
                    'Common selectors: button[type="submit"], a[href*="/p/"], div[role="button"], img. ' +
                    'Returns { ok: true } or { ok: false, error: string }.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        selector: {
                            type: genai_1.Type.STRING,
                            description: 'CSS selector for the element to click.',
                        },
                    },
                    required: ['selector'],
                },
            },
            {
                name: 'pressKey',
                description: 'Press a keyboard key (e.g. Enter, Tab, Escape).',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        key: {
                            type: genai_1.Type.STRING,
                            description: 'Key name, e.g. "Enter", "Tab", "ArrowDown".',
                        },
                    },
                    required: ['key'],
                },
            },
            {
                name: 'scroll',
                description: 'Scroll the page to load more content.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        direction: {
                            type: genai_1.Type.STRING,
                            description: 'Scroll direction: "down" or "up".',
                        },
                        amount: {
                            type: genai_1.Type.NUMBER,
                            description: 'Pixels to scroll.',
                        },
                    },
                    required: ['direction', 'amount'],
                },
            },
            {
                name: 'wait',
                description: 'Wait for a given number of milliseconds (max 5000ms) to allow the page to load.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        ms: {
                            type: genai_1.Type.NUMBER,
                            description: 'Milliseconds to wait (capped at 5000).',
                        },
                    },
                    required: ['ms'],
                },
            },
            {
                name: 'submitPost',
                description: 'Stream a single completed post to the UI immediately after collecting it. ' +
                    'Call this right after you finish collecting each post — do NOT wait until the end. ' +
                    'The user sees posts appearing one by one in real time. ' +
                    'After submitting all posts, call extractPosts to finalise.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        type: {
                            type: genai_1.Type.STRING,
                            description: 'image, video, text, or mixed.',
                        },
                        media_url: {
                            type: genai_1.Type.STRING,
                            description: 'The /captures/... path returned by captureArea, or a direct https:// URL.',
                        },
                        description: {
                            type: genai_1.Type.STRING,
                            description: 'Post caption or body text.',
                        },
                        post_url: {
                            type: genai_1.Type.STRING,
                            description: 'Permalink to this post, e.g. https://www.instagram.com/p/abc123/',
                        },
                        posted_at: {
                            type: genai_1.Type.STRING,
                            description: 'ISO 8601 datetime string or null.',
                        },
                    },
                    required: ['type'],
                },
            },
            {
                name: 'extractPosts',
                description: 'Finalise the scrape session. Call this ONLY after you have submitted all posts via submitPost. ' +
                    'Pass an empty posts array — the real posts were already streamed via submitPost. ' +
                    'This signals that the scrape is complete and stops the loading spinner.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        platform: {
                            type: genai_1.Type.STRING,
                            description: 'Platform name: instagram, linkedin, twitter, youtube, facebook, tiktok, or other.',
                        },
                        posts: {
                            type: genai_1.Type.ARRAY,
                            description: 'Pass an empty array [] — posts were already sent via submitPost.',
                            items: {
                                type: genai_1.Type.OBJECT,
                                properties: {
                                    type: {
                                        type: genai_1.Type.STRING,
                                        description: 'image, video, text, or mixed.',
                                    },
                                    media_url: {
                                        type: genai_1.Type.STRING,
                                        description: 'Direct image or video URL, or null.',
                                    },
                                    description: {
                                        type: genai_1.Type.STRING,
                                        description: 'Post caption or body text.',
                                    },
                                    post_url: {
                                        type: genai_1.Type.STRING,
                                        description: 'Permalink to this post.',
                                    },
                                    posted_at: {
                                        type: genai_1.Type.STRING,
                                        description: 'ISO 8601 datetime string or null.',
                                    },
                                },
                            },
                        },
                        notes: {
                            type: genai_1.Type.STRING,
                            description: 'Any caveats about access or confidence.',
                        },
                    },
                    required: ['platform', 'posts', 'notes'],
                },
            },
            {
                name: 'extractInstagramGrid',
                description: 'Extract all post data directly from the Instagram profile grid DOM in one call. ' +
                    'For each post <a> element containing a div._aagv img, returns: ' +
                    'href (post path), media_url (full CDN image src), caption (img alt text), is_pinned, is_reel. ' +
                    'This is the primary way to collect Instagram post data — no screenshots or navigation needed for the image or caption. ' +
                    'Returns { posts: Array<{ href, media_url, caption, is_pinned, is_reel }> }.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {},
                    required: [],
                },
            },
            {
                name: 'getBoundingBox',
                description: 'Scroll a DOM element to the centre of the viewport, then return its exact pixel bounding box. ' +
                    'This ensures the element is fully visible and not obscured by sticky headers or nav bars. ' +
                    'Returns { x, y, width, height } — pass these directly to captureArea. ' +
                    'Returns { error } if the element is not found.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        selector: {
                            type: genai_1.Type.STRING,
                            description: 'CSS selector for the element, e.g. "a[href=\'/p/abc123/\'] img".',
                        },
                    },
                    required: ['selector'],
                },
            },
            {
                name: 'verifyCapture',
                description: 'Load a previously captured image file and return it so you can visually inspect it. ' +
                    'Call this after every captureArea or captureElement to verify the crop looks correct — ' +
                    'it should show the post thumbnail content, not a profile picture, nav bar, or blank area. ' +
                    'Returns { imageBase64, mimeType } which you can inspect. ' +
                    'If the image looks wrong, call captureArea again with corrected coordinates.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        media_url: {
                            type: genai_1.Type.STRING,
                            description: 'The /captures/... path returned by captureArea or captureElement.',
                        },
                    },
                    required: ['media_url'],
                },
            },
            {
                name: 'captureArea',
                description: 'Crop and save a specific rectangular region of the current viewport as an image file. ' +
                    'Use this to capture ONLY the thumbnail of a specific post — identify its bounding box from the screenshot, then call this with those pixel coordinates. ' +
                    'Returns { media_url: string } — use this value directly as the post\'s media_url. ' +
                    'The viewport is 1280×800 pixels.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        x: {
                            type: genai_1.Type.NUMBER,
                            description: 'Left edge of the area in pixels (from the left of the viewport).',
                        },
                        y: {
                            type: genai_1.Type.NUMBER,
                            description: 'Top edge of the area in pixels (from the top of the viewport).',
                        },
                        width: {
                            type: genai_1.Type.NUMBER,
                            description: 'Width of the area in pixels.',
                        },
                        height: {
                            type: genai_1.Type.NUMBER,
                            description: 'Height of the area in pixels.',
                        },
                        label: {
                            type: genai_1.Type.STRING,
                            description: 'Short label for the filename, e.g. "post-1".',
                        },
                    },
                    required: ['x', 'y', 'width', 'height'],
                },
            },
            {
                name: 'captureElement',
                description: 'Capture a screenshot of a specific DOM element by CSS selector and save it as an image file. ' +
                    'Prefer captureArea when you know the pixel coordinates — use this only when you have a reliable unique CSS selector. ' +
                    'If the selector matches nothing, falls back to the full viewport. ' +
                    'Returns { media_url: string }.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        selector: {
                            type: genai_1.Type.STRING,
                            description: 'CSS selector for the element to capture.',
                        },
                        label: {
                            type: genai_1.Type.STRING,
                            description: 'Short label used in the filename, e.g. "post-1".',
                        },
                    },
                    required: [],
                },
            },
            {
                name: 'getPageSource',
                description: 'Return a compact summary of the current page\'s interactive elements: all buttons (with text/type/id/class), ' +
                    'all visible inputs (with name/type/placeholder/id), all links (with href/text), and the page URL. ' +
                    'Use this when you need to find the exact CSS selector or attribute for a button or input — especially for login forms. ' +
                    'Returns { url, buttons, inputs, links }.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {},
                    required: [],
                },
            },
            {
                name: 'getDomAttribute',
                description: 'Read a property or attribute from a DOM element on the current page using a CSS selector. ' +
                    'Use this to extract image src URLs, og:image meta content, href links, etc. directly from the page source. ' +
                    'Returns { value: string | null }. If multiple elements match, returns value from the first one. ' +
                    'For img elements use attribute "src", for meta tags use "content", for links use "href".',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        selector: {
                            type: genai_1.Type.STRING,
                            description: 'CSS selector to find the element, e.g. "article img", "meta[property=\'og:image\']", "a[href*=\'/p/\']".',
                        },
                        attribute: {
                            type: genai_1.Type.STRING,
                            description: 'Attribute or property name to read, e.g. "src", "href", "content", "alt".',
                        },
                    },
                    required: ['selector', 'attribute'],
                },
            },
            {
                name: 'getDomAttributeAll',
                description: 'Like getDomAttribute but returns values from ALL matching elements as an array. ' +
                    'Use this to collect multiple image URLs or post links at once. ' +
                    'Returns { values: (string | null)[] }.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        selector: {
                            type: genai_1.Type.STRING,
                            description: 'CSS selector to match multiple elements.',
                        },
                        attribute: {
                            type: genai_1.Type.STRING,
                            description: 'Attribute or property name to read from each element.',
                        },
                    },
                    required: ['selector', 'attribute'],
                },
            },
            {
                name: 'finish',
                description: 'Signal that the scrape is complete or impossible to continue.',
                parameters: {
                    type: genai_1.Type.OBJECT,
                    properties: {
                        reason: {
                            type: genai_1.Type.STRING,
                            description: 'Reason for finishing without extracting posts.',
                        },
                    },
                    required: ['reason'],
                },
            },
        ],
    },
];
function mergeTabIndexIntoTools(raw) {
    const tabIdx = {
        tabIndex: {
            type: genai_1.Type.NUMBER,
            description: 'Browser tab index (0-based). When multiple tabs are open you MUST set this on every tool to the tab you are acting on. For a single tab, use 0 or omit.',
        },
    };
    return raw.map((tool) => ({
        ...tool,
        functionDeclarations: (tool.functionDeclarations ?? []).map((fd) => {
            const p = fd.parameters;
            return {
                ...fd,
                parameters: {
                    ...p,
                    properties: { ...p.properties, ...tabIdx },
                },
            };
        }),
    }));
}
const TOOLS = mergeTabIndexIntoTools(TOOLS_RAW);
function resolveToolPage(pages, args) {
    const single = pages.length <= 1;
    if (single)
        return pages[0];
    const raw = args.tabIndex;
    const idx = typeof raw === 'number' && !Number.isNaN(raw)
        ? Math.max(0, Math.min(pages.length - 1, Math.floor(raw)))
        : 0;
    return pages[idx];
}
async function execTool(pages, name, args) {
    const page = resolveToolPage(pages, args);
    switch (name) {
        case 'screenshot': {
            const buf = await page.screenshot({ type: 'jpeg', quality: 60 });
            return { screenshotBase64: buf.toString('base64') };
        }
        case 'goto': {
            await page.goto(String(args.url), {
                waitUntil: 'domcontentloaded',
                timeout: 30_000,
            });
            return { ok: true, url: page.url() };
        }
        case 'click': {
            await page.mouse.click(Number(args.x), Number(args.y));
            await page.waitForTimeout(400);
            return { ok: true };
        }
        case 'clickText': {
            const text = String(args.text);
            try {
                const loc = page.getByText(text, { exact: false }).first();
                if ((await loc.count()) > 0) {
                    await loc.click();
                }
                else {
                    await page
                        .locator(`[aria-label*="${text}" i]`)
                        .first()
                        .click({ timeout: 3000 });
                }
            }
            catch {
                return { ok: false, error: `Could not find element with text: ${text}` };
            }
            await page.waitForTimeout(400);
            return { ok: true };
        }
        case 'type': {
            await page.keyboard.type(String(args.text));
            return { ok: true };
        }
        case 'fillField': {
            const sel = String(args.selector);
            const val = String(args.value);
            try {
                await page.locator(sel).first().waitFor({ timeout: 5000 });
                await page.locator(sel).first().fill(val);
                await page.waitForTimeout(300);
                return { ok: true };
            }
            catch (err) {
                return { ok: false, error: `fillField failed for "${sel}": ${String(err)}` };
            }
        }
        case 'clickSelector': {
            const sel = String(args.selector);
            try {
                await page.locator(sel).first().waitFor({ timeout: 5000 });
                await page.locator(sel).first().click();
                await page.waitForTimeout(500);
                return { ok: true };
            }
            catch (err) {
                return { ok: false, error: `clickSelector failed for "${sel}": ${String(err)}` };
            }
        }
        case 'pressKey': {
            await page.keyboard.press(String(args.key));
            await page.waitForTimeout(300);
            return { ok: true };
        }
        case 'scroll': {
            const dir = String(args.direction);
            const px = Math.min(Number(args.amount), 5000);
            await page.mouse.wheel(0, dir === 'down' ? px : -px);
            await page.waitForTimeout(500);
            return { ok: true };
        }
        case 'wait': {
            await page.waitForTimeout(Math.min(Number(args.ms), 5000));
            return { ok: true };
        }
        case 'extractInstagramGrid': {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const posts = await page.evaluate(() => {
                const d = globalThis.document;
                // Find all <a> tags that contain a ._aagv img (grid thumbnails only)
                const anchors = Array.from(d.querySelectorAll('a'));
                const results = [];
                for (const a of anchors) {
                    const img = a.querySelector('div._aagv img');
                    if (!img)
                        continue;
                    const href = a.getAttribute('href') ?? '';
                    if (!href)
                        continue;
                    const mediaSrc = img.src ?? img.getAttribute('src') ?? '';
                    const caption = img.getAttribute('alt') ?? '';
                    const isPinned = !!a.querySelector('svg[aria-label="Pinned post icon"]');
                    const isReel = href.includes('/reel/');
                    results.push({ href, media_url: mediaSrc, caption, is_pinned: isPinned, is_reel: isReel });
                }
                return results;
            });
            return { posts };
        }
        case 'getBoundingBox': {
            const sel = String(args.selector);
            try {
                const loc = page.locator(sel).first();
                const count = await loc.count();
                if (count === 0)
                    return { error: `No element found for selector: ${sel}` };
                // Scroll element to vertical center of viewport to avoid sticky header/nav overlap
                await page.evaluate((s) => {
                    const el = globalThis.document.querySelector(s);
                    if (el)
                        el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
                }, sel);
                await page.waitForTimeout(400); // let layout settle
                const box = await loc.boundingBox();
                if (!box)
                    return { error: `Element found but not visible/measurable after scrolling: ${sel}` };
                const vw = page.viewportSize()?.width ?? 1280;
                const vh = page.viewportSize()?.height ?? 800;
                const x = Math.max(0, Math.round(box.x));
                const y = Math.max(0, Math.round(box.y));
                const width = Math.min(Math.round(box.width), vw - x);
                const height = Math.min(Math.round(box.height), vh - y);
                if (width <= 0 || height <= 0) {
                    return { error: `Element outside viewport after scroll: x=${x} y=${y} w=${Math.round(box.width)} h=${Math.round(box.height)} vp=${vw}x${vh}` };
                }
                return { x, y, width, height };
            }
            catch (err) {
                return { error: `getBoundingBox failed: ${String(err)}` };
            }
        }
        case 'verifyCapture': {
            const rawPath = String(args.media_url ?? '');
            // Strip leading /captures/ to get just the filename
            const filename = rawPath.replace(/^\/captures\//, '');
            const filepath = path_1.default.join(CAPTURES_DIR, filename);
            try {
                if (!fs_1.default.existsSync(filepath))
                    return { error: `File not found: ${filepath}` };
                const buf = fs_1.default.readFileSync(filepath);
                return { imageBase64: buf.toString('base64'), mimeType: 'image/jpeg' };
            }
            catch (err) {
                return { error: `verifyCapture failed: ${String(err)}` };
            }
        }
        case 'captureArea': {
            const vw = page.viewportSize()?.width ?? 1280;
            const vh = page.viewportSize()?.height ?? 800;
            const rawX = Math.max(0, Math.round(Number(args.x)));
            const rawY = Math.max(0, Math.round(Number(args.y)));
            const x = Math.min(rawX, vw - 1);
            const y = Math.min(rawY, vh - 1);
            const width = Math.min(Math.max(1, Math.round(Number(args.width))), vw - x);
            const height = Math.min(Math.max(1, Math.round(Number(args.height))), vh - y);
            const label = args.label ? String(args.label).replace(/[^a-z0-9_-]/gi, '_') : `area-${Date.now()}`;
            const filename = `${label}-${Date.now()}.jpg`;
            const filepath = path_1.default.join(CAPTURES_DIR, filename);
            try {
                await page.screenshot({
                    path: filepath,
                    type: 'jpeg',
                    quality: 92,
                    clip: { x, y, width, height },
                });
            }
            catch {
                // Fallback: full viewport screenshot if clip still fails
                await page.screenshot({ path: filepath, type: 'jpeg', quality: 85 });
            }
            return { media_url: `/captures/${filename}` };
        }
        case 'captureElement': {
            const sel = args.selector ? String(args.selector) : null;
            const label = args.label ? String(args.label).replace(/[^a-z0-9_-]/gi, '_') : `cap-${Date.now()}`;
            const filename = `${label}-${Date.now()}.jpg`;
            const filepath = path_1.default.join(CAPTURES_DIR, filename);
            try {
                if (sel) {
                    const loc = page.locator(sel).first();
                    const count = await loc.count();
                    if (count > 0) {
                        await loc.screenshot({ path: filepath, type: 'jpeg', quality: 90 });
                    }
                    else {
                        // fallback to full viewport
                        await page.screenshot({ path: filepath, type: 'jpeg', quality: 90 });
                    }
                }
                else {
                    await page.screenshot({ path: filepath, type: 'jpeg', quality: 90 });
                }
            }
            catch {
                await page.screenshot({ path: filepath, type: 'jpeg', quality: 90 });
            }
            // Return a path the Express static handler can serve
            const mediaUrl = `/captures/${filename}`;
            return { media_url: mediaUrl };
        }
        case 'getPageSource': {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const summary = await page.evaluate(() => {
                // Runs in browser context — all DOM APIs available at runtime
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const d = globalThis.document;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const toSel = (el) => {
                    if (el.id)
                        return `#${el.id}`;
                    const tag = String(el.tagName ?? 'el').toLowerCase();
                    const name = el.getAttribute?.('name');
                    const type = el.getAttribute?.('type');
                    const cls = el.classList ? Array.from(el.classList).slice(0, 2).join('.') : '';
                    if (name)
                        return `${tag}[name="${name}"]`;
                    if (type && type !== 'text')
                        return `${tag}[type="${type}"]`;
                    if (cls)
                        return `${tag}.${cls.split(' ')[0]}`;
                    return tag;
                };
                const buttons = Array.from(d.querySelectorAll('button, [role="button"], input[type="submit"]')).slice(0, 30)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((el) => ({
                    text: String(el.innerText ?? el.value ?? '').trim().slice(0, 80),
                    type: el.getAttribute?.('type') ?? null,
                    id: el.id || null,
                    className: String(el.className ?? '').slice(0, 80),
                    selector: toSel(el),
                }));
                const inputs = Array.from(d.querySelectorAll('input:not([type="hidden"]), textarea, select')).slice(0, 20)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((el) => ({
                    name: el.getAttribute?.('name') ?? null,
                    type: el.getAttribute?.('type') ?? null,
                    placeholder: el.getAttribute?.('placeholder') ?? null,
                    id: el.id || null,
                    selector: toSel(el),
                }));
                const links = Array.from(d.querySelectorAll('a[href]')).slice(0, 30)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((el) => ({
                    text: String(el.innerText ?? '').trim().slice(0, 80),
                    href: el.getAttribute?.('href') ?? null,
                }));
                return { url: String(d.location?.href ?? ''), buttons, inputs, links };
            });
            return summary;
        }
        case 'getDomAttribute': {
            const sel = String(args.selector);
            const attr = String(args.attribute);
            const value = await page.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ({ s, a }) => {
                // This runs inside the browser — DOM APIs available at runtime
                const el = globalThis.document.querySelector(s);
                if (!el)
                    return null;
                const propVal = el[a];
                if (typeof propVal === 'string' && propVal)
                    return propVal;
                return typeof el.getAttribute === 'function' ? el.getAttribute(a) : null;
            }, { s: sel, a: attr });
            return { value };
        }
        case 'getDomAttributeAll': {
            const sel = String(args.selector);
            const attr = String(args.attribute);
            const values = await page.evaluate(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ({ s, a }) => {
                const els = Array.from(globalThis.document.querySelectorAll(s));
                return els.map((el) => {
                    const propVal = el[a];
                    if (typeof propVal === 'string' && propVal)
                        return propVal;
                    return typeof el.getAttribute === 'function' ? el.getAttribute(a) : null;
                });
            }, { s: sel, a: attr });
            const unique = [...new Set(values.filter((v) => typeof v === 'string' && !!v))];
            return { values: unique };
        }
        case 'extractPosts':
        case 'finish':
            return { ok: true };
        default:
            return { error: `Unknown tool: ${name}` };
    }
}
/* ---------- system prompt builder ---------- */
/**
 * Resolve credentials from the DB-supplied object OR fall back to env vars
 * based on the target URL's hostname.
 */
function resolveCredentials(targetUrl, dbCredentials) {
    if (dbCredentials)
        return dbCredentials;
    let hostname = '';
    try {
        hostname = new URL(targetUrl).hostname.replace(/^www\./, '');
    }
    catch {
        return undefined;
    }
    if (hostname.includes('instagram.com')) {
        const u = process.env.INSTAGRAM_USERNAME ?? '';
        const p = process.env.INSTAGRAM_PASSWORD ?? '';
        if (u && p)
            return { id: 'env-instagram', platform: 'instagram', username: u, password: p };
    }
    if (hostname.includes('linkedin.com')) {
        const u = process.env.LINKEDIN_USERNAME ?? '';
        const p = process.env.LINKEDIN_PASSWORD ?? '';
        if (u && p)
            return { id: 'env-linkedin', platform: 'linkedin', username: u, password: p };
    }
    return undefined;
}
function buildSystemPrompt(targetUrl, credentials, slices) {
    const multi = slices.length > 1;
    const totalTarget = slices[0]?.totalTarget ?? MAX_POSTS;
    const maxPosts = Math.max(1, totalTarget);
    const singleSlice = slices[0];
    const collectLimitOne = singleSlice.postLimit;
    const maxScrollIndices = multi
        ? Math.max(...slices.map((s) => s.postOffset + s.postLimit))
        : collectLimitOne;
    const hostname = (() => { try {
        return new URL(targetUrl).hostname.replace(/^www\./, '');
    }
    catch {
        return '';
    } })();
    const isInstagram = hostname.includes('instagram.com');
    const isLinkedIn = hostname.includes('linkedin.com');
    const platformForExtract = isInstagram ? 'instagram' : isLinkedIn ? 'linkedin' : 'other';
    const assignmentLines = multi
        ? slices
            .map((s) => isInstagram
            ? `- tabIndex ${s.workerIndex}: after removing pinned posts only, collect exactly ${s.postLimit} post(s) using filtered grid indices ${s.postOffset} through ${s.postOffset + s.postLimit - 1} inclusive.`
            : `- tabIndex ${s.workerIndex}: collect exactly ${s.postLimit} post(s) for your assigned slice (offset ${s.postOffset}).`)
            .join('\n')
        : '';
    const multiTabBlock = multi
        ? `
MULTI-TAB MODE (${slices.length} tabs in ONE browser — shared cookies / one login)
- Include tabIndex (0–${slices.length - 1}) on EVERY tool call. Omit it only when a single tab exists.
- Live preview shows tab 0. Other tabs still run in parallel.
- Log in and clear dialogs on tab 0 only first. Then navigate every tab to the target: for i=1..${slices.length - 1} call goto({ tabIndex: i, url: "${targetUrl}" }).
- Slices — do not scrape the same content on two tabs:
${assignmentLines}
- submitPost must use the same tabIndex as the tab where you collected that post (add tabIndex to submitPost).
- TRUE PARALLELISM: In each model turn, issue one tool call per tab that needs work (e.g. two gotos with tabIndex 0 and 1 in the SAME turn). The runtime executes independent tab tools concurrently.
- Work all tabs in round-robin — do not finish tab 0 before starting tab 1.
- When every tab has submitted its full quota of posts, call extractPosts({ platform: "${platformForExtract}", posts: [], notes: "done" }) once.
`
        : '';
    const credBlock = credentials
        ? `CREDENTIALS (DO NOT REPEAT IN TEXT OUTPUT):
  - Platform: ${credentials.platform}
  - Username: ${credentials.username}
  - Password: ${credentials.password}
SESSION NOTE: You may already be logged in from a previous run (cookies were saved). On your first screenshot, check if you are already on the logged-in feed or profile page. If you are already logged in, skip straight to the scraping steps — do NOT fill login fields again.
LOGIN INSTRUCTIONS — only follow these if you see a login/sign-in form:
1. Call fillField({ tabIndex: 0, selector: "input[name='username']", value: "[username]" }) to fill the username.
2. Call fillField({ tabIndex: 0, selector: "input[name='password']", value: "[password]" }) to fill the password.
3. Call screenshot({ tabIndex: 0 }) to see the current page — you will use the COORDINATES of the login/submit button to click it.
4. Look at the screenshot and identify the login or "Log in" button. Call click({ tabIndex: 0, x: <button_x>, y: <button_y> }) using the pixel coordinates of the button centre visible in that screenshot.
5. Call wait({ tabIndex: 0, ms: 3000 }) then screenshot({ tabIndex: 0 }) to confirm you are now logged in.
6. If any dialog appears ("Save login info?", "Turn on notifications", "Not now", "This was us", cookie banner): take a screenshot, identify the dismiss button coordinates, and call click({ tabIndex: 0, x, y }) to close it. Repeat until no dialogs remain.`
        : 'No credentials provided. If the page requires login, call finish({ reason: "login_required" }).';
    const instagramSingle = `
INSTAGRAM SCRAPING PLAYBOOK — follow every step exactly:

═══ PHASE 1: Extract all post data from the grid in one call ═══
1. Navigate to the target profile page. Call screenshot({ tabIndex: 0 }) once to confirm you are on the right page.
2. Call extractInstagramGrid({ tabIndex: 0 }) — this returns a posts array where each item has:
   { href, media_url, caption, is_pinned, is_reel }
3. Filter: EXCLUDE only is_pinned=true. Include Reels and photos.
4. Build a filtered list with at least ${maxPosts} entries — scroll down 600px with scroll({ tabIndex: 0, direction: "down", amount: 600 }) and call extractInstagramGrid({ tabIndex: 0 }) again if needed (up to 3 scrolls).
5. Take the first ${maxPosts} remaining entries as your work list.

═══ PHASE 2: For each entry in your work list ═══
STEP A — Get the date:
  - Call goto({ tabIndex: 0, url: "https://www.instagram.com" + href }).
  - Call wait({ tabIndex: 0, ms: 2000 }).
  - Call getDomAttribute({ tabIndex: 0, selector: "time[datetime]", attribute: "datetime" }).
  - Call goto({ tabIndex: 0, url: "${targetUrl}" }).
  - Call wait({ tabIndex: 0, ms: 1000 }).

STEP B — Submit immediately:
  - Call submitPost({ tabIndex: 0, type: "image", media_url: "<entry.media_url>", description: "<entry.caption>", post_url: "https://www.instagram.com" + href, posted_at: "<datetime or null>" }).

CRITICAL: After EACH post, submitPost immediately. Stop after ${collectLimitOne} submitPost calls. Then extractPosts({ platform: "instagram", posts: [], notes: "done" }).
`;
    const instagramMulti = `
INSTAGRAM (multi-tab) — same playbook per tabIndex; assignments are in MULTI-TAB MODE above.

PHASE 1 (each tab separately): On tabIndex T, extractInstagramGrid({ tabIndex: T }), scroll({ tabIndex: T, direction: "down", amount: 600 }) until that tab's filtered (non-pinned) grid has at least enough rows for its slice (max index needed across tabs: ${maxScrollIndices}).

PHASE 2 (each tab separately): On tabIndex T only, process YOUR assigned indices only. For each href:
  - goto({ tabIndex: T, url: "https://www.instagram.com" + href }), wait({ tabIndex: T, ms: 2000 }), getDomAttribute({ tabIndex: T, selector: "time[datetime]", attribute: "datetime" }), goto({ tabIndex: T, url: "${targetUrl}" }), wait({ tabIndex: T, ms: 1000 })
  - submitPost({ tabIndex: T, type: "image", media_url, description: caption, post_url, posted_at })

When every tab has reached its quota, extractPosts once.
`;
    const platformGuide = isInstagram
        ? (multi ? instagramMulti : instagramSingle) : isLinkedIn ? `
LINKEDIN-SPECIFIC PLAYBOOK:
1. After reaching the company page, navigate to the Posts tab (look for a "Posts" link in the page nav).
2. Scroll down to load the post feed.
3. For each post: note the post text (description), any image (click the image to see full size, then getDomAttribute with selector "img.feed-shared-image__image" and attribute "src"), the post permalink (getDomAttribute on "a[data-tracking-control-name*='post']" with href), and the date text from a "span.update-components-actor__sub-description" or similar.
4. Skip "Sponsored" or "Promoted" posts.
5. Collect up to ${maxPosts} posts then call extractPosts.
` : `
GENERAL PLAYBOOK:
1. Navigate to the target URL.
2. Scroll to load content.
3. For each visible post: collect type, media_url (use getDomAttribute on img elements), description/caption, post_url, and posted_at.
4. Collect up to ${maxPosts} posts then call extractPosts.
`;
    return `You are an autonomous social-media post scraper. Your job is to control a real browser, log in if needed, and extract recent posts.

TARGET URL: ${targetUrl}

${credBlock}

${platformGuide}
${multiTabBlock}

UNIVERSAL RULES:
- Call screenshot (with tabIndex) before major actions. On a single tab, tabIndex is always 0.
- NEVER include raw credential values in thought or text — use [username] / [password].
- media_url MUST be a real https:// URL you observed — never invent or guess a URL.
- If getDomAttribute returns null for an image, set media_url to null rather than fabricating one.
- HARD LIMIT: collect at most ${totalTarget} post(s) total across all tabs. Call extractPosts when done.
- If blocked by CAPTCHA after 3 attempts, call finish({ reason: "blocked" }).`;
}
/** Tools that may run concurrently when several calls appear in one model turn (different tabIndex). */
function isParallelSafeTool(name) {
    switch (name) {
        case 'submitPost':
        case 'extractPosts':
        case 'finish':
        case 'verifyCapture':
            return false;
        default:
            return true;
    }
}
/* ---------- main agent run ---------- */
async function runAgent(pages, targetUrl, eventsWs, signal, credentials, slices) {
    if (pages.length === 0)
        throw new Error('No browser pages');
    if (slices.length !== pages.length) {
        throw new Error(`Pages/slices mismatch: ${pages.length} pages, ${slices.length} slices`);
    }
    const multi = slices.length > 1;
    const totalTarget = slices[0]?.totalTarget ?? MAX_POSTS;
    const collectQuotaTotal = slices.reduce((a, s) => a + s.postLimit, 0);
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    if (!apiKey)
        throw new Error('GEMINI_API_KEY is not set');
    const ai = new genai_1.GoogleGenAI({ apiKey });
    const modelName = process.env.GEMINI_AGENT_MODEL ?? 'gemini-2.5-flash';
    const emit = (type, data) => {
        if (eventsWs.readyState === ws_1.default.OPEN) {
            eventsWs.send(JSON.stringify({ type, data }));
        }
    };
    const resolvedCreds = resolveCredentials(targetUrl, credentials);
    const hasEnvCreds = !credentials && !!resolvedCreds;
    const tabLabel = (idx) => multi ? `[T${idx + 1}] ` : '';
    emit('status', {
        stage: 'starting',
        workerIndex: multi ? undefined : 0,
        workerTotal: multi ? slices.length : 1,
        message: hasEnvCreds
            ? `${multi ? `${slices.length} tabs · ` : ''}starting… (${totalTarget} post(s) target, credentials from env)`
            : `${multi ? `${slices.length} tabs · ` : ''}starting… (${totalTarget} post(s) target)`,
    });
    const systemInstruction = buildSystemPrompt(targetUrl, resolvedCreds, slices);
    emit('status', { stage: 'navigating', message: `Opening ${targetUrl} on ${pages.length} tab(s)…` });
    await Promise.all(pages.map(async (p) => {
        try {
            await p.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        }
        catch {
            // redirect quirks on IG / LinkedIn
        }
    }));
    await pages[0].waitForTimeout(2500);
    const history = [];
    let activeMs = 0;
    let result = null;
    const streamedPosts = [];
    const collectedByTab = new Array(slices.length).fill(0);
    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        if (signal.aborted)
            throw new Error('cancelled');
        if (activeMs > MAX_ACTIVE_MS)
            throw new Error('timeout');
        const userPieces = [];
        const tabScreenshots = await Promise.all(pages.map((p, ti) => p.screenshot({ type: 'jpeg', quality: multi ? 52 : 60 }).then((buf) => ({ ti, buf }))));
        for (const { ti, buf } of tabScreenshots) {
            userPieces.push((0, genai_1.createPartFromBase64)(buf.toString('base64'), 'image/jpeg'));
            const sl = slices[ti];
            userPieces.push((0, genai_1.createPartFromText)(`tabIndex ${ti}${multi ? ` — progress ${collectedByTab[ti]}/${sl.postLimit} posts (grid indices ${sl.postOffset}–${sl.postOffset + sl.postLimit - 1})` : ''}.`));
        }
        userPieces.push((0, genai_1.createPartFromText)(iter === 0
            ? `Initial state for all tabs. Target URL: ${targetUrl}. Begin scraping.`
            : 'Current state for all tabs. Continue.'));
        history.push((0, genai_1.createUserContent)(userPieces));
        emit('status', { stage: 'thinking', message: `Thinking (step ${iter + 1})…` });
        let response;
        {
            let lastErr;
            let attempted = false;
            for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt++) {
                if (attempt > 0) {
                    const waitMs = GEMINI_RETRY_DELAYS_MS[attempt - 1] ?? 90000;
                    emit('status', {
                        stage: 'retrying',
                        message: `Gemini busy — waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}/${GEMINI_MAX_RETRIES}…`,
                    });
                    await new Promise(r => setTimeout(r, waitMs));
                    if (signal.aborted)
                        throw new Error('cancelled');
                }
                const callStart = Date.now();
                try {
                    response = await ai.models.generateContent({
                        model: modelName,
                        contents: history,
                        config: {
                            systemInstruction,
                            tools: TOOLS,
                            thinkingConfig: {
                                includeThoughts: true,
                                thinkingBudget: -1,
                            },
                        },
                    });
                    activeMs += Date.now() - callStart;
                    attempted = true;
                    break;
                }
                catch (err) {
                    activeMs += Date.now() - callStart;
                    lastErr = err;
                    const msg = err instanceof Error ? err.message : String(err);
                    const isRetryable = msg.includes('503') ||
                        msg.includes('UNAVAILABLE') ||
                        msg.includes('429') ||
                        msg.includes('RESOURCE_EXHAUSTED') ||
                        msg.includes('overloaded') ||
                        msg.includes('high demand');
                    if (!isRetryable || attempt >= GEMINI_MAX_RETRIES) {
                        emit('error', { message: `Gemini API error: ${msg}` });
                        throw err;
                    }
                }
            }
            if (!attempted || !response) {
                const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
                emit('error', { message: `Gemini API failed after ${GEMINI_MAX_RETRIES} retries: ${msg}` });
                throw lastErr;
            }
        }
        const candidate = response.candidates?.[0];
        if (!candidate)
            break;
        const modelParts = [];
        let calledTerminalTool = false;
        const fnCalls = [];
        for (const part of candidate.content?.parts ?? []) {
            const typedPart = part;
            if (typedPart.thought && typedPart.text) {
                emit('thought', { text: typedPart.text });
                continue;
            }
            if (typedPart.functionCall) {
                fnCalls.push({
                    part: part,
                    toolName: String(typedPart.functionCall.name ?? ''),
                    toolArgs: (typedPart.functionCall.args ?? {}),
                });
                continue;
            }
            if (typedPart.text && !typedPart.thought) {
                emit('text', { text: typedPart.text });
                modelParts.push(part);
            }
        }
        const appendToolResponse = (toolName, toolArgs, toolResult) => {
            if (toolName === 'verifyCapture' &&
                toolResult &&
                typeof toolResult.imageBase64 === 'string') {
                const res = toolResult;
                modelParts.push((0, genai_1.createPartFromFunctionResponse)(toolName, toolName, { status: 'captured', media_url: String(toolArgs.media_url ?? '') }));
                modelParts.push((0, genai_1.createPartFromBase64)(res.imageBase64, res.mimeType));
                modelParts.push((0, genai_1.createPartFromText)('Above is the captured thumbnail image. Verify it shows post content (not a profile pic, nav bar, or blank area).'));
            }
            else {
                modelParts.push((0, genai_1.createPartFromFunctionResponse)(toolName, toolName, toolResult));
            }
        };
        let callIdx = 0;
        while (callIdx < fnCalls.length && !calledTerminalTool) {
            const { part, toolName, toolArgs } = fnCalls[callIdx];
            if (toolName === 'submitPost') {
                emit('action', {
                    name: toolName,
                    args: redactCredentials(toolArgs, credentials),
                });
                modelParts.push(part);
                const post = normalizePost({ ...toolArgs, type: 'image' });
                streamedPosts.push(post);
                const tabIdx = typeof toolArgs.tabIndex === 'number' && !Number.isNaN(toolArgs.tabIndex)
                    ? Math.max(0, Math.min(slices.length - 1, Math.floor(toolArgs.tabIndex)))
                    : 0;
                const slice = slices[tabIdx];
                collectedByTab[tabIdx]++;
                emit('post', { post, workerIndex: tabIdx, workerTotal: slices.length });
                emit('status', {
                    stage: 'scraping',
                    workerIndex: tabIdx,
                    workerTotal: slices.length,
                    message: `${tabLabel(tabIdx)}${streamedPosts.length}/${collectQuotaTotal} posts — tab ${tabIdx}: ${collectedByTab[tabIdx]}/${slice.postLimit}`,
                });
                modelParts.push((0, genai_1.createPartFromFunctionResponse)(toolName, toolName, {
                    ok: true,
                    tabIndex: tabIdx,
                    collectedOnThisTab: collectedByTab[tabIdx],
                    remainingOnThisTab: Math.max(0, slice.postLimit - collectedByTab[tabIdx]),
                    collectedTotal: streamedPosts.length,
                    remainingTotal: Math.max(0, collectQuotaTotal - streamedPosts.length),
                }));
                callIdx++;
                continue;
            }
            if (toolName === 'extractPosts') {
                emit('action', {
                    name: toolName,
                    args: redactCredentials(toolArgs, credentials),
                });
                modelParts.push(part);
                const batchPosts = (toolArgs.posts ?? []).map(normalizePost);
                const allPosts = [...streamedPosts, ...batchPosts];
                result = {
                    platform: String(toolArgs.platform ?? 'other'),
                    source_url: targetUrl,
                    posts: allPosts,
                    notes: String(toolArgs.notes ?? ''),
                };
                emit('done', { result });
                calledTerminalTool = true;
                break;
            }
            if (toolName === 'finish') {
                emit('action', {
                    name: toolName,
                    args: redactCredentials(toolArgs, credentials),
                });
                modelParts.push(part);
                const reason = String(toolArgs.reason ?? 'finished');
                const notes = reason === 'login_required' && resolvedCreds
                    ? `Login failed despite credentials being provided for ${resolvedCreds.platform}. The account may be challenged or the password may be wrong.`
                    : reason === 'login_required'
                        ? 'Page requires login. Add credentials to services/scraper-agent/.env (INSTAGRAM_USERNAME / INSTAGRAM_PASSWORD).'
                        : reason;
                result = {
                    platform: 'unknown',
                    source_url: targetUrl,
                    posts: [],
                    notes,
                };
                emit('done', { result });
                calledTerminalTool = true;
                break;
            }
            if (!isParallelSafeTool(toolName)) {
                emit('action', {
                    name: toolName,
                    args: redactCredentials(toolArgs, credentials),
                });
                modelParts.push(part);
                const toolStart = Date.now();
                const toolResult = await execTool(pages, toolName, toolArgs);
                activeMs += Date.now() - toolStart;
                appendToolResponse(toolName, toolArgs, toolResult);
                callIdx++;
                continue;
            }
            let batchEnd = callIdx;
            while (batchEnd < fnCalls.length &&
                isParallelSafeTool(fnCalls[batchEnd].toolName)) {
                batchEnd++;
            }
            const batch = fnCalls.slice(callIdx, batchEnd);
            if (batch.length > 1) {
                emit('status', {
                    stage: 'acting',
                    message: `Running ${batch.length} actions in parallel across tabs…`,
                });
                for (const b of batch) {
                    emit('action', {
                        name: b.toolName,
                        args: redactCredentials(b.toolArgs, credentials),
                    });
                    modelParts.push(b.part);
                }
                const toolStart = Date.now();
                const results = await Promise.all(batch.map((b) => execTool(pages, b.toolName, b.toolArgs)));
                activeMs += Date.now() - toolStart;
                for (let bi = 0; bi < batch.length; bi++) {
                    appendToolResponse(batch[bi].toolName, batch[bi].toolArgs, results[bi]);
                }
            }
            else {
                emit('action', {
                    name: toolName,
                    args: redactCredentials(toolArgs, credentials),
                });
                modelParts.push(part);
                const toolStart = Date.now();
                const toolResult = await execTool(pages, toolName, toolArgs);
                activeMs += Date.now() - toolStart;
                appendToolResponse(toolName, toolArgs, toolResult);
            }
            callIdx = batchEnd;
        }
        if (modelParts.length > 0) {
            history.push({
                role: 'model',
                parts: modelParts,
            });
        }
        if (calledTerminalTool)
            break;
    }
    if (!result) {
        result = {
            platform: 'unknown',
            source_url: targetUrl,
            posts: streamedPosts,
            notes: streamedPosts.length > 0
                ? `Agent stopped early — ${streamedPosts.length} post(s) were collected.`
                : 'Agent reached maximum iterations without extracting posts.',
        };
        emit('done', { result });
    }
    return result;
}
/* ---------- helpers ---------- */
function normalizePost(raw) {
    const p = raw;
    return {
        type: p.type ?? 'text',
        media_url: p.media_url ?? null,
        description: String(p.description ?? ''),
        post_url: p.post_url ?? null,
        posted_at: p.posted_at ?? null,
    };
}
function redactCredentials(args, credentials) {
    if (!credentials)
        return args;
    const replace = (v) => v
        .replace(new RegExp(escapeRe(credentials.username), 'g'), '[username]')
        .replace(new RegExp(escapeRe(credentials.password), 'g'), '[password]');
    const safe = {};
    for (const [k, v] of Object.entries(args)) {
        safe[k] = typeof v === 'string' ? replace(v) : v;
    }
    return safe;
}
function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=agent.js.map