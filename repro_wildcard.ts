import { traceUrlGeneration } from './shared/url-trace';

const rule = {
    redirectType: 'wildcard',
    matcher: '/Produkte/',
    targetUrl: 'https://neueapp.com/products/new',
    discardQueryParams: false
};

const oldUrl = 'https://oldapp.com/Produkte/linkteil/seite.aspx';

const result = traceUrlGeneration(oldUrl, rule);

console.log('Old URL:', result.originalUrl);
console.log('Final URL:', result.finalUrl);
console.log('Expected:', 'https://neueapp.com/products/new');
