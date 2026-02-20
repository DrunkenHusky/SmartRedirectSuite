import { traceUrlGeneration } from './shared/url-trace';

const rule = {
    redirectType: 'wildcard',
    matcher: '/Produkte/',
    targetUrl: 'https://neueapp.com/products/new',
    discardQueryParams: false,
    forwardQueryParams: true
};

const oldUrl = 'https://oldapp.com/Produkte/linkteil/seite.aspx?id=123&ref=google';

const result = traceUrlGeneration(oldUrl, rule);

console.log('Old URL:', result.originalUrl);
console.log('Final URL:', result.finalUrl);
console.log('Expected:', 'https://neueapp.com/products/new?id=123&ref=google');
