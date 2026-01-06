import time
from playwright.sync_api import sync_playwright

def test_course_schedule_display():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            # Login
            page.goto("http://localhost:8080/auth")
            page.wait_for_selector("input[type=email]")
            page.fill("input[type=email]", "rtc@gmail.com")
            page.fill("input[type=password]", "admin321")
            page.click("button[type=submit]")

            # Wait for navigation
            page.wait_for_url("**/")

            # Go directly to volunteer dashboard (sometimes it redirects to admin, but CourseSchedule is used in volunteer dashboard)
            # Actually CourseManagement is likely the admin page, but the component is used in Dashboard.
            # Let's try to go to the page where it is used.
            # The file `src/pages/volunteer/Dashboard.tsx` uses `CourseSchedule`.
            # The route is likely `/volunteer-dashboard` or just `/dashboard` depending on router.
            # Assuming `/volunteer-dashboard` based on file structure, but let's check routes if needed.
            # For now, let's just go to root. If admin, it might be different.

            # Let's try to wait for "Monthly Course Calendar" text which is in the component.
            try:
                page.wait_for_selector("text=Monthly Course Calendar", timeout=5000)
            except:
                print("Not found on landing page, trying /volunteer-dashboard")
                page.goto("http://localhost:8080/volunteer-dashboard")
                try:
                    page.wait_for_selector("text=Monthly Course Calendar", timeout=5000)
                except:
                    print("Not found on /volunteer-dashboard, trying /dashboard")
                    page.goto("http://localhost:8080/dashboard")
                    page.wait_for_selector("text=Monthly Course Calendar", timeout=5000)


            # Wait a bit for courses to load
            time.sleep(3)

            # Take screenshot of the schedule component area
            # We can find the card containing the text "Monthly Course Calendar"
            schedule_card = page.locator(".col-span-full", has_text="Monthly Course Calendar")
            if schedule_card.count() > 0:
                 schedule_card.first.screenshot(path="verification_schedule.png")
            else:
                 page.screenshot(path="verification_schedule.png", full_page=True)

            print("Screenshot taken successfully")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error_screenshot.png")
        finally:
            browser.close()

if __name__ == "__main__":
    test_course_schedule_display()
