import re
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Navigate to admin with query param
        print("Navigating to admin?admin=true...")
        page.goto("http://localhost:5000/admin?admin=true")
        page.wait_for_load_state("networkidle")

        # Check for login
        try:
            password_field = page.get_by_role("textbox", name="Passwort")
            if password_field.is_visible(timeout=3000):
                print("Login form detected. Logging in...")
                password_field.fill("Password1")
                page.get_by_role("button", name="Anmelden").click()
                page.wait_for_url("**/admin**", timeout=5000)
        except:
            print("Login check skipped.")

        # Navigate to Rules tab
        print("Navigating to Rules tab...")
        try:
            # Use strict=False or .first() just in case
            page.get_by_role("tab", name="Regeln").first.click()
        except:
             page.locator("text=Regeln").first.click()

        # Open Validation Modal
        print("Opening Validation Modal...")
        try:
             # Click the button that opens the modal
             page.locator("button:has-text('Validierung')").click()
        except:
             page.locator('button[title="Konfigurationsvalidierung"]').click()

        # Wait for modal title
        print("Waiting for modal...")
        expect(page.get_by_role("heading", name="Konfigurationsvalidierung")).to_be_visible()

        # Enter URL
        try:
            page.locator("text=Text einfügen").click()
        except:
            pass

        page.locator("textarea").fill("https://example.com/test-old-url")

        # Click Start
        print("Starting validation...")
        page.locator("button:has-text('Validierung starten')").click()

        # Wait for results
        print("Waiting for results...")
        page.wait_for_selector("table", timeout=10000)

        # Verify links
        print("Verifying links...")

        # Old URL link
        # Use regex for partial match if needed, but exact href is safer
        old_link = page.locator('a[href="https://example.com/test-old-url"]')
        expect(old_link).to_be_visible()
        expect(old_link).to_have_attribute("target", "_blank")

        class_attr = old_link.get_attribute("class")
        print(f"Old link classes: {class_attr}")
        if "text-blue-600" not in class_attr:
             print("WARNING: text-blue-600 class not found on old link!")
        else:
             print("SUCCESS: text-blue-600 class found.")

        # Take screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification_result.png")

        print("SUCCESS: Verification complete.")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="error.png")
        raise e
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
