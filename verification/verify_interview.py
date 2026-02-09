from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)

    print("Testing Mobile View...")
    context_mobile = browser.new_context(viewport={"width": 375, "height": 800})
    page_mobile = context_mobile.new_page()
    try:
        page_mobile.goto("http://localhost:8080/test-schedule")
        # In Mobile view, it shows "Interview: Course Name"
        page_mobile.wait_for_selector("text=Interview: Test Interview Course", timeout=10000)
        page_mobile.screenshot(path="/home/jules/verification/mobile_view.png")
        print("Mobile View Verified.")
    except Exception as e:
        print(f"Mobile View Failed: {e}")

    print("Testing Desktop View...")
    context_desktop = browser.new_context(viewport={"width": 1280, "height": 720})
    page_desktop = context_desktop.new_page()
    try:
        page_desktop.goto("http://localhost:8080/test-schedule")
        # In Desktop view, it shows just "Interview"
        # We also want to verify it's the right course, but visually "Interview" is what we see.
        page_desktop.wait_for_selector("text=Interview", timeout=10000)
        page_desktop.screenshot(path="/home/jules/verification/desktop_view.png")
        print("Desktop View Verified.")
    except Exception as e:
        print(f"Desktop View Failed: {e}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
