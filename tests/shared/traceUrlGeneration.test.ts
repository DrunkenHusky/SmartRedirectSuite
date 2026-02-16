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

test('traceUrlGeneration: Wildcard Redirect', (t) => {
    const rule: any = {
        matcher: "/blog/*",
        targetUrl: "/news",
        redirectType: "wildcard",
        forwardQueryParams: false,
        discardQueryParams: false
    };

    const oldUrl = "http://old.com/blog/article-123";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    assert.strictEqual(result.finalUrl, "https://new.com/news/article-123");
});

test('traceUrlGeneration: Domain Redirect', (t) => {
    const rule: any = {
        matcher: "old-domain.com",
        targetUrl: "https://brand-new.com",
        redirectType: "domain"
    };

    const oldUrl = "http://old-domain.com/some/path";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    assert.strictEqual(result.finalUrl, "https://brand-new.com/some/path");
});

test('traceUrlGeneration: Wildcard Prefix', (t) => {
    const rule: any = {
        matcher: "/old*",
        targetUrl: "/new",
        redirectType: "wildcard"
    };

    const oldUrl = "http://old.com/oldstuff";
    const result = traceUrlGeneration(oldUrl, rule, "https://new.com", mockSettings);

    assert.strictEqual(result.finalUrl, "https://new.com/newstuff");
});
