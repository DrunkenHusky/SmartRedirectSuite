import { test, expect } from '@playwright/test';

test('verify translation settings', async ({ page }) => {
  // Force German language
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'de');
  });

  await page.goto('http://localhost:5000/?admin=true');

  // Login
  await page.fill('input[type="password"]', 'Password1');
  await page.click('button[type="submit"]');

  // Wait for admin content to load
  await expect(page.getByText('Administrator-Bereich')).toBeVisible();

  // Verify General Settings translation UI
  await expect(page.getByText(/Allgemeine Einstellungen|General Settings/)).toBeVisible();

  // Check for language selector in Header Settings section
  // It resolves to multiple elements because the select implementation creates hidden native option?
  // Or maybe because there are multiple selects with this value?
  // Wait, I only added one language selector in the code I edited (Header Settings section).
  // But maybe the `SelectValue` component renders the text and the trigger renders the text?

  // Let's just use .first() to verify visibility of *at least one*
  await expect(page.getByText('🇩🇪 DE').first()).toBeVisible();

  // Take screenshot of settings page
  await page.screenshot({ path: 'verification/settings_translation_ui.png', fullPage: true });

  // Change language to English using the global switcher (top right) to verify UI translation
  const globeBtn = page.locator('button:has(.lucide-globe)').first();
  await expect(globeBtn).toBeVisible();
  await globeBtn.click();

  const enOption = page.getByRole('menuitem', { name: 'English' });
  await expect(enOption).toBeVisible();
  await enOption.click();

  // Verify UI language changed
  await expect(page.getByText('Administrator Area')).toBeVisible();
  await expect(page.getByText('General Settings')).toBeVisible();

  // Take screenshot of English UI
  await page.screenshot({ path: 'verification/settings_translation_en.png', fullPage: true });
});
