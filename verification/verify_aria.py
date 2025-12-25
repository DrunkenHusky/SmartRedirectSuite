
import os
from playwright.sync_api import sync_playwright

def verify_aria_labels():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use 'iphone 12' emulation to trigger mobile view where some buttons are icon-only
        iphone_12 = p.devices['iPhone 12']
        context = browser.new_context(**iphone_12)
        page = context.new_page()

        # 1. Login to Admin
        page.goto("http://localhost:5000/api/admin/login?admin=true")

        # Wait for login form
        try:
            page.wait_for_selector("input[type='password']", timeout=5000)
            page.fill("input[type='password']", "Password123!") # Assuming default password or env var
            page.click("button[type='submit']")
        except Exception as e:
            print("Already logged in or login form not found")


        # Wait for admin dashboard
        # Instead of waiting for URL, let's wait for a known element on the admin page
        # The admin page has a header with "Administrator-Bereich" or "Admin"
        page.wait_for_selector("text=Admin", timeout=10000)

        # page.wait_for_load_state("networkidle") # Removing this as it might be flaky

        # 2. Verify "Abmelden" button aria-label
        # On mobile, the text "Abmelden" is hidden (class "hidden sm:inline"), so the button relies on aria-label
        # Try finding by role and label
        logout_btn = page.get_by_role("button", name="Abmelden")
        if logout_btn.count() > 0:
             print("SUCCESS: Found logout button with aria-label='Abmelden' using get_by_role")
        else:
             print("FAILURE: Did not find logout button with aria-label='Abmelden' using get_by_role")
             # Fallback: check attribute directly
             logout_btn_attr = page.locator("button[aria-label='Abmelden']")
             if logout_btn_attr.count() > 0:
                 print("SUCCESS: Found logout button with selector button[aria-label='Abmelden']")
             else:
                 print("FAILURE: Did not find logout button with selector button[aria-label='Abmelden']")

        # 3. Verify "Schließen" button aria-label
        close_btn = page.locator("button[aria-label='Administrator-Bereich schließen']")
        if close_btn.count() > 0:
            print("SUCCESS: Found close button with aria-label='Administrator-Bereich schließen'")
        else:
            print("FAILURE: Did not find close button with aria-label='Administrator-Bereich schließen'")


        # 4. Navigate to Rules tab (if not already there, but default might be 'general')
        # We need to switch to 'Rules' tab to see rule buttons
        # Note: Tab triggers might also be icon-only on mobile
        # The tab triggers have values 'general', 'rules', 'stats', 'export'
        # The locator should be robust
        try:
            page.click("button[value='rules']", timeout=5000)
        except:
            print("Could not click button[value='rules']. Trying text locator.")
            try:
                page.click("text=Regeln")
            except:
                print("Could not click text=Regeln.")


        # Wait for rules to load - RulesCardList should appear on mobile
        # Wait for a rule card or "Keine Regeln" message
        try:
            page.wait_for_selector("text=URL-Pfad Matcher", timeout=5000)
        except:
             # Maybe on mobile it's different header or no rules
             pass

        # 5. Verify Rule Edit/Delete buttons
        # Since we are on mobile view, it should render RulesCardList
        # Check for at least one edit button with specific aria-label
        # We might need to know a rule matcher. Let's look for any button starting with "Regel " and ending with " bearbeiten"
        edit_buttons = page.locator("button[aria-label^='Regel '][aria-label$=' bearbeiten']")
        count = edit_buttons.count()
        if count > 0:
            print(f"SUCCESS: Found {count} edit buttons with correct aria-label pattern")
            print(f"Sample: {edit_buttons.first.get_attribute('aria-label')}")
        else:
             print("WARNING: No rules found or no edit buttons matched pattern. Are there rules in the system?")
             # Create a dummy rule for verification if needed
             # page.click("button:has-text('Neue Regel')")
             # ... fill form ...

        # Take screenshot
        page.screenshot(path="verification/mobile_admin_aria.png")

        browser.close()

if __name__ == "__main__":
    verify_aria_labels()
