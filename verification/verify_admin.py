
import asyncio
from playwright.async_api import async_playwright

async def verify_admin_page():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # We need a context with viewport to test responsive logic if needed,
        # but default 1280x720 is fine for desktop check
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()

        # Navigate to admin page (with admin param to bypass migration page)
        # Note: Port 5000 is used by 'npm run dev' (vite) usually on 5173, but let's check package.json
        # Wait, the user manual says port 5000.
        # But 'npm run dev' usually starts Vite on 5173 or 3000.
        # I should check the output of npm run dev, but I piped it to /dev/null.
        # I'll try 5000 first, then 5173.

        base_url = "http://localhost:5000"

        try:
            print(f"Navigating to {base_url}/?admin=true")
            await page.goto(f"{base_url}/?admin=true")

            # Login
            print("Logging in...")
            await page.fill("input[type=password]", "Password1")
            await page.click("button[type=submit]")

            # Wait for Rules tab to be visible
            print("Waiting for Admin Dashboard...")
            await page.wait_for_selector("text=Administrator-Bereich")

            # Switch to Rules tab
            print("Switching to Rules tab...")
            await page.click("button[value=rules]")

            # Wait for table
            await page.wait_for_selector("table")

            # Check if search input is responsive (fast)
            print("Typing in search box...")
            await page.fill("input[placeholder='Regeln durchsuchen...']", "test")

            # Wait a bit
            await page.wait_for_timeout(1000)

            # Take screenshot
            screenshot_path = "verification/admin_rules_desktop.png"
            await page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

            # Now test Mobile View
            print("Switching to Mobile Viewport...")
            await page.set_viewport_size({"width": 375, "height": 667})
            await page.reload() # Reload to trigger resize listener if needed (though resize event should fire)

            # Wait for content
            await page.wait_for_selector("text=Administrator-Bereich")
            await page.click("button[value=rules]")

            # In mobile view, table should be hidden, cards visible
            # We look for the card container class or structure
            # The RulesCardList renders <div> with border per rule
            # We can check if table is hidden.

            # Take screenshot
            screenshot_path_mobile = "verification/admin_rules_mobile.png"
            await page.screenshot(path=screenshot_path_mobile)
            print(f"Mobile Screenshot saved to {screenshot_path_mobile}")

        except Exception as e:
            print(f"Error: {e}")
            # Try 5173 just in case
            try:
                base_url = "http://localhost:5173"
                print(f"Retrying with {base_url}/?admin=true")
                await page.goto(f"{base_url}/?admin=true")
                await page.fill("input[type=password]", "Password1")
                await page.click("button[type=submit]")
                await page.wait_for_selector("text=Administrator-Bereich")
                await page.click("button[value=rules]")
                await page.wait_for_selector("table")
                await page.screenshot(path="verification/admin_rules_retry.png")
                print("Retry successful")
            except Exception as e2:
                print(f"Retry Error: {e2}")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_admin_page())
