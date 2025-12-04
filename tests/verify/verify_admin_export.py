from playwright.sync_api import sync_playwright, expect
import time

def verify_admin_export_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Navigate to the home page
            print("Navigating to home page...")
            page.goto("http://localhost:5000", timeout=60000)

            # Click the admin settings icon in the footer
            print("Clicking admin settings icon...")
            settings_button = page.get_by_role("button", name="Administrator-Bereich öffnen")
            settings_button.click()

            # Wait for password modal
            print("Waiting for password modal...")
            page.get_by_text("Administrator-Anmeldung").wait_for()

            # Enter password
            print("Entering password...")
            page.get_by_placeholder("Passwort eingeben").fill("Password1")

            # Click login
            print("Clicking login...")
            page.get_by_role("button", name="Anmelden").click()

            # Wait for admin page to load
            print("Waiting for admin page...")
            # We look for "Administrator-Bereich" which is in the header
            page.get_by_text("Administrator-Bereich").first.wait_for()

            # Click Import/Export tab
            print("Clicking Import/Export tab...")
            # The tab trigger value is 'export', text is 'Import/Export'
            page.get_by_role("tab", name="Import/Export").click()

            # Wait for content to load
            print("Waiting for export tab content...")
            # "System & Statistiken" should be visible
            page.get_by_text("System & Statistiken").wait_for()

            # Verify new section "System & Statistiken" exists
            expect(page.get_by_text("System & Statistiken")).to_be_visible()

            # Verify buttons in "System & Statistiken" section
            print("Verifying buttons...")
            # Use specific locators to ensure we are looking at the right section if possible,
            # but generic text check is also fine for verification.

            expect(page.get_by_role("button", name="Herunterladen (JSON)").nth(1)).to_be_visible() # Settings export
            expect(page.get_by_role("button", name="Importieren (JSON)").nth(1)).to_be_visible() # Settings import
            expect(page.get_by_role("button", name="Herunterladen (CSV)").nth(1)).to_be_visible() # Statistics export

            # Verify buttons in "Standard Import / Export" section
            expect(page.get_by_role("button", name="Herunterladen (Excel)")).to_be_visible()
            expect(page.get_by_role("button", name="Herunterladen (CSV)").first).to_be_visible()

            # Verify buttons in "Erweiterter Regel-Import/Export" section
            expect(page.get_by_role("button", name="Herunterladen (JSON)").first).to_be_visible()
            expect(page.get_by_role("button", name="Importieren (JSON)").first).to_be_visible()

            # Take screenshot
            print("Taking screenshot...")
            page.screenshot(path="verification_admin_export.png", full_page=True)
            print("Screenshot saved to verification_admin_export.png")

        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path="verification_failure.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_export_page()
