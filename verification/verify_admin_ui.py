
import os
from playwright.sync_api import sync_playwright

def verify_admin_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create context with storage state to save session
        context = browser.new_context()
        page = context.new_page()

        try:
            # 1. Navigate to Admin Login
            print("Navigating to Admin Page...")
            page.goto("http://localhost:5000/?admin=true")

            # Wait for login form
            page.wait_for_selector("text=Administrator-Anmeldung", timeout=10000)

            # 2. Login
            print("Logging in...")
            # Use 'Password1' as per server log warning
            page.fill("input[type=password]", "Password1")
            page.click("button:has-text('Anmelden')")

            # 3. Wait for Admin Dashboard
            print("Waiting for dashboard...")
            page.wait_for_selector("text=Administrator-Bereich", timeout=10000)

            # 4. Navigate to "System & Daten" tab
            print("Navigating to System & Data tab...")

            # Debug: screenshot before clicking tab
            page.screenshot(path="verification/dashboard_before_tab.png", full_page=True)

            # Try to click by text 'System & Daten' if value selector fails, or use role tab
            # The tabs are likely implemented with Radix UI which uses role="tab"
            page.click("button[role='tab']:has-text('System & Daten')")

            # 5. Wait for the content to appear
            print("Waiting for content...")
            # Wait for "Cache Wartung" which is in the same card
            page.wait_for_selector("text=Cache Wartung", timeout=5000)

            # 6. Verify layout
            # We want to see "Sicherheit" section before "Destruktive Aktionen"

            # Take screenshot
            print("Taking screenshot...")
            page.screenshot(path="verification/admin_ui_verification.png", full_page=True)

            # Additional check: specific elements existence
            sicherheit_visible = page.is_visible("text=Sicherheit")
            blocked_ips_btn_visible = page.is_visible("text=Blockierte IPs anzeigen und verwalten")
            destructive_actions_visible = page.is_visible("text=Destruktive Aktionen")

            print(f"Sicherheit section visible: {sicherheit_visible}")
            print(f"Blocked IPs button visible: {blocked_ips_btn_visible}")
            print(f"Destructive Actions visible: {destructive_actions_visible}")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_screenshot.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_ui()
