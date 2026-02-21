import { test } from 'node:test';
import assert from 'node:assert';
import { traceUrlGeneration } from '../../shared/url-trace';
import { GeneralSettings } from '../../shared/schema';

// Mock Settings
const mockSettings: GeneralSettings = {
    id: "uuid",
    defaultNewDomain: "https://new.com",
    defaultRedirectMode: "domain",
    caseSensitiveLinkDetection: false,
    headerTitle: "Header",
    mainTitle: "Main",
    mainDescription: "Desc",
    urlComparisonTitle: "Comparison",
    oldUrlLabel: "Old",
    newUrlLabel: "New",
    copyButtonText: "Copy",
    openButtonText: "Open",
    showUrlButtonText: "Show",
    popupButtonText: "Popup",
    specialHintsTitle: "Hints",
    specialHintsDescription: "Hints Desc",
    infoTitle: "Info",
    infoItems: [],
    infoIcons: [],
    footerCopyright: "Footer",
    matchHighExplanation: "High",
    matchMediumExplanation: "Medium",
    matchLowExplanation: "Low",
    matchRootExplanation: "Root",
    matchNoneExplanation: "None",
    feedbackSurveyTitle: "Survey",
    feedbackSurveyQuestion: "Question",
    feedbackSuccessMessage: "Success",
    feedbackButtonYes: "Yes",
    feedbackButtonNo: "No",
    updatedAt: new Date().toISOString(),
    alertIcon: "AlertTriangle",
    alertBackgroundColor: "yellow",
    headerBackgroundColor: "#ffffff",
    mainBackgroundColor: "#ffffff",
    urlComparisonBackgroundColor: "#ffffff",
    popupMode: "active",
    defaultSearchMessage: "Redirecting...",
    defaultSearchSkipEncoding: false,
    encodeImportedUrls: true,
    autoRedirect: false,
    showLinkQualityGauge: true,
    enableTrackingCache: true,
    maxStatsEntries: 0,
    enableReferrerTracking: true,
    enableFeedbackSurvey: false,
    enableFeedbackComment: false,
    feedbackCommentTitle: "Comment",
    feedbackCommentDescription: "Desc",
    feedbackCommentPlaceholder: "...",
    feedbackCommentButton: "Submit",
    enableFeedbackSmartSearchFallback: false,
    feedbackSmartSearchFallbackTitle: "Fallback",
    feedbackSmartSearchFallbackDescription: "Desc",
    feedbackSmartSearchFallbackQuestion: "Question",
    showSatisfactionTrend: true,
    satisfactionTrendFeedbackOnly: false,
    satisfactionTrendDays: 30,
    globalSearchAndReplace: [],
    globalStaticQueryParams: [],
    globalKeptQueryParams: [],
    smartSearchRules: []
};

test('traceUrlGeneration: Wildcard Redirect (Full Replacement)', (t) => {
    const rule: any = {
        matcher: "/blog/*",
        targetUrl: "/news",
        redirectType: "wildcard",
        forwardQueryParams: false,
        discardQueryParams: false
    };

    const oldUrl = "http://old.com/blog/article-123";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    // Expecting full replacement of /blog/article-123 with /news
    // Suffix "article-123" should NOT be appended
    assert.strictEqual(result.finalUrl, "https://new.com/news");
});

test('traceUrlGeneration: Domain Redirect', (t) => {
    const rule: any = {
        matcher: "old-domain.com",
        targetUrl: "https://brand-new.com",
        redirectType: "domain"
    };

    const oldUrl = "http://old-domain.com/some/path";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    // Domain redirect should preserve path
    assert.strictEqual(result.finalUrl, "https://brand-new.com/some/path");
});

test('traceUrlGeneration: Wildcard Prefix (Full Replacement)', (t) => {
    const rule: any = {
        matcher: "/old*",
        targetUrl: "/new",
        redirectType: "wildcard"
    };

    const oldUrl = "http://old.com/oldstuff";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    // Expecting full replacement
    assert.strictEqual(result.finalUrl, "https://new.com/new");
});

test('traceUrlGeneration: Case-Insensitive Wildcard Match', (t) => {
    const rule: any = {
        matcher: "/news-center/news/lists/beitraege/post.aspx?id=2327",
        targetUrl: "https://intranetnew.lolo.com/sites/Intranet-News/Lists/Beitraege/ViewPost.aspx?ID=1",
        redirectType: "wildcard",
        discardQueryParams: false
    };

    const oldUrl = "https://smartredirectsuite.onrender.com/News-Center/News/Lists/Beitraege/Post.aspx?ID=2327";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    assert.strictEqual(result.finalUrl, "https://intranetnew.lolo.com/sites/Intranet-News/Lists/Beitraege/ViewPost.aspx?ID=1");
});

test('traceUrlGeneration: Wildcard with Forward Query Params', (t) => {
    const rule: any = {
        matcher: "/products/",
        targetUrl: "/new-products",
        redirectType: "wildcard",
        forwardQueryParams: true,
        discardQueryParams: false
    };

    const oldUrl = "http://old.com/products/item?id=123&ref=test";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    // Expect full replacement (/products/item -> /new-products) BUT with query params preserved
    assert.strictEqual(result.finalUrl, "https://new.com/new-products?id=123&ref=test");
});

test('traceUrlGeneration: Wildcard with Discard Query Params', (t) => {
    const rule: any = {
        matcher: "/products/",
        targetUrl: "/new-products",
        redirectType: "wildcard",
        forwardQueryParams: false,
        discardQueryParams: true
    };

    const oldUrl = "http://old.com/products/item?id=123&ref=test";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    // Expect full replacement and NO query params
    assert.strictEqual(result.finalUrl, "https://new.com/new-products");
});
