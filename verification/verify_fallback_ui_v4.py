import asyncio
from playwright.async_api import async_playwright, expect

async def verify_fallback_settings():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        print("Navigating to admin page...")
        await page.goto("http://localhost:5000/?admin=true")

        # 1. Handle Login
        print("Waiting for login dialog/form...")
        try:
            password_input = page.locator("input[type='password']")
            await expect(password_input).to_be_visible(timeout=10000)

            print("Login form found. Logging in...")
            await password_input.fill("Password1")

            login_button = page.locator("button:has-text('Anmelden')")
            await login_button.click()

        except Exception as e:
            print(f"Login handling failed or skipped: {e}")

        # 2. Wait for Dashboard
        print("Waiting for dashboard content...")
        try:
            await expect(page.get_by_text("Allgemeine Einstellungen")).to_be_visible(timeout=10000)
            print("Dashboard loaded.")
        except:
            print("Dashboard load failed.")
            print(await page.content())
            await page.screenshot(path="verification/dashboard_fail.png")
            raise

        # 3. Find Fallback Settings
        print("Locating Fallback Strategy section...")
        fallback_section = page.get_by_text("Fallback Strategie (Kein Treffer)")
        await expect(fallback_section).to_be_visible()
        await fallback_section.scroll_into_view_if_needed()

        await page.screenshot(path="verification/fallback_settings_default.png")
        print("Screenshot saved: verification/fallback_settings_default.png")

        # 4. Activate Mode B
        print("Activating Mode B...")
        mode_b_card = page.get_by_text("Smart Search Redirect (Mode B)")
        await mode_b_card.click()

        # 5. Verify Inputs appear
        print("Verifying new inputs...")
        search_base_input = page.locator("input[placeholder='https://new-app.com/search?q=']")
        await expect(search_base_input).to_be_visible()

        fallback_msg_input = page.locator("input[placeholder='Kein direkter Treffer gefunden. Wir haben für Sie nach ähnlichen Inhalten gesucht.']")
        await expect(fallback_msg_input).to_be_visible()

        # 6. Fill Inputs
        print("Filling inputs...")
        await search_base_input.fill("https://myshop.com/search?q=")
        await fallback_msg_input.fill("Leider nichts gefunden, aber schau mal hier:")

        await page.screenshot(path="verification/fallback_settings_active.png")
        print("Screenshot saved: verification/fallback_settings_active.png")

        # 7. Save
        print("Saving settings...")
        save_button = page.get_by_role("button", name="Einstellungen speichern")
        await save_button.click()

        # Note: We rely on the toast notification
        await expect(page.get_by_text("Einstellungen gespeichert").first).to_be_visible()
        print("Settings saved successfully.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_fallback_settings())
