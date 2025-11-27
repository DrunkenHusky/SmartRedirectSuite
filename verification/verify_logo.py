from playwright.sync_api import sync_playwright

def verify_loading_logo():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Navigate to home
        page.goto("http://localhost:5000/", timeout=10000)

        # Wait a bit for JS to execute
        page.wait_for_timeout(5000)

        # Screenshot of the loaded page
        page.screenshot(path="verification/loaded_page.png")
        print("Screenshot taken.")

        # Check if logo is present in the header
        # The logo alt is "Logo"
        logo = page.locator("img[alt='Logo']")
        count = logo.count()
        print(f"Logo count: {count}")

        if count > 0:
            if logo.first.is_visible():
                print("Logo is visible.")
            else:
                print("Logo exists but not visible.")
        else:
            print("Logo not found.")

        browser.close()

if __name__ == "__main__":
    verify_loading_logo()
