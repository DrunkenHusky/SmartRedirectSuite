
import requests
import time
from playwright.sync_api import sync_playwright, expect

BASE_URL = "http://localhost:5000"
PASSWORD = "Password1"

def verify_frontend_statistics():
    """Verifies the statistics page."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Login
        print("Logging in...")
        page.goto(f"{BASE_URL}/?admin=true")

        # Expect login modal
        page.get_by_placeholder("Passwort eingeben").fill(PASSWORD)
        page.get_by_role("button", name="Anmelden").click()

        # Wait for admin dashboard
        expect(page.get_by_text("System & Daten")).to_be_visible(timeout=10000)

        # Go to System & Data tab
        page.get_by_text("System & Daten").click()

        # Wait a bit for data to load
        time.sleep(2)

        print("Taking screenshot...")
        page.screenshot(path="verification/verification.png", full_page=True)

        # Verify the text is present
        expect(page.get_by_text("Regel nicht mehr vorhanden")).to_be_visible()
        print("Verified 'Regel nicht mehr vorhanden' is visible.")

        browser.close()

if __name__ == "__main__":
    verify_frontend_statistics()
