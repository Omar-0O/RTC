import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 375, height: 812 },
  locale: 'ar-EG',
});

test('verify responsive layout', async ({ page }) => {
  // Login
  await page.goto('http://localhost:8081/auth');
  await page.fill('input[type="email"]', 'rtc@gmail.com');
  await page.fill('input[type="password"]', 'admin321');
  await page.click('button[type="submit"]');

  // Wait for redirect to admin dashboard
  await page.waitForURL('**/admin');
  await page.waitForTimeout(2000); // Wait for data load
  await page.screenshot({ path: 'dashboard-mobile.png', fullPage: true });

  // Volunteer Management
  await page.goto('http://localhost:8081/admin/users');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'users-mobile.png', fullPage: true });

  // Caravan Management
  await page.goto('http://localhost:8081/caravans');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'caravans-mobile.png', fullPage: true });

  // Course Schedule
  await page.goto('http://localhost:8081/courses');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'courses-mobile.png', fullPage: true });
});
