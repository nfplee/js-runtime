# js-runtime

JavaScript runtime and optional AJAX navigation library. The runtime was built to solve two common problems:

- Make working with lightweight reactive view libraries such as `petite-vue` more ergonomic, with no need to wait for app instances to mount and with simpler component registration.
- Provide a consistent way to write JavaScript that works whether AJAX navigation is enabled or not.

See https://www.leetimmins.com/blog/building-a-javascript-runtime-for-ajax-navigation-and-traditional-page-loads.htm for more information.

## Vue Integration

Component registration happens before the app is mounted, which means modules can register components up front and the runtime can then mount the app with the complete registry.

```js
import { register } from './runtime.js';
import Counter from './components/counter.js';

register('Counter', Counter);
```

## Getting Started

In modern frameworks, JavaScript modules (`<script type="module">`) are now the entry point for writing JavaScript. They have a few important advantages:

- They wait until the DOM is ready before running.
- They only execute once, no matter how many times they are referenced.
- They make it easy to import code from other libraries.

That solves part of the problem, but not all of it. In many applications the HTML is not truly static and may be replaced or inserted at runtime. Event delegation can help when you are attaching a listener to an element that already exists and will continue to exist, such as `document`:

```js
document.addEventListener('click', e => {
    if (!e.target.closest('[data-action="delete"]')) return;

    // Handle click.
});
```

This works because `document` exists when the code runs, and the delegated handler can react to matching descendants that are added later. But it only solves that event-listening case: module scripts and DOM lookups such as `querySelector()` still only work with the elements that exist when they run, so later HTML updates from AJAX navigation or dynamic content insertion need a different approach.

The runtime introduces page hooks and load hooks to make this easier. These hooks let you write initialization code once and have it behave correctly across normal page loads, AJAX navigation, and dynamically added HTML. They also wait until the DOM has mounted before they run, which helps avoid timing problems when working with Vue state.

Once the runtime is configured, you can use the hooks it provides to initialize and manage behavior at the right point in the page lifecycle:

- Use page hooks when behavior should run each time a page navigation occurs.
- Use load hooks when behavior should run for DOM that has just been mounted, whether that is on initial load or after it has been processed, e.g. after it is dyanmically inserted.

## Page Hooks

Page hooks are registered against the module that is executing when they are declared. In practice, that means a module script can register page hooks once and those hooks will automatically apply on any page that includes that module.

Register page hooks from module files, not from inline scripts. Inline scripts, including inline module scripts, are executed each time they are encountered during AJAX navigation, so hooks declared there will be registered again on every visit.

Use static module loading when you want to pull in a file that registers hooks. Both of the following work:

```html
<script type="module" src="/js/page.js"></script>
```

```js
import '/js/page.js';
```

Avoid using a dynamic import for hook registration:

```js
import('/js/page.js');
```

A dynamically imported module is asynchronous, so its hook registration is not guaranteed to happen before the initial hook phases run. Even `await import('/js/page.js')` does not guarantee that the imported module has registered its hooks before those lifecycle events have already been triggered.

If a page includes the module, its page hooks will run on the initial page load and on later AJAX navigations to other pages that also include that same module. `onPageLoad()` and `onPageUnload()` therefore follow page navigation, not module addition and removal. `onPageUnload()` is useful for persistence or other non-DOM cleanup. If the DOM is being replaced, element-bound listeners usually do not need explicit teardown.

These hooks run for standard page loads and enhanced AJAX navigations. `onPageLoad()` runs after the page DOM has been mounted, so it is safe to work with mounted Vue state and DOM produced by Vue.

`onPageLoad()` receives an `isCacheRestore` boolean. It is `true` when the page was restored from the browser back-forward cache (bfcache) and `false` for normal loads and AJAX navigations. By default, `onPageLoad()` skips bfcache restores. This helps avoid re-attaching DOM event handlers on pages restored from the browser cache.

```js
onPageLoad(() => {
    document.getElementById('foo').addEventListener('change', ...);
});
```

If you want the callback to also run on bfcache restores, set `includeCacheRestore: true`:

```js
onPageLoad(context => {
    if (context.isCacheRestore) {
        ...
    }
}, { includeCacheRestore: true });
```

## Dynamic HTML

`onLoad()` runs for both the HTML present on the initial page load and any HTML added dynamically later, so you can safely work with the DOM in either case. It also runs after the runtime has mounted, so you can safely access Vue state inside the callback.

```js
import { onLoad } from 'runtime';

onLoad(context => {
    context.querySelectorAll('.slug').forEach(slug => {
        ...
    });
});
```

If you manually add an HTML block after startup and want the runtime to process it, call `process()` for that root element.

```js
import { process } from './runtime.js';

const element = document.getElementById('new-content');
await process(element);
```

## AJAX Navigation

AJAX navigation is optional. The runtime works without it, and standard browser navigation will continue to behave normally unless you also load the AJAX navigation library.

## Testing

```
npm test
```