import { onPageLoad, onPageUnload, register } from '../lib/runtime.js';

onPageLoad(() => {
    const saved = sessionStorage.getItem('count');

    if (saved !== null)
        document.getElementById('test').$data.count = saved;
});

onPageUnload(() => {
    sessionStorage.setItem('count', document.getElementById('test').$data.count);
});

register('PageCounter', props => ({
    count: props.initialCount,
    inc() {
        this.count++;
    }
}));