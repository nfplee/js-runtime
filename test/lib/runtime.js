import { createApp } from 'https://unpkg.com/petite-vue?module';

const registry = {};
let app = null;

const pageHooks = {
    enter: {},
    leave: {}
};

/// Events

window.addEventListener('pageshow', e => {
    if (e.persisted)
        pageEnter(window.location.href, true);
});

window.addEventListener('pagehide', e => pageLeave(window.location.href, e.persisted));

/// Public API

export function onPageEnter(callback, {
    skipCache = false
} = {}) {
    registerPageHook('enter', context => {
        if (skipCache && context.fromCache)
            return;

        return callback(context);
    });
}

export function onPageLeave(callback) {
    registerPageHook('leave', callback);
}

export function pageEnter(url, fromCache = false) {
    runPageHooks('enter', url, { fromCache });
}

export function pageLeave(url, fromCache = false) {
    runPageHooks('leave', url, { fromCache });
}

export async function process(element) {
    const cancelled = !element.dispatchEvent(new Event('runtime:processing', { bubbles: true, cancelable: true }));

    if (cancelled)
        return;

    if (element.tagName?.toLowerCase() === 'script')
        await loadScript(element);
    else
        await Promise.all(Array.from(element.querySelectorAll('script')).map(script => loadScript(script)));

    await app.mount(element);

    element.dispatchEvent(new Event('runtime:processed', { bubbles: true }))
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

function runPageHooks(type, url, context) {
    const key = getPageKey(url);
    const callbacks = pageHooks[type][key] || [];

    for (const callback of callbacks) {
        callback(context);
    }
}