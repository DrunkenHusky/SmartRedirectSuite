from playwright.sync_api import sync_playwright
import time

def verify_debug():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Test 1: Desktop
        print("\n--- DESKTOP TEST ---")
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()
        page.on("console", lambda msg: print(f"DESKTOP CONSOLE: {msg.text}"))
        page.on("pageerror", lambda err: print(f"DESKTOP PAGE ERROR: {err}"))

        try:
            page.goto("http://localhost:5000/?admin=true")
            try:
                page.wait_for_selector("input[type='password']", timeout=5000)
                page.fill("input[type='password']", "Password1")
                page.click("button[type='submit']")
            except:
                pass

            page.wait_for_selector("text=Administrator-Bereich", timeout=5000)
            print("Desktop loaded successfully")
            page.screenshot(path="verification/admin_desktop.png")
        except Exception as e:
            print(f"Desktop failed: {e}")

        page.close()
        browser.close()

if __name__ == "__main__":
    verify_debug()
