import { onPageEnter, onPageLeave, register } from '../lib/runtime.js';

onPageEnter(() => {
    const saved = sessionStorage.getItem('count');

    if (saved !== null)
        document.getElementById('test').$data.count = saved;
}, { skipCache: true });

onPageLeave(() => {
    sessionStorage.setItem('count', document.getElementById('test').$data.count);
});

register('PageCounter', props => ({
    count: props.initialCount,
    inc() {
        this.count++;
    }
}));