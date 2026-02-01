from playwright.sync_api import sync_playwright, expect

def test_feedback_trend(page):
    # 1. Open home page
    page.goto("http://localhost:5000/")

    # 2. Click Admin gear icon
    page.get_by_label("Administrator-Bereich öffnen").click()

    # 3. Login
    if page.get_by_placeholder("Passwort eingeben").is_visible():
        page.get_by_placeholder("Passwort eingeben").fill("Password1")
        page.get_by_role("button", name="Anmelden").click()

    # Wait for admin page to load
    expect(page.get_by_text("Administrator-Bereich")).to_be_visible()

    # 4. Go to General Settings (default)
    # Scroll to bottom to find Feedback section
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")

    # Enable Feedback Survey if not already enabled (it defaults to false)
    # Finding the switch by text context
    # "Feedback-Umfrage aktivieren"
    # We click the label/container to toggle it ON if it's off.
    # But checking state is hard. Let's just click it and see if "Nur Feedback..." appears.
    # If it was ON, clicking might turn it OFF.
    # But default is OFF.

    # Try to find the new text "Nur Feedback (OK/NOK) anzeigen". If not visible, click the toggle.
    if not page.get_by_text("Nur Feedback (OK/NOK) anzeigen").is_visible():
        # Find the enable switch. It is near "Feedback-Umfrage aktivieren"
        # We click the switch button.
        # Shadcn Switch has role="switch".
        # We can find the one in the "Benutzer-Feedback-Umfrage" section.
        # It's the first switch in that section.
        # Or simpler: Click the text "Feedback-Umfrage aktivieren", often linked to switch.
        page.get_by_text("Feedback-Umfrage aktivieren").click()

    # Now check if new setting is visible
    expect(page.get_by_text("Nur Feedback (OK/NOK) anzeigen")).to_be_visible()

    # Take screenshot of settings
    page.screenshot(path="/home/jules/verification/settings_trend.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_feedback_trend(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
        finally:
            browser.close()
