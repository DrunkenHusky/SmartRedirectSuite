import asyncio
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:5000"

async def verify_redirect():
    async with async_playwright() as p:
        # API Context for setup
        api_request = await p.request.new_context(base_url=BASE_URL)

        print("Logging in via API...")
        login = await api_request.post("/api/admin/login", data={"password": "Password1"})
        assert login.ok, f"Login failed: {login.status} {await login.text()}"

        print("Fetching current settings...")
        settings_res = await api_request.get("/api/settings")
        assert settings_res.ok
        settings = await settings_res.json()

        print("Updating settings to Mode B with Auto-Redirect...")

        # Clean settings for update (remove system fields)
        clean_settings = {k: v for k, v in settings.items() if k not in ["id", "updatedAt"]}

        # Apply test configuration
        clean_settings.update({
            "fallbackStrategy": "search",
            "searchBaseUrl": "https://duckduckgo.com/?q=",
            "fallbackMessage": "Redirecting to search...",
            "autoRedirect": True  # Enable auto-redirect to trigger navigation
        })

        update = await api_request.put("/api/admin/settings", data=clean_settings)
        if not update.ok:
             print(f"Update failed: {update.status} {await update.text()}")
             return

        print("Settings configured.")

        # Browser verification
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        target_path = "/products/shoes/nike-air"
        expected_url = "https://duckduckgo.com/?q=nike-air"

        print(f"Navigating to {target_path}...")
        try:
            # We expect a navigation to the external URL
            # Note: We must wait for the load state because it's an external redirect
            await page.goto(f"{BASE_URL}{target_path}")

            # Wait for the specific URL pattern
            await page.wait_for_url(expected_url, timeout=15000, wait_until="commit")

            print(f"Verified redirect to: {page.url}")

        except Exception as e:
            print(f"Verification failed: {e}")
            print(f"Final URL: {page.url}")
            # If we are still on localhost, dump content to see if there's an error message
            if BASE_URL in page.url:
                 content = await page.content()
                 print("Page Content (Snippet):", content[:500])

            await page.screenshot(path="verification/runtime_fail.png")
            raise

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_redirect())
