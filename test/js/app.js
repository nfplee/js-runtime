import '../lib/ajax-navigation.js';
import { register } from '../lib/runtime.js';

register('$dispatch', (name, argument, bubbles = true, e = event) => {
    e.target.dispatchEvent(new CustomEvent(name, { bubbles: bubbles, detail: argument }));
});