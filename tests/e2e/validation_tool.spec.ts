import { test, expect } from '@playwright/test';

test('Validation Tool E2E', async ({ page }) => {
  test.setTimeout(60000);

  // 1. Login
  await page.goto('http://localhost:5000/?admin=true');
  const passwordInput = page.locator('input[type="password"]');
  try {
      await expect(passwordInput).toBeVisible({ timeout: 5000 });
      await passwordInput.fill('Password1');
      await page.click('button:has-text("Anmelden")');
  } catch (e) {
      console.log('Already logged in or password input not found');
  }

  // Wait for UI to load
  await page.waitForSelector('text=SmartRedirect Suite', { timeout: 15000 });

  // 2. Open Validation Tool
  // Use robust selector
  const globalTab = page.locator('button[role="tab"]').filter({ hasText: 'Global' });
  await globalTab.click();

  const validationBtn = page.locator('button').filter({ hasText: 'Konfigurationsvalidierung' });
  await validationBtn.click();

  // 3. Enter URLs
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
  await textarea.fill(
    'https://smartredirectsuite-pr-323.onrender.com/alte-seite/Subpfad/Suche\n' +
    'https://smartredirectsuite-pr-323.onrender.com/isjndskdjnkds/test.pdf'
  );

  // 4. Start Validation
  await page.click('button:has-text("Validierung starten")');

  // 5. Check Results
  // Wait for table rows
  const rows = page.locator('tbody tr');
  // Wait for at least one row
  await expect(rows.first()).toBeVisible({ timeout: 15000 });

  // Verify we have results
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);

  // Screenshot for visual verification
  await page.screenshot({ path: '/home/jules/verification/e2e_validation.png' });
});
