from playwright.sync_api import sync_playwright, expect

def verify_kept_params_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating...")
        page.goto("http://localhost:5000")

        print("Opening Admin...")
        page.locator("button[aria-label='Administrator-Bereich öffnen']").click()

        print("Logging in...")
        page.fill("input[type='password']", "Password1")
        page.click("button:has-text('Anmelden')")

        print("Waiting for Admin...")
        expect(page.locator("text=Administrator-Bereich")).to_be_visible(timeout=10000)

        print("Going to Rules...")
        page.click("button[role='tab']:has-text('Regeln')")

        print("Creating New Rule...")
        page.click("button:has-text('Neue Regel')")

        print("Toggling Discard Params...")
        container = page.locator("div.flex.items-start.space-x-3").filter(has_text="Alle Link-Parameter entfernen").first
        container.locator("button[role='switch']").click()

        print("Checking UI...")
        expect(page.locator("text=Parameter beibehalten (Regex)")).to_be_visible()

        print("Adding Parameter...")
        page.click("button:has-text('Parameter hinzufügen')")

        page.fill("input[placeholder='utm_.*']", "test_key")

        page.screenshot(path="verification_ui.png")
        print("Screenshot saved to verification_ui.png")

        browser.close()

if __name__ == "__main__":
    verify_kept_params_ui()
