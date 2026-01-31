
import { extractSearchTerm } from "../../client/src/lib/url-utils";

console.log("Running Smart Search Verification...");

// Mock rules
const rules = [
    {
        pattern: '[?&]file=([^&]+)',
        order: 0,
        searchUrl: 'https://newapp.com/?q=',
        pathPattern: '/teams'
    },
    {
        pattern: '[?&]q=([^&]+)',
        order: 1,
        searchUrl: null,
        pathPattern: null
    },
    {
        pattern: '', // Empty pattern - should use last segment logic
        order: 2,
        searchUrl: 'https://newapp.com/docs?q=',
        pathPattern: '/docs'
    },
    {
        pattern: undefined, // Undefined pattern - should use last segment logic
        order: 3,
        searchUrl: 'https://newapp.com/kb?search=',
        pathPattern: '/kb'
    },
    {
        pattern: '[?&]raw=([^&]+)',
        order: 4,
        searchUrl: 'https://newapp.com/raw?q=',
        pathPattern: null,
        skipEncoding: true
    }
];

const testCases = [
    {
        name: "Custom Search URL + Path Matcher (Match)",
        url: "https://oldurtl.com/teams/sjdodjods.aspx?variable=1&file=important.doc",
        expectedSearchTerm: "important.doc",
        expectedSearchUrl: "https://newapp.com/?q="
    },
    {
        name: "Custom Search URL + Path Matcher (No Path Match)",
        url: "https://oldurtl.com/other/page.aspx?file=important.doc",
        expectedSearchTerm: "page.aspx", // Fallback to last segment because regexs didn't match (first due to path, second due to pattern)
        expectedSearchUrl: null
    },
     {
        name: "Regular Rule (Match)",
        url: "https://oldurtl.com/anywhere?q=something",
        expectedSearchTerm: "something",
        expectedSearchUrl: null
    },
    {
        name: "No Match (Fallback)",
        url: "https://oldurtl.com/teams/page.aspx",
        expectedSearchTerm: "page.aspx", // Fallback to last segment
        expectedSearchUrl: null
    },
    {
        name: "Empty Pattern + Path Matcher (Match)",
        url: "https://oldurtl.com/docs/manual.pdf",
        expectedSearchTerm: "manual.pdf",
        expectedSearchUrl: "https://newapp.com/docs?q="
    },
    {
        name: "Undefined Pattern + Path Matcher (Match)",
        url: "https://oldurtl.com/kb/article-123",
        expectedSearchTerm: "article-123",
        expectedSearchUrl: "https://newapp.com/kb?search="
    },
    {
        name: "Skip Encoding Rule (Match)",
        url: "https://oldurtl.com/anywhere?raw=some%20value",
        expectedSearchTerm: "some value", // Should be decoded
        expectedSearchUrl: "https://newapp.com/raw?q=",
        expectedSkipEncoding: true
    },
    {
        name: "Encoded Path Segment (Should Decode)",
        url: "https://oldurtl.com/docs/manual%20v1.pdf",
        expectedSearchTerm: "manual v1.pdf",
        expectedSearchUrl: "https://newapp.com/docs?q="
    }
];

let failed = false;

for (const tc of testCases) {
    try {
        console.log(`Testing: ${tc.name}`);
        const result = extractSearchTerm(tc.url, rules);

        // Check search term
        if (result.searchTerm !== tc.expectedSearchTerm) {
            throw new Error(`Expected searchTerm '${tc.expectedSearchTerm}', got '${result.searchTerm}'`);
        }

        // Check search URL
        // extractSearchTerm returns searchUrl: string | null.
        const actualSearchUrl = result.searchUrl || null;
        if (actualSearchUrl !== tc.expectedSearchUrl) {
             throw new Error(`Expected searchUrl '${tc.expectedSearchUrl}', got '${actualSearchUrl}'`);
        }

        // Check skipEncoding
        if ((tc as any).expectedSkipEncoding !== undefined) {
             if (result.skipEncoding !== (tc as any).expectedSkipEncoding) {
                 throw new Error(`Expected skipEncoding '${(tc as any).expectedSkipEncoding}', got '${result.skipEncoding}'`);
             }
        }

        console.log("  PASS");
    } catch (e: any) {
        console.error(`  FAIL: ${e.message}`);
        failed = true;
    }
}

if (failed) {
    process.exit(1);
} else {
    console.log("All tests passed!");
}
