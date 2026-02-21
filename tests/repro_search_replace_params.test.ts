import { test } from 'node:test';
import assert from 'node:assert';
import { traceUrlGeneration } from '../shared/url-trace';
import { GeneralSettings } from '../shared/schema';

// Mock Settings with S&R
const mockSettings: GeneralSettings = {
    // ... minimal settings
    globalSearchAndReplace: [
        { search: "foo", replace: "bar", caseSensitive: false, id: "global1" }
    ]
} as any;

test('traceUrlGeneration: Search & Replace on Query Parameters (Global)', (t) => {
    const rule: any = {
        matcher: "/test",
        targetUrl: "/target",
        redirectType: "partial",
        discardQueryParams: false // Params kept by default in partial
    };

    const oldUrl = "http://old.com/test?param=foo";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    // Current behavior: param=foo (S&R happens before params are considered/kept)
    // Desired behavior: param=bar
    assert.strictEqual(result.finalUrl, "https://new.com/target?param=bar");
});

test('traceUrlGeneration: Search & Replace on Query Parameters (Rule specific)', (t) => {
    const rule: any = {
        matcher: "/test-rule",
        targetUrl: "/target-rule",
        redirectType: "partial",
        discardQueryParams: false,
        searchAndReplace: [
            { search: "123", replace: "456", caseSensitive: false }
        ]
    };

    const oldUrl = "http://old.com/test-rule?id=123";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    assert.strictEqual(result.finalUrl, "https://new.com/target-rule?id=456");
});

test('traceUrlGeneration: Search & Replace on Forwarded Params (Wildcard)', (t) => {
    const rule: any = {
        matcher: "/wild*",
        targetUrl: "/wild-target",
        redirectType: "wildcard",
        forwardQueryParams: true,
        searchAndReplace: [
            { search: "old", replace: "new", caseSensitive: false }
        ]
    };

    const oldUrl = "http://old.com/wild-stuff?val=old";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    assert.strictEqual(result.finalUrl, "https://new.com/wild-target?val=new");
});

test('traceUrlGeneration: Search & Replace on Kept Params (Partial with Discard)', (t) => {
    const rule: any = {
        matcher: "/partial-discard",
        targetUrl: "/target-discard",
        redirectType: "partial",
        discardQueryParams: true,
        keptQueryParams: [{ keyPattern: "keepme" }],
        searchAndReplace: [
            { search: "old", replace: "new", caseSensitive: false }
        ]
    };

    const oldUrl = "http://old.com/partial-discard?keepme=old&dropme=val";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    // Expect: keepme=new
    assert.strictEqual(result.finalUrl, "https://new.com/target-discard?keepme=new");
});
