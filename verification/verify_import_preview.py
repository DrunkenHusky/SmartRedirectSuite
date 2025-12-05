from playwright.sync_api import sync_playwright

def verify_import_preview():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a larger viewport to ensure the table columns are visible
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        # Navigate to admin page directly using the admin query param to bypass migration page
        page.goto("http://localhost:5000/admin?admin=true")

        # Login
        page.fill("input[type='password']", "Password1")
        page.click("button[type='submit']")

        # Wait for dashboard to load (wait for the "Administrator-Bereich" text)
        page.wait_for_selector("text=Administrator-Bereich")

        # Click on "Import/Export" tab
        page.click("text=Import/Export")

        # Wait for file input to be available
        file_input = page.locator("input[type='file']").first

        # Create a dummy Excel file content (we can't easily create a real xlsx in this script,
        # so we will use a CSV file which is simpler and supported)
        csv_content = """matcher,targetUrl,discardQueryParams,keepQueryParams,type,autoRedirect
/test-discard,https://example.com,true,false,partial,true
/test-keep,https://example.com,false,true,wildcard,false
/test-default,https://example.com,false,false,domain,false"""

        with open("verification/test-import.csv", "w") as f:
            f.write(csv_content)

        # Upload the file
        file_input.set_input_files("verification/test-import.csv")

        # Wait for preview dialog
        page.wait_for_selector("text=Import Vorschau")

        # Take screenshot of the preview table
        page.screenshot(path="verification/import_preview.png")

        browser.close()

if __name__ == "__main__":
    verify_import_preview()
