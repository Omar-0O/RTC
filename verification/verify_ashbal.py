from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Navigate to Test Ashbal Management
    print("Navigating to Test Ashbal Management...")
    page.goto("http://localhost:8080/test-ashbal")

    # Wait for content
    print("Waiting for content...")

    # 1. Verify Title (English default)
    expect(page.get_by_text("Trimester Target (Add Ashbal)")).to_be_visible(timeout=10000)

    # 2. Verify Removed Sentence
    # The sentence "Target: Add 10 new Ashbal volunteers this trimester." should NOT be there.
    expect(page.get_by_text("Target: Add 10 new Ashbal volunteers this trimester.")).not_to_be_visible()

    # 3. Verify Table Headers (New Order: Name, Phone, Level, Join Date)
    expect(page.get_by_text("Level")).to_be_visible()

    # Screenshot
    print("Taking screenshot...")
    page.screenshot(path="verification/ashbal_final.png", full_page=True)
    print("Screenshot saved.")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
