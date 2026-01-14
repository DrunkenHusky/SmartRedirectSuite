import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Collect console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', exception => console.log('PAGE ERROR:', exception));

  try {
    console.log('Navigating to localhost:5000...');
    await page.goto('http://localhost:5000');

    // Wait a bit to let any async JS execute
    await page.waitForTimeout(2000);

    // Check if the page has loaded by looking for a key element
    // Based on migration.tsx, there should be a header with text.
    // Let's check for the footer copyright or header title which uses InlineText

    // Or just check that we don't have the ReferenceError anymore

    await page.screenshot({ path: 'verification/fixed_state.png' });
    console.log('Screenshot taken.');

    // Simple check: title should be available
    const title = await page.title();
    console.log('Page Title:', title);

  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    await browser.close();
  }
})();
