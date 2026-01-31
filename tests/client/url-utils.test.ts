
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
