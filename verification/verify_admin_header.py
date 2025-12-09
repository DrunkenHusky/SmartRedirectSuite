from playwright.sync_api import sync_playwright, expect
import time

def verify_admin_header():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # 1. Login to admin
        print("Navigating to admin page...")
        page.goto("http://localhost:5000/?admin=true")

        # Wait for password input
        print("Waiting for password input...")
        page.wait_for_selector("input[type='password']")

        # Enter password (default is Password1)
        print("Entering password...")
        page.fill("input[type='password']", "Password1")
        page.click("button[type='submit']")

        # Wait for admin page to load (look for specific admin content)
        print("Waiting for admin content...")
        try:
            # Wait for the header to appear
            header = page.wait_for_selector("header", state="visible", timeout=10000)

            # Check if header has background class
            # We changed bg-surface to bg-background. bg-background resolves to white usually.
            # In compiled CSS/Tailwind, classes are preserved.

            header_class = header.get_attribute("class")
            print(f"Header class: {header_class}")

            if "bg-background" in header_class:
                print("SUCCESS: Header has bg-background class")
            elif "bg-surface" in header_class:
                print("FAILURE: Header still has bg-surface class")
            else:
                print(f"WARNING: Header has unexpected classes: {header_class}")

            # Take screenshot
            page.screenshot(path="verification/admin_header.png")
            print("Screenshot saved to verification/admin_header.png")

        except Exception as e:
            print(f"Error waiting for admin content: {e}")
            page.screenshot(path="verification/error.png")

        finally:
            browser.close()

if __name__ == "__main__":
    verify_admin_header()
