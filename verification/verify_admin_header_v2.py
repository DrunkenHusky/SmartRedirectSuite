from playwright.sync_api import sync_playwright, expect
import time

def verify_admin_header_v2():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a standard desktop viewport
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        print("Navigating to admin page...")
        page.goto("http://localhost:5000/?admin=true")

        # Check if we need to login
        # If we see the auth form (password input)
        try:
            print("Checking for login form...")
            page.wait_for_selector("input[type='password']", timeout=5000)
            print("Login form found. Logging in...")
            page.fill("input[type='password']", "Password1")
            page.click("button[type='submit']")
        except:
            print("No login form found (already authenticated?). Proceeding...")

        # Wait for the main admin content
        print("Waiting for 'Administrator-Bereich' text...")
        try:
            # This text is in the header
            page.wait_for_selector("text=Administrator-Bereich", timeout=10000)
            print("Admin content loaded.")

            # Wait a bit for layout to settle
            time.sleep(2)

            # Check header background
            header = page.locator("header")
            classes = header.get_attribute("class")
            print(f"Header classes: {classes}")

            # Check if header is visible
            if header.is_visible():
                print("Header is visible.")
            else:
                print("Header is NOT visible.")

            # Take screenshot
            page.screenshot(path="verification/admin_header_v2.png")
            print("Screenshot saved to verification/admin_header_v2.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error_v2.png")

        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_header_v2()
