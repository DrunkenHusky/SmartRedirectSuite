import assert from "node:assert/strict";
import { traceUrlGeneration } from "../../shared/url-trace";

(() => {
    console.log("Testing traceUrlGeneration with encoded partial match...");

    const rule = {
        redirectType: 'partial',
        matcher: '/unterstuetzung/hrm/lohn,%20versicherungen,%20arbeitszeit,%20absenzen,%20hr-to/',
        targetUrl: '/sites/Intranet-hrm/Lohn,%20Versicherungen,%20Arbeitszeit,%20Absenzen,%20HR-To/',
        discardQueryParams: false,
        keptQueryParams: [],
        staticQueryParams: []
    };

    const requestUrl = '/Unterstuetzung/hrm/Lohn%2c%20Versicherungen%2c%20Arbeitszeit%2c%20Absenzen%2c%20HR-To/Personalverg%c3%bcnstigungen_%20Events%202026.pdf';
    const expectedUrl = '/sites/Intranet-hrm/Lohn,%20Versicherungen,%20Arbeitszeit,%20Absenzen,%20HR-To/Personalverg%c3%bcnstigungen_%20Events%202026.pdf';

    const result = traceUrlGeneration(requestUrl, rule, 'https://example.com');

    // Need to account for the generated domain prefix
    const expectedFullUrl = 'https://example.com' + expectedUrl;

    assert.equal(result.finalUrl, expectedFullUrl, `Expected URL to be ${expectedFullUrl}, but got ${result.finalUrl}`);

    console.log("PASS: traceUrlGeneration with encoded partial match");
})();
