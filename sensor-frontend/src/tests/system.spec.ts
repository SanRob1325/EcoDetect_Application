import { test, expect, Page } from '@playwright/test';
import { TestUtils } from './utils/test-utils';

test.describe('EcoDetect System Tests', () => {
  let utils: TestUtils;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    utils = new TestUtils(page);
    
    // Navigate to the root page first
    await page.goto('http://localhost:3000/');
    
    // Clear storage
    await utils.clearStorage();

    // Mock API responses before tests
    await setupMocks(page);
    
    // Set up authentication
    await utils.login();

    // Add a delay to ensure login completes
    await page.waitForTimeout(2000);
  });

  // timeout for all tests
  test.setTimeout(90000);

  async function setupMocks(page: Page) {
    // Mock authentication endpoints (similar to auth.spec.ts)
    await page.route('**/cognito-idp.*.amazonaws.com/**', async route => {
      const postData = route.request().postData() || '';
      
      if (postData.includes('InitiateAuth')) {
        route.fulfill({
          status: 200,
          contentType: 'application/x-amz-json-1.1',
          body: JSON.stringify({
            AuthenticationResult: {
              IdToken: 'fake-id-token',
              AccessToken: 'fake-access-token',
              RefreshToken: 'fake-refresh-token',
              ExpiresIn: 3600,
              TokenType: 'Bearer'
            }
          })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/x-amz-json-1.1',
          body: JSON.stringify({})
        });
      }
    });

    // Mock all API endpoints
    await page.route('**/api/**', async route => {
      // Default response for all endpoints
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
  }

  // Test 1: Dashboard navigation
  test('should navigate to dashboard successfully', async () => {
    await page.goto('http://localhost:3000/dashboard');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'dashboard.png' });
    
    // Simple check that the URL is correct
    expect(page.url()).toContain('/dashboard');
  });

  // Test 2: Room monitoring navigation
  test('should navigate to room monitoring page', async () => {
    await page.goto('http://localhost:3000/rooms');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'rooms.png' });
    
    // Simple check that the URL is correct
    expect(page.url()).toContain('/rooms');
  });

  // Test 3: Vehicle monitoring navigation
  test('should navigate to vehicle monitoring page', async () => {
    await page.goto('http://localhost:3000/vehicle');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'vehicle.png' });
    
    // Simple check that the URL is correct
    expect(page.url()).toContain('/vehicle');
  });

  // Test 4: AI Assistant navigation
  test('should navigate to AI Assistant page', async () => {
    await page.goto('http://localhost:3000/ai-assistant');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'ai-assistant.png' });
    
    // Simple check that the URL is correct
    expect(page.url()).toContain('/ai-assistant');
  });

  // Test 5: Alerts navigation
  test('should navigate to alerts page', async () => {
    await page.goto('http://localhost:3000/notice-board');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'alerts.png' });
    
    // Simple check that the URL is correct
    expect(page.url()).toContain('/notice-board');
  });

  // Test 6: Settings navigation
  test('should navigate to settings page', async () => {
    await page.goto('http://localhost:3000/settings');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'settings.png' });
    
    // Simple check that the URL is correct
    expect(page.url()).toContain('/settings');
  });

  // Test 7: Reports navigation
  test('should navigate to reports page', async () => {
    await page.goto('http://localhost:3000/reports');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'reports.png' });
    
    // Simple check that the URL is correct
    expect(page.url()).toContain('/reports');
  });
});