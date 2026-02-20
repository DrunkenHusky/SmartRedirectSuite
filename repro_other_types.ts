import { traceUrlGeneration } from './shared/url-trace';
import { GeneralSettings } from './shared/schema';

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

// Test Partial (Match Prefix + Keep Suffix)
const partialRule = {
    redirectType: 'partial',
    matcher: '/old-section',
    targetUrl: '/new-section',
    discardQueryParams: false
};
const oldPartialUrl = 'https://oldapp.com/old-section/article/123';
const resultPartial = traceUrlGeneration(oldPartialUrl, partialRule, "https://new.com", mockSettings);

console.log('--- Partial Redirect ---');
console.log('Old URL:', resultPartial.originalUrl);
console.log('Final URL:', resultPartial.finalUrl);
if (resultPartial.finalUrl === 'https://new.com/new-section/article/123') {
    console.log('Result: PASS');
} else {
    console.log('Result: FAIL (Expected https://new.com/new-section/article/123)');
}

// Test Domain (Replace Domain Only)
const domainRule = {
    redirectType: 'domain',
    matcher: 'oldapp.com',
    targetUrl: 'https://brand-new-domain.com',
    discardQueryParams: false
};
const oldDomainUrl = 'https://oldapp.com/any/path/here?q=1';
const resultDomain = traceUrlGeneration(oldDomainUrl, domainRule, "https://new.com", mockSettings);

console.log('\n--- Domain Redirect ---');
console.log('Old URL:', resultDomain.originalUrl);
console.log('Final URL:', resultDomain.finalUrl);
if (resultDomain.finalUrl === 'https://brand-new-domain.com/any/path/here?q=1') {
    console.log('Result: PASS');
} else {
    console.log('Result: FAIL (Expected https://brand-new-domain.com/any/path/here?q=1)');
}
