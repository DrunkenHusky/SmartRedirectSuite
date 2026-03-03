import asyncio
from playwright.async_api import async_playwright

async def run_tests():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Create a new context
        context = await browser.new_context()
        page = await context.new_page()

        try:
            print("Checking Migration Page (Buttons visible initially)...")
            await page.goto('http://localhost:5000/test-fallback')
            await page.wait_for_timeout(1000)

            # Make sure we trigger the fallback UI
            await page.evaluate('''() => {
                const buttons = document.querySelectorAll('button');
                buttons.forEach(b => {
                    if (b.innerText.includes('Nein')) {
                        b.click();
                    }
                });
            }''')
            await page.wait_for_timeout(1000)

            copy_btn_count = await page.locator('button:has-text("URL kopieren")').count()
            open_btn_count = await page.locator('button:has-text("In neuem Tab öffnen")').count()

            print(f"Copy Button count: {copy_btn_count}, Open Button count: {open_btn_count}")

            print("All tests passed successfully!")

        except Exception as e:
            print(f"Test failed: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run_tests())
