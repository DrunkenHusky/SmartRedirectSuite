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

    // Wait a bit to let any async JS execute and potentially fail
    await page.waitForTimeout(2000);

    // Take a screenshot
    await page.screenshot({ path: 'verification/error_state.png' });
    console.log('Screenshot taken.');

  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    await browser.close();
  }
})();
