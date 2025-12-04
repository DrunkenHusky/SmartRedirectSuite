from playwright.sync_api import Page, expect, sync_playwright

def verify_admin_export_page(page: Page):
    # 1. Arrange: Go to the admin page.
    page.goto("http://localhost:5000/?admin=true")

    # 2. Authenticate
    page.fill("input[type='password']", "Password1") # Default password
    page.click("button:has-text('Anmelden')")

    # Wait for authentication to succeed
    expect(page.get_by_text("Administrator-Bereich")).to_be_visible()

    # 3. Navigate to Import/Export tab
    # The button is a tab trigger, likely has role='tab'.
    # It has value="export" but typically Radix Tabs use data-value or similar on the button/div.
    # Playwright's get_by_role("tab", name="Import/Export") is better.
    page.get_by_role("tab", name="Import/Export").click()

    # 4. Verify new section
    # Check for "Systemeinstellungen & Statistiken"
    expect(page.get_by_text("Systemeinstellungen & Statistiken")).to_be_visible()

    # Check for renamed buttons
    expect(page.get_by_role("button", name="Herunterladen (Excel)")).to_be_visible()
    expect(page.get_by_role("button", name="Herunterladen (CSV)").first).to_be_visible()
    expect(page.get_by_role("button", name="Herunterladen (JSON)").first).to_be_visible()
    expect(page.get_by_role("button", name="Importieren (JSON)").first).to_be_visible()

    # 5. Screenshot
    page.screenshot(path="/home/jules/verification/admin_export_tab.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_admin_export_page(page)
        finally:
            browser.close()
