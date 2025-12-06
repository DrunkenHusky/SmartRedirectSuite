
import asyncio
from playwright.async_api import async_playwright

async def verify_admin_page():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Navigate to admin page with admin query param to bypass login redirect if possible
        # Or just login
        await page.goto("http://localhost:5000/?admin=true")

        # Wait for potential login form or main page
        await page.wait_for_timeout(2000)

        # Check if we need to login
        login_header = await page.query_selector("text=Administrator-Anmeldung")
        if login_header:
            print("Logging in...")
            await page.fill("input[type=password]", "Password1") # Default password
            await page.click("button:has-text('Anmelden')")
            await page.wait_for_selector("text=Administrator-Bereich")
            print("Logged in successfully")

        # Navigate to Import/Export tab
        await page.click("button[role='tab']:has-text('Import/Export')")
        await page.wait_for_timeout(1000)

        # Scroll to bottom to see Danger Zone
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(500)

        # Verify "Danger-Zone!" title
        danger_zone = await page.query_selector("text=Danger-Zone!")
        if danger_zone:
            print("Found 'Danger-Zone!' section")
        else:
            print("ERROR: 'Danger-Zone!' section not found")

        # Verify "Alle Regeln löschen" button
        delete_btn = await page.query_selector("button:has-text('Alle Regeln löschen')")
        if delete_btn:
            print("Found 'Alle Regeln löschen' button")
            # Click to open dialog
            await delete_btn.click()
            await page.wait_for_selector("text=Alle Regeln löschen?")
            print("Dialog opened")

            # Type DELETE
            await page.fill("input[placeholder*='DELETE']", "DELETE")

            # Take screenshot of dialog
            await page.screenshot(path="verification/delete_dialog.png")
            print("Screenshot saved to verification/delete_dialog.png")

            # Close dialog
            await page.click("button:has-text('Abbrechen')")
        else:
            print("ERROR: 'Alle Regeln löschen' button not found")
            await page.screenshot(path="verification/missing_button.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_admin_page())
