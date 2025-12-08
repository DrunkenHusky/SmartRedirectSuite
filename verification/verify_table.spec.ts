
import { test, expect, chromium } from '@playwright/test';

test('Verify Alle Einträge table layout', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 0. Generate a tracking entry
    // Visit a random page to trigger MigrationPage and tracking
    console.log('Visiting random page to generate stats...');
    await page.goto('http://localhost:5000/test-tracking-entry-' + Date.now());
    // Wait for migration page content to ensure tracking request fired
    await expect(page.locator('body')).not.toBeEmpty();
    // Give it a moment for the async tracking to persist
    await page.waitForTimeout(2000);

    // 1. Authenticate (login)
    console.log('Logging in...');
    await page.goto('http://localhost:5000/?admin=true');
    await page.fill('input[type="password"]', 'Password1'); // Default password
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await expect(page.getByText('Administrator-Bereich')).toBeVisible();

    // 2. Navigate to "Statistiken" tab
    console.log('Navigating to Stats tab...');
    await page.getByRole('tab', { name: 'Statistiken' }).click();

    // 3. Switch to "Alle Einträge" view
    console.log('Switching to Alle Einträge...');
    await page.getByRole('button', { name: 'Alle Einträge' }).click();

    // 4. Verify table headers exist and have style width
    console.log('Verifying table headers...');
    const timeButton = page.getByRole('button', { name: 'Zeitstempel' });
    await expect(timeButton).toBeVisible();

    // Get the parent TH element
    const thElement = timeButton.locator('xpath=./ancestor::th');

    // Check if the style attribute is present on TH (indicating dynamic width)
    const styleAttribute = await thElement.getAttribute('style');
    console.log('Time Header Style:', styleAttribute);
    if (!styleAttribute || !styleAttribute.includes('width')) {
      throw new Error('Header does not have dynamic width style!');
    }

    // Verify ResizeHandle exists
    const childrenCount = await thElement.evaluate(el => el.childElementCount);
    console.log('TH Children count:', childrenCount);
    expect(childrenCount).toBeGreaterThanOrEqual(2);

    // 5. Screenshot
    await page.screenshot({ path: 'verification/alle_eintraege_table.png', fullPage: true });

  } catch (e) {
    console.error(e);
    await page.screenshot({ path: 'verification/error.png' });
    throw e;
  } finally {
    await browser.close();
  }
});
