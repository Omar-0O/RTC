from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    print("Navigating to http://localhost:8080/activity")
    page.goto("http://localhost:8080/activity")
    page.wait_for_load_state("networkidle")

    try:
        page.wait_for_selector("#wore-vest", timeout=20000)

        # Scroll to element
        element = page.locator("#wore-vest")
        element.scroll_into_view_if_needed()

        print("Taking full page screenshot...")
        page.screenshot(path="verification/verification_full.png", full_page=True)
        print("Screenshot saved to verification/verification_full.png")

    except Exception as e:
        print(f"Error: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
