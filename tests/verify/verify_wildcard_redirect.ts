import assert from 'node:assert';
import { generateUrlWithRule } from '../../shared/url-trace';

async function verifyWildcardRedirect() {
    console.log('Verifying wildcard redirect fix...');

    // Test 1: Wildcard rule should use targetUrl
    const oldUrl = 'https://example.com/some/path';
    const rule = {
        matcher: '/some/*',
        targetUrl: 'https://new-target.com/landing',
        redirectType: 'wildcard' as const,
        discardQueryParams: true
    };

    const result = generateUrlWithRule(oldUrl, rule);

    if (result.url !== 'https://new-target.com/landing') {
        throw new Error(`Wildcard redirect failed. Expected https://new-target.com/landing, got ${result.url}`);
    }
    console.log('Test 1 (Wildcard) Passed');

    // Test 2: Domain rule should use targetUrl
    const oldUrlDomain = 'https://old-domain.com/path';
    const ruleDomain = {
        matcher: 'old-domain.com',
        targetUrl: 'https://specific-new-domain.com',
        redirectType: 'domain' as const
    };

    const resultDomain = generateUrlWithRule(oldUrlDomain, ruleDomain);

    if (resultDomain.url !== 'https://specific-new-domain.com/path') {
        throw new Error(`Domain redirect failed. Expected https://specific-new-domain.com/path, got ${resultDomain.url}`);
    }
    console.log('Test 2 (Domain) Passed');

    console.log('All verification tests passed.');
}

verifyWildcardRedirect().catch(err => {
    console.error(err);
    process.exit(1);
});
