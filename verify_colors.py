from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Go to admin login
        print("Navigating to admin login...")
        page.goto("http://localhost:5000/?admin=true")

        # Check if we are on login screen or dashboard
        try:
            page.wait_for_selector("input[type='password']", timeout=5000)
            print("Logging in...")
            page.fill("input[type='password']", "Password1")
            page.click("button[type='submit']")
        except:
            print("Already logged in or password input not found immediately.")

        # Wait for dashboard
        print("Waiting for dashboard...")
        page.wait_for_selector("text=Regeln", timeout=10000)

        # Go to Rules tab
        print("Clicking Rules tab...")
        page.click("text=Regeln")

        # Open Validation Modal
        print("Opening Validation Modal...")
        page.click("button:has-text('Konfigurationsvalidierung')")

        # Wait for modal
        print("Waiting for modal...")
        page.wait_for_selector("text=Konfigurationsvalidierung", timeout=5000)

        # Enter URL
        print("Entering URL...")
        # Use text selector for tab
        page.click("text=Text einfügen")

        # Wait for textarea to be visible
        page.wait_for_selector("textarea")

        page.fill("textarea", "http://old.com/Suchen")

        # Click Start
        print("Starting validation...")
        page.click("button:has-text('Validierung starten')")

        # Wait for results
        print("Waiting for results...")
        page.wait_for_selector("text=Ergebnisse", timeout=10000)

        # Expand row by clicking on the URL text
        print("Expanding row...")
        page.click("text=http://old.com/Suchen", force=True)

        # Wait for trace steps
        print("Waiting for trace steps...")
        try:
            page.wait_for_selector("text=Verarbeitungsschritte", timeout=5000)
        except Exception as e:
            print("Verarbeitungsschritte not found immediately. Screenshotting state.")
            page.screenshot(path="debug_expansion.png")
            print("Is expanded section visible?")
            if page.locator("text=Ergebnis-Analyse").is_visible():
                print("Ergebnis-Analyse is visible.")
            else:
                print("Ergebnis-Analyse is NOT visible. Expansion failed or content missing.")
            raise e

        # Take screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification_trace.png", full_page=True)
        print("Screenshot saved to verification_trace.png")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="error.png")
        raise
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
