
import { test, expect } from '@playwright/test';

// Mock authentication
async function login(page) {
  // Simulate successful login response
  await page.route('**/api/admin/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isAuthenticated: true }),
    });
  });

  await page.route('**/api/admin/login', async (route) => {
     await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}

test.describe('WYSIWYG Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Mock settings
    await page.route('**/api/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          headerTitle: "URL Migration Tool",
          popupMode: "inline",
          infoItems: ["Item 1", "Item 2"],
          infoIcons: ["Info", "Bookmark"],
          enableFeedbackSurvey: false,
          maxStatsEntries: 0,
          headerBackgroundColor: "#ffffff",
          alertBackgroundColor: "yellow",
          urlComparisonBackgroundColor: "#ffffff",
          mainBackgroundColor: "#ffffff",
        }),
      });
    });

    // Mock admin settings endpoint
    await page.route('**/api/admin/settings', async (route) => {
      if (route.request().method() === 'PUT') {
        const postData = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(postData),
        });
      } else {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              headerTitle: "URL Migration Tool",
              popupMode: "inline",
              infoItems: ["Item 1", "Item 2"],
              infoIcons: ["Info", "Bookmark"],
              enableFeedbackSurvey: false,
              maxStatsEntries: 0,
              headerBackgroundColor: "#ffffff",
            }),
          });
      }
    });

    // Mock stats endpoints to prevent 404s
    await page.route('**/api/admin/stats/**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
        });
    });

    await page.route('**/api/admin/rules/**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ rules: [], total: 0 }),
        });
    });

    await login(page);
    await page.goto('/');
  });

  async function enterEditMode(page) {
    await page.getByRole('button', { name: 'Administrator-Bereich öffnen' }).click();
    await expect(page.getByText('Allgemeine Einstellungen')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Visueller Editor' }).click();
    await expect(page.getByText('Visual Editor Mode')).toBeVisible();
  }

  test('can edit text inline', async ({ page }) => {
    await enterEditMode(page);

    const headerTitleContainer = page.locator('h1').getByText('URL Migration Tool');
    await expect(headerTitleContainer).toBeVisible();
    await headerTitleContainer.click();

    const input = page.locator('h1 input');
    await expect(input).toBeVisible();

    await input.fill('New Title');
    await input.blur();

    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
  });

  test('can edit icons inline', async ({ page }) => {
    await enterEditMode(page);

    const editableIcon = page.locator('.lucide-pencil').first().locator('..');
    await editableIcon.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Star' }).click();

    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  test('can edit colors inline', async ({ page }) => {
    await enterEditMode(page);

    // Look for a color picker trigger (Palette icon)
    // InlineColor renders a button with a Palette icon
    const colorPickerTrigger = page.locator('button[title="Change Color"]').first();
    await expect(colorPickerTrigger).toBeVisible();
    await colorPickerTrigger.click();

    // Popover should appear
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select a preset color
    // Preset colors are buttons with specific background colors
    // Let's pick one. The preset buttons have title attribute as the color hex
    const presetColor = page.locator('button[title="#dc3545"]'); // Red
    await expect(presetColor).toBeVisible();
    await presetColor.click();

    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  test('can add and remove info items', async ({ page }) => {
    await enterEditMode(page);

    // Find "Add Info Item" button
    const addButton = page.getByRole('button', { name: 'Add Info Item' });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Check if new item item appeared
    // The items are lists of InlineText components.
    // The "Add Info Item" button itself is inside an <li>, so the count of <li> might be items + 1 button.

    // So if we have 2 items, we have 3 <li> (2 items + 1 add button).
    // If we add one, we have 4 <li> (3 items + 1 add button).

    // Selector: list items in the info card
    const listItems = page.locator('.group\\/info ul li');

    // Initially mocked 2 items. So 3 list items.
    // After adding 1, we expect 4 list items.
    await expect(listItems).toHaveCount(4);

    // The 3rd item (index 2) should be the new one.
    // The 4th item (index 3) is the add button.
    const newItem = listItems.nth(2);

    // Check if the new item has the text "New Info Item"
    await expect(newItem).toContainText('New Info Item');

    // Find remove button for the first item
    const firstItem = listItems.first();
    // The remove button has an XCircle icon. The icon is rendered inside the button.
    // We can use a locator for the button that contains the SVG.
    // Note: Lucide icons render as SVGs with specific class names often, but here we can just target the SVG
    // or the button itself.
    // Let's try locating the button by role and then checking for its content or class
    // The button has className="h-6 w-6 p-0 text-destructive opacity-100"

    const removeButton = firstItem.locator('button.text-destructive');
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    // Should be back to 3 list items (2 items + 1 add button)
    await expect(listItems).toHaveCount(3);

    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  test('can toggle popup mode', async ({ page }) => {
    await enterEditMode(page);

    // Look for "Switch to Popup" button
    // It is conditionally rendered. Since we mocked 'inline' mode, it should say "Switch to Popup"
    const switchButton = page.getByRole('button', { name: 'Switch to Popup' });
    await expect(switchButton).toBeVisible();
    await switchButton.click();

    // Now it should switch to 'active' mode (popup)
    // The main dialog should appear
    // We can check if settings updated locally. The button should now say "Switch to Inline" but that button is inside the dialog?
    // In MigrationPage.tsx:
    // {isEditMode && <div className="absolute top-2 right-12 z-50 flex gap-2">... Switch to Inline ...</div>} inside DialogContent

    await expect(page.getByRole('dialog')).toBeVisible();
    const switchToInlineButton = page.getByRole('button', { name: 'Switch to Inline' });
    await expect(switchToInlineButton).toBeVisible();

    await switchToInlineButton.click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();
  });

  test('can discard changes', async ({ page }) => {
      await enterEditMode(page);

      // Make a change
      const headerTitleContainer = page.locator('h1').getByText('URL Migration Tool');
      await headerTitleContainer.click();
      const input = page.locator('h1 input');
      await input.fill('Changed Title');
      await input.blur();

      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeEnabled();

      // Click Discard (X button)
      // Title "Exit / Discard"
      page.on('dialog', dialog => dialog.accept()); // Handle confirmation dialog
      await page.getByRole('button', { name: 'Exit / Discard' }).click();

      // Should exit edit mode
      await expect(page.getByText('Visual Editor Mode')).toBeHidden();

      // Should revert change (visually)
      await expect(page.locator('h1')).toHaveText('URL Migration Tool');
  });
});
