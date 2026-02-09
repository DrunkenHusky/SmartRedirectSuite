import { traceUrlGeneration } from '../../client/src/lib/url-trace';

// Mock console.error to avoid noise
console.error = () => {};

try {
    const res = traceUrlGeneration('https://example.com/test', {
        matcher: 'example.com',
        redirectType: 'wildcard',
        discardQueryParams: true,
        keptQueryParams: [{ keyPattern: '.*' }] // Valid kept params
    });
    console.log("Wildcard with kept params: OK");
} catch (e) {
    console.log("Wildcard with kept params: CRASH", e);
}

try {
    const res = traceUrlGeneration('https://example.com/test', {
        matcher: 'example.com',
        redirectType: 'wildcard',
        discardQueryParams: true,
        // keptQueryParams missing or null
    });
    console.log("Wildcard without kept params: OK");
} catch (e) {
    console.log("Wildcard without kept params: CRASH", e);
}

// Test with partial rule
try {
    const res = traceUrlGeneration('https://example.com/test?q=1', {
        matcher: '/test',
        redirectType: 'partial',
        discardQueryParams: true,
        keptQueryParams: [{ keyPattern: '.*' }]
    });
    console.log("Partial with kept params: OK");
} catch (e) {
    console.log("Partial with kept params: CRASH", e);
}
