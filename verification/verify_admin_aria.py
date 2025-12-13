from playwright.sync_api import sync_playwright, expect
import time

def verify_admin_aria():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a new context with a larger viewport
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        try:
            # Login to Admin
            print("Navigating to admin login...")
            page.goto("http://localhost:5000/?admin=true")

            # Wait for login form
            page.wait_for_selector("input[type='password']")

            # Fill password
            print("Filling password...")
            page.fill("input[type='password']", "Password1")
            page.click("button[type='submit']")

            # Wait for admin dashboard
            print("Waiting for dashboard...")
            page.wait_for_selector("text=Administrator-Bereich")

            # 1. Verify Rules Search Input aria-label
            # Rules tab is default, but let's click it to be sure
            print("Navigating to Rules tab...")
            # Use text content instead of value attribute since Radix UI might manage attributes differently
            page.click("button:has-text('Regeln')")

            # Wait for content
            page.wait_for_selector("text=URL-Transformationsregeln")

            print("Verifying Rules Search Input...")
            rules_search = page.locator('input[aria-label="Regeln durchsuchen"]')
            expect(rules_search).to_be_visible()
            print("✅ Rules Search Input found with aria-label")

            # 2. Verify Stats Search Input aria-label
            # Click Stats tab
            print("Navigating to Stats tab...")
            page.click("button:has-text('Statistiken')")

            # Switch to Browser view (Alle Einträge) to see the search input
            # Wait for tab content
            page.wait_for_selector("button:has-text('Alle Einträge')")
            page.click("button:has-text('Alle Einträge')")

            print("Verifying Stats Search Input...")
            stats_search = page.locator('input[aria-label="Statistiken durchsuchen"]')
            expect(stats_search).to_be_visible()
            print("✅ Stats Search Input found with aria-label")

            # 3. Verify Info Item Delete Button aria-label
            # Click General tab
            print("Navigating to General tab...")
            page.click("button:has-text('Allgemein')")

            # Ensure there is at least one info item. If not, add one.
            # Scroll to "Zusätzliche Informationen"
            # We look for the "Hinzufügen" button in that section.
            add_btn = page.locator("button:has-text('Hinzufügen')").first
            add_btn.scroll_into_view_if_needed()

            # Check if there are trash buttons
            trash_btns = page.locator("button[aria-label^='Information'][aria-label$='entfernen']")
            count = trash_btns.count()

            if count == 0:
                print("No info items found, adding one...")
                add_btn.click()
                trash_btns = page.locator("button[aria-label^='Information'][aria-label$='entfernen']")
                expect(trash_btns.first).to_be_visible()

            print("Verifying Info Item Delete Button...")
            expect(trash_btns.first).to_be_visible()
            # Check the label value specifically
            label = trash_btns.first.get_attribute("aria-label")
            print(f"✅ Info Item Delete Button found with label: {label}")

            # Take screenshot
            page.screenshot(path="verification/admin_aria_verification.png")
            print("Screenshot saved to verification/admin_aria_verification.png")

        except Exception as e:
            print(f"❌ Verification failed: {e}")
            page.screenshot(path="verification/error.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_aria()
