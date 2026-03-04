import morphdom from 'https://cdn.jsdelivr.net/npm/morphdom@2.7.8/+esm';
import { pageEnter, pageLeave, process } from './runtime.js';

// Set the current url.
let currentUrl = window.location.href;

/// Events

document.addEventListener('click', e => {
    // Get the closest anchor, incase they clicked an element inside the anchor, e.g. span.
    const element = e.target.closest('a');

    if (!element || !isEnabled(e))
        return;

    performAjaxPageLoad(element.href);
});

document.addEventListener('submit', e => {
    if (!(e.target instanceof HTMLFormElement) || !isEnabled(e))
        return;

    performAjaxPageLoad(e.target.action, {
        method: e.target.method,
        body: new FormData(e.target)
    });
});

window.addEventListener('popstate', e => performAjaxPageLoad(window.location.href, {}, e.state ?? {}));

/// Public API

async function performAjaxPageLoad(url, options = {}, popstate = null) {
    const response = await fetch(url, options);

    // Make sure the response is valid.
    if (!response.ok)
        return;

    pageLeave(currentUrl);

    // The response url may be different than the request url, if the server issued a redirect.
    const finalUrl = response.url;

    // Only modify history if this is NOT a popstate navigation.
    if (popstate === null && finalUrl !== currentUrl)
        window.history.pushState({ ajaxNavigation: true }, '', finalUrl);

    // Set the current url.
    currentUrl = finalUrl;

    const contentType = response.headers.get('content-type') || '';

    // If not a HTML response do a full page load.
    if (!contentType.startsWith('text/html')) {
        window.location.href = url;
        return;
    }

    const html = await response.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Set the title.
    document.title = doc.title;

    // Morph the DOM.
    const addedNodes = [];

    morphdom(document.body, doc.body, {
        getNodeKey: node => {
            if (node.nodeType !== Node.ELEMENT_NODE)
                return;

            // This makes sure script tags are not reused, which would cause them to not execute.
            if (node.tagName === 'SCRIPT')
                return node.outerHTML;
        },
        onNodeAdded: node => addedNodes.push(node)
    });

    const addedElements = addedNodes.filter(n => n.nodeType === Node.ELEMENT_NODE);
    const rootAddedElements = addedElements.filter(el => !addedElements.some(parent => parent !== el && parent.contains(el)));

    for (const element of rootAddedElements) {
        await process(element);
    }

    pageEnter(currentUrl);
}

/// Helpers

function isEnabled(e) {
    // Make sure the default action hasn't already been prevented.
    if (e.defaultPrevented)
        return false;

    // Prevent the default action.
    e.preventDefault();

    return true;
}