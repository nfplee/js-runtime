import { createApp } from 'https://unpkg.com/petite-vue?module';

const registry = {};
let app = null;

const hooks = {
    load: []
};

const pageHooks = {
    load: {},
    unload: {}
};

/// Events

window.addEventListener('pageshow', e => {
    if (e.persisted)
        pageLoad(window.location.href, true);
});

window.addEventListener('pagehide', e => pageUnload(window.location.href, e.persisted));

/// Public API

export function onLoad(callback) {
    hooks.load.push(callback);
}

export function onPageLoad(callback, {
    includeCacheRestore = false
} = {}) {
    registerPageHook('load', context => {
        if (!includeCacheRestore && context.isCacheRestore)
            return;

        return callback(context);
    });
}

export function onPageUnload(callback) {
    registerPageHook('unload', callback);
}

export function pageLoad(url, isCacheRestore = false) {
    runPageHooks('load', { url, isCacheRestore });
}

export function pageUnload(url, isCacheRestore = false) {
    runPageHooks('unload', { url, isCacheRestore });
}

export async function process(element) {
    if (element.tagName?.toLowerCase() === 'script')
        await loadScript(element);
    else
        await Promise.all(Array.from(element.querySelectorAll('script')).map(script => loadScript(script)));

    await app.mount(element);

    runHooks('load', { element });
}

export function register(name, factory) {
    registry[name] = factory;
}

export async function start() {
    app = createApp(registry);
    await app.mount();
    
    runHooks('load', { element: document });

    pageLoad(window.location.href);
}

/// Helpers

export function getActiveModuleKeys() {
    return [...new Set([...document.querySelectorAll('script[type="module"][src]')]
        .map(script => script?.src)
        .filter(Boolean))];
}

function inferActiveModuleKey() {
    const activeKeys = new Set(getActiveModuleKeys());

    if (activeKeys.size === 0)
        return null;

    const stack = new Error().stack;

    if (!stack)
        return null;

    return (stack.match(/https?:\/\/[^\s)\]]+/g) || [])
        .map(match => match.replace(/:\d+(?::\d+)?$/, ''))
        .find(key => activeKeys.has(key)) ?? null;
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
                const code = script.textContent;
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
    const key = inferActiveModuleKey();

    if (!key)
        throw new Error('Page hooks must be registered from a module script.');

    if (!pageHooks[type][key])
        pageHooks[type][key] = [];

    pageHooks[type][key].push(callback);
}

function runHooks(type, context) {
    for (const callback of hooks[type]) {
        callback(context);
    }
}

function runPageHooks(type, context) {
    const callbacks = new Set(getActiveModuleKeys().flatMap(key => pageHooks[type][key] || []));

    for (const callback of callbacks) {
        callback(context);
    }
}