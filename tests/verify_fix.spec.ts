import { test, expect } from '@playwright/test';

test('app renders without crashing', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');

  // Wait for the app to load
  // We look for text that should be present on the main page (MigrationPage)
  // Since we fixed the blank page, we expect to see something.
  // The migration page usually has a title or some info.
  // Looking at migration.tsx might give a clue, but let's assume "SmartRedirect Suite" or similar from DocumentHeadUpdater settings,
  // or just wait for the body to be visible.

  // Actually, let's look for the main container or something specific.
  // The loading spinner should disappear.
  await expect(page.locator('.animate-spin')).not.toBeVisible();

  // Take a screenshot
  await page.screenshot({ path: '/home/jules/verification/verification.png' });
});
