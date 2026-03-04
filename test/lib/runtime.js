import { createApp } from 'https://unpkg.com/petite-vue?module';

const registry = {};
let app = null;

const hooks = {
    processing: [],
    processed: []
};

const pageHooks = {
    enter: {},
    leave: {}
};

/// Events

window.addEventListener('pageshow', e => {
    if (e.persisted) pageEnter(window.location.href);
});

window.addEventListener('pagehide', () => pageLeave(window.location.href));

/// Public API

export function onPageEnter(callback) {
    registerPageHook('enter', callback);
}

export function onPageLeave(callback) {
    registerPageHook('leave', callback);
}

export function onProcessing(callback) {
    hooks.processing.push(callback);
}

export function onProcessed(callback) {
    hooks.processed.push(callback);
}

export function pageEnter(url) {
    runPageHooks('enter', url);
}

export function pageLeave(url) {
    runPageHooks('leave', url);
}

export async function process(element) {
    if (!runHooks('processing', element))
        return;

    if (element.tagName?.toLowerCase() === 'script')
        await loadScript(element);
    else
        await Promise.all(Array.from(element.querySelectorAll('script')).map(script => loadScript(script)));

    await app.mount(element);

    runHooks('processed', element);
}

export function register(name, factory) {
    registry[name] = factory;
}

export async function start() {
    app = createApp(registry);
    await app.mount();
    
    pageEnter(window.location.href);
}

/// Helpers

function getPageKey(url) {
    const u = new URL(url, document.baseURI);
    let path = u.pathname;

    // Remove any "index.*" or "default.*" at the end (case-insensitive).
    path = path.replace(/\/(?:index|default)\.[^\/]+$/i, '/');

    if (path === '')
        path = '/';

    // Remove trailing slash except root.
    if (path.length > 1 && path.endsWith('/'))
        path = path.slice(0, -1);

    return path;
}

function loadScript(script) {
    return new Promise((resolve, reject) => {
        // If the script is not connected to the DOM, then it won't execute, so just resolve.
        if (!script.isConnected) {
            resolve();
            return;
        }

        const newScript = document.createElement('script');

        // Copy all attributes.
        for (const { name, value } of script.attributes) {
            newScript.setAttribute(name, value);
        }

        const isModule = newScript.type === 'module';
        const hasSrc = newScript.hasAttribute('src');

        if (hasSrc || isModule) {
            // External or inline module converted to blob.
            if (isModule && !hasSrc) {
                // Fix issue resolving paths.
                const base = window.location.origin;
                const code = script.textContent.replaceAll('from \'/', `from '${base}/`);
                
                const blob = new Blob([code], { type: 'text/javascript' });
                newScript.src = URL.createObjectURL(blob);
                newScript.onload = () => {
                    URL.revokeObjectURL(newScript.src);
                    resolve();
                }
                newScript.onerror = reject;
            } else {
                newScript.onload = resolve;
                newScript.onerror = reject;
            }
        } else {
            newScript.textContent = script.textContent;
            resolve();
        }

        script.replaceWith(newScript);
    });
}

function registerPageHook(type, callback) {
    const key = getPageKey(window.location.href);

    if (!pageHooks[type][key])
        pageHooks[type][key] = [];

    pageHooks[type][key].push(callback);
}

function runHooks(type, element) {
    const eventName = type === 'processing'
        ? 'runtime:processing'
        : 'runtime:processed';

    const cancelled = !element.dispatchEvent(new Event(eventName, { bubbles: true }));

    if (cancelled)
        return false;

    for (const callback of hooks[type]) {
        const result = callback(element);

        if (type === 'processing' && result === false)
            return false;
    }

    return true;
}

function runPageHooks(type, url) {
    const key = getPageKey(url);
    const callbacks = pageHooks[type][key] || [];

    for (const callback of callbacks) {
        callback();
    }
}