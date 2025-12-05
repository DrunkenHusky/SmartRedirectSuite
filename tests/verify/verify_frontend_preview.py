
import os
import time
from playwright.sync_api import sync_playwright, expect

# Create import file for testing
with open('/home/jules/verification/import_test.csv', 'w') as f:
    f.write('Matcher,Target URL\n/test-new,https://example.com/new\n/existing-path,https://example.com/existing-updated')

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    # Set viewport to ensure elements are visible
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()

    page.on("console", lambda msg: print(f"Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Page Error: {err}"))

    try:
        print("Navigating to App with admin param...")
        page.goto("http://localhost:5000/?admin=true")

        # Wait for potential initial load
        page.wait_for_timeout(3000)

        # Check for Password Modal
        try:
            # Wait for either password input or admin dashboard
            # If dashboard appears immediately (shouldn't happen with default password), we are good
            if page.locator('input[type="password"]').is_visible():
                print("Password input found. Logging in...")
                page.fill('input[type="password"]', "Password1")
                page.click('button:has-text("Anmelden")')
                # Wait for login transition
                page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Error checking login: {e}")

        # Check if we are in Admin Dashboard
        print("Checking for Admin Dashboard...")
        expect(page.get_by_text("Administrator-Bereich")).to_be_visible(timeout=10000)

        # 3. Go to Import/Export Tab
        print("Clicking Import/Export Tab...")
        # Use robust selector: role=tab and contains text
        tab_locator = page.locator('button[role="tab"]').filter(has_text="Import/Export")
        try:
            tab_locator.click(timeout=5000)
        except Exception:
            print("Tab click failed. Dumping tabs HTML...")
            try:
                print(page.locator('[role="tablist"]').inner_html())
            except:
                print("Could not dump tablist HTML")
            raise

        # 4. Upload file for preview
        print("Uploading file...")
        with page.expect_file_chooser() as fc_info:
            # Force click if hidden
            page.locator("label[for='rule-import-file']").click(force=True)
        file_chooser = fc_info.value
        file_chooser.set_files("/home/jules/verification/import_test.csv")

        # 5. Wait for preview dialog
        print("Waiting for dialog...")
        expect(page.get_by_text("Import Vorschau")).to_be_visible(timeout=10000)

        # 6. Check for Status column
        print("Checking Status column...")
        expect(page.get_by_role("columnheader", name="Status")).to_be_visible()

        # 7. Check for Filter Badges
        print("Checking Filter Badges...")
        expect(page.get_by_text("Neu:")).to_be_visible()
        # We expect "Neu: 2" since both are treated as new by the script if DB is clean,
        # or if /existing-path is not in DB yet.
        # But wait, logic says if matcher exists, it's Update.
        # Since DB is persistent in 'data/rules.json', and I haven't cleared it, existing rules might be there.
        # But for UI verification, just checking visibility is enough.

        # 8. Check for Sort Headers
        print("Checking Sort Headers...")
        expect(page.locator("button:has-text('Matcher')")).to_be_visible()

        # 9. Take screenshot
        time.sleep(1) # Wait for animations
        page.screenshot(path="/home/jules/verification/import_preview.png")
        print("Success! Screenshot saved.")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="/home/jules/verification/error.png")
        raise e
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
