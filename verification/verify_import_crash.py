from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Login first
    page.goto("http://localhost:5000/?admin=true")

    # Wait for login form
    page.wait_for_selector('input[type="password"]')
    page.fill('input[type="password"]', 'Password1')
    page.click('button:has-text("Anmelden")')

    # Wait for login to complete and dashboard to load
    page.wait_for_selector('text=Administrator-Bereich', timeout=10000)

    # Navigate to Import/Export tab
    # We click on the tab trigger. Note: The text is "Import/Export"
    page.click('text=Import/Export')

    # Mock the preview endpoint to return the problematic response (all: undefined)
    # The server might already be doing this if we pass all=false, but to be sure we reproduce the crash condition:
    # We will let the real request happen because the real server returns `all: undefined` which caused the crash.
    # However, we need to upload a file.

    # Create a dummy CSV file
    with open("verification/test_import.csv", "w") as f:
        f.write("matcher,targetUrl\n/test,http://example.com")

    # Upload the file
    # We need to find the file input. In the code it is hidden but linked to a label.
    # Input id is "rule-import-file"
    file_input = page.locator('input#rule-import-file')
    file_input.set_input_files("verification/test_import.csv")

    # Now wait for the preview dialog to appear.
    # If the crash happens, the dialog won't appear or the page will go blank.
    # The crash was "page only gets white".

    try:
        page.wait_for_selector('text=Import Vorschau', timeout=5000)
        print("Import Preview Dialog appeared!")

        # Take a screenshot of the preview dialog
        page.screenshot(path="verification/import_preview_success.png")
        print("Screenshot taken.")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/crash_evidence.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
