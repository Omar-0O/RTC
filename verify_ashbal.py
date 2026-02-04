from playwright.sync_api import sync_playwright
import json
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 720})

    # Enable request interception
    page = context.new_page()

    # Mock User Roles (needed for role check)
    # We need to return role 'admin' so the user can access admin pages
    def handle_user_roles(route):
        print("Mocking user_roles response")
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps([{"role": "admin"}])
        )

    page.route("**/rest/v1/user_roles*", handle_user_roles)

    # Mock Profiles request for Ashbal Management
    def handle_profiles(route):
        print(f"Mocking profiles response: {route.request.url}")
        # Only mock if it's the ashbal query (checking for is_ashbal)
        if "is_ashbal" in route.request.url:
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps([
                    {
                        "id": "user1",
                        "full_name": "Ashbal One",
                        "phone": "1234567890",
                        "created_at": "2024-01-01T12:00:00Z",
                        "level": "under_follow_up",
                        "is_ashbal": True,
                        "email": "ashbal1@example.com",
                        "avatar_url": None,
                        "committee_id": None,
                        "total_points": 0
                    },
                    {
                        "id": "user2",
                        "full_name": "Ashbal Two",
                        "phone": "0987654321",
                        "created_at": "2024-02-01T12:00:00Z",
                        "level": "project_responsible",
                        "is_ashbal": True,
                        "email": "ashbal2@example.com",
                        "avatar_url": None,
                        "committee_id": None,
                        "total_points": 100
                    },
                    {
                        "id": "user3",
                        "full_name": "Ashbal Three",
                        "phone": "1122334455",
                        "created_at": "2024-03-01T12:00:00Z",
                        "level": "responsible",
                        "is_ashbal": True,
                        "email": "ashbal3@example.com",
                        "avatar_url": None,
                        "committee_id": None,
                        "total_points": 200
                    }
                ])
            )
        else:
            # For other profile queries (like user details), mock a generic admin profile
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps([{
                    "id": "test-user-id",
                    "full_name": "Admin User",
                    "email": "admin@example.com",
                    "role": "admin"
                }])
            )

    page.route("**/rest/v1/profiles*", handle_profiles)

    # Mock Auth User
    def handle_user(route):
        print("Mocking auth/v1/user response")
        route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "id": "test-user-id",
                "aud": "authenticated",
                "role": "authenticated",
                "email": "admin@example.com",
                "phone": "",
                "app_metadata": {"provider": "email", "providers": ["email"]},
                "user_metadata": {},
                "identities": [],
                "created_at": "2023-01-01T00:00:00.000000Z",
                "updated_at": "2023-01-01T00:00:00.000000Z"
            })
        )
    page.route("**/auth/v1/user", handle_user)

    # Session Data
    session_data = {
        "access_token": "fake-access-token",
        "refresh_token": "fake-refresh-token",
        "expires_at": int(time.time()) + 3600,
        "expires_in": 3600,
        "token_type": "bearer",
        "user": {
            "id": "test-user-id",
            "aud": "authenticated",
            "role": "authenticated",
            "email": "admin@example.com",
            "app_metadata": {"provider": "email", "providers": ["email"]},
            "user_metadata": {},
            "created_at": "2023-01-01T00:00:00.000000Z",
        }
    }

    # Navigate to auth page to set local storage
    print("Navigating to auth page...")
    page.goto("http://localhost:8080/auth")

    # Set session in local storage
    # We use a slight delay to ensure page is loaded enough to have window/localStorage
    page.wait_for_load_state("domcontentloaded")

    ls_key = "sb-dscphfuyhjorrshtyqan-auth-token"
    ls_val = json.dumps(session_data)

    print(f"Setting localStorage item: {ls_key}")
    page.evaluate(f"localStorage.setItem('{ls_key}', JSON.stringify({json.dumps(session_data)}));")

    # Also set language to Arabic initially
    print("Setting language to Arabic")
    page.evaluate("localStorage.setItem('rtc-language', 'ar');")

    # Now navigate to target page
    print("Navigating to Ashbal Management page...")
    page.goto("http://localhost:8080/ashbal/management")

    try:
        # Wait for table
        print("Waiting for table...")
        page.wait_for_selector("table", timeout=10000)

        # Wait for rows to populate
        page.wait_for_selector("tbody tr", timeout=5000)

        # Take screenshot
        print("Taking screenshot...")
        page.screenshot(path="ashbal_verification_ar.png", full_page=True)
        print("Screenshot saved to ashbal_verification_ar.png")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="error_screenshot.png", full_page=True)

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
