
import { test, expect } from '@playwright/test';

test('verify referrer tracking and display', async ({ page }) => {
  test.setTimeout(60000); // Increase timeout

  // 1. Visit the main page with a referrer (simulate via script injection or direct property)
  // Since we cannot easily spoof referrer in a simple goto, we can try to set it via CDP or just assume browser handles it if we navigate.
  // But easier: we can manually call the tracking API from the console to simulate a visit with referrer.

  await page.goto('http://localhost:5000');

  // Simulate a tracking event with a specific referrer
  await page.evaluate(async () => {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldUrl: "http://localhost:5000/test-referrer",
        newUrl: "http://localhost:5000/target",
        path: "/test-referrer",
        timestamp: new Date().toISOString(),
        userAgent: "Playwright Test",
        referrer: "https://example-referrer.com/some/page",
        matchQuality: 100,
      }),
    });
  });

  // 2. Login to Admin Panel
  // We need to bypass the initial page or go directly to admin
  await page.goto('http://localhost:5000/?admin=true');

  // Wait for login form
  await page.waitForSelector('input[type="password"]');
  await page.fill('input[type="password"]', 'Password1');
  await page.click('button[type="submit"]');

  // Wait for admin dashboard
  await page.waitForSelector('text=Administrator-Bereich');

  // 3. Switch to Statistics Tab
  // Use getByRole for tab
  await page.getByRole('tab', { name: 'Statistiken' }).click();

  // 4. Check "Top Referrer" card
  // Switch to Top 100 view if not active (default)
  // Wait a bit for tab switch
  await page.waitForTimeout(1000);

  const top100Button = page.getByRole('button', { name: 'Top 100' });
  if (await top100Button.count() > 0 && await top100Button.getAttribute('data-state') !== 'active') {
      await top100Button.click();
  }

  // Verify "Top Referrer" card exists
  await expect(page.getByText('Top Referrer')).toBeVisible();

  // Verify our referrer domain is listed
  // The backend extracts domain: example-referrer.com
  // Use first() if multiple found (e.g. table header vs content, though domain usually appears in content)
  await expect(page.getByText('example-referrer.com').first()).toBeVisible();

  // 5. Switch to "Alle Einträge" (Browser view)
  await page.getByRole('button', { name: 'Alle Einträge' }).click();

  // 6. Verify "Referrer" column in table
  await expect(page.getByText('Referrer', { exact: true })).toBeVisible();

  // Verify the referrer entry in the table
  // Use first() to handle multiple occurrences if strict mode fails
  await expect(page.getByText('https://example-referrer.com/some/page').first()).toBeVisible();

  // Take screenshot
  await page.screenshot({ path: 'verification/referrer-stats.png', fullPage: true });
});
