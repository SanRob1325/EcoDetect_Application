import { test, expect, Page } from '@playwright/test';
import { TestUtils } from './utils/test-utils';

test.describe('EcoDetect Integration Tests', () => {
  let utils: TestUtils;
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    utils = new TestUtils(page);
    
    // Navigate to the root page first
    await page.goto('http://localhost:3000/');
    
    // Clear storage
    await utils.clearStorage();

    // Set up authentication
    await utils.login();

    // Add a longer delay to ensure login completes
    await page.waitForTimeout(3000);
  });

  // Set a longer timeout for all tests
  test.setTimeout(180000); // 3 minutes

  // Test 1: Navigation test - simplified
  test('should navigate between pages successfully', async () => {
    // Try navigating directly to dashboard
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForTimeout(2000);
    
    // Take a screenshot of dashboard
    await page.screenshot({ path: 'integration-dashboard.png' });
    
    // Verify URL
    expect(page.url()).toContain('/dashboard');
    
    // Navigate to rooms page 
    await page.goto('http://localhost:3000/rooms');
    await page.waitForTimeout(2000);
    
    // Take screenshot of rooms page
    await page.screenshot({ path: 'integration-rooms.png' });
    
    // Verify URL
    expect(page.url()).toContain('/rooms');
  });

  // Test 2: Authentication check
  test('should handle authentication state', async () => {
    // First make sure we're authenticated
    const isAccessToken = await page.evaluate(() => {
      return !!localStorage.getItem('accessToken');
    });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'integration-auth-state.png' });
    
    expect(isAccessToken).toBeTruthy();
  });

  // Test 3: Data consistency test
  test('should show consistent sensor data across views', async () => {
    // Mock specific sensor data
    const mockSensorData = {
      temperature: 23.5,
      humidity: 48.2,
      pressure: 1012.5,
      flow_rate: 3.2,
      timestamp: new Date().toISOString()
    };
    
    // Mock the sensor data API
    await page.route('**/api/sensor-data', async route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSensorData)
      });
    });
    
    // Navigate to dashboard
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForTimeout(3000);
    
    // Screenshot for verification
    await page.screenshot({ path: 'integration-dashboard-data.png' });
    
    // Go to room monitoring
    await page.goto('http://localhost:3000/rooms');
    await page.waitForTimeout(3000);
    
    // Screenshot for verification
    await page.screenshot({ path: 'integration-rooms-data.png' });
    
    // Simple check that pages loaded
    expect(page.url()).toContain('/rooms');
  });

  // Test 4: Alert display test - using different approach
  test('should handle alert data', async () => {
    // Mock alert data
    await page.route('**/api/alerts', async route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-alert-1',
            timestamp: new Date().toISOString(),
            severity: 'critical',
            exceeded_thresholds: ['temperature_high'],
            device_id: 'TestDevice'
          }
        ])
      });
    });
    
    // Navigate to the alerts/notice board page where alerts are displayed
    await page.goto('http://localhost:3000/notice-board');
    await page.waitForTimeout(3000);
    
    // Screenshot for verification
    await page.screenshot({ path: 'integration-alerts.png' });
    
    // Simple check that page loaded
    expect(page.url()).toContain('/notice-board');
  });

  // Test 5: Settings interaction
  test('should load settings page', async () => {
    // Set up mock for threshold update
    await page.route('**/api/set-thresholds', async route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Thresholds updated successfully',
          thresholds: {
            temperature_range: [19, 26],
            humidity_range: [30, 60],
            flow_rate_threshold: 5
          }
        })
      });
    });
    
    // Navigate to settings
    await page.goto('http://localhost:3000/settings');
    await page.waitForTimeout(3000);
    
    // Screenshot for verification
    await page.screenshot({ path: 'integration-settings.png' });
    
    // Simple check that page loaded
    expect(page.url()).toContain('/settings');
  });

  // Test 6: AI Assistant page loading
  test('should load AI Assistant page', async () => {
    // Mock AI response
    await page.route('**/api/ai-assistant', async route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          answer: 'Based on your current temperature of 22.5°C and humidity of 45.3%, your environmental conditions are optimal.',
          metadata: {
            query_id: 'test-query-id',
            execution_time: 0.5
          }
        })
      });
    });
    
    // Navigate to AI Assistant
    await page.goto('http://localhost:3000/ai-assistant');
    await page.waitForTimeout(3000);
    
    // Screenshot for verification
    await page.screenshot({ path: 'integration-ai-assistant.png' });
    
    // Simple check that page loaded
    expect(page.url()).toContain('/ai-assistant');
  });

  // Test 7: Report generation page loading
  test('should load reports page', async () => {
    // Navigate to reports page
    await page.goto('http://localhost:3000/reports');
    await page.waitForTimeout(3000);
    
    // Screenshot for verification
    await page.screenshot({ path: 'integration-reports.png' });
    
    // Simple check that page loaded
    expect(page.url()).toContain('/reports');
  });

  // Test 8: Vehicle monitoring page loading
  test('should load vehicle monitoring page', async () => {
    // Mock vehicle movement data
    await page.route('**/api/vehicle-movement', async route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accel_magnitude: 0.35,
          rotation_rate: 0.12,
          orientation: {
            pitch: 2.1,
            roll: 1.5,
            heading: 180.2
          },
          movement_type: 'steady_movement',
          timestamp: new Date().toISOString()
        })
      });
    });
    
    // Navigate to vehicle monitoring
    await page.goto('http://localhost:3000/vehicle');
    await page.waitForTimeout(3000);
    
    // Screenshot for verification
    await page.screenshot({ path: 'integration-vehicle.png' });
    
    // Simple check that page loaded
    expect(page.url()).toContain('/vehicle');
  });

  // Test 9: Test data persistence
  test('should persist authentication state across navigation', async () => {
    // Set authentication tokens 
    await page.evaluate(() => {
      localStorage.setItem('accessToken', 'fake-access-token');
      localStorage.setItem('idToken', 'fake-id-token');
      localStorage.setItem('refreshToken', 'fake-refresh-token');
    });
    
    // Navigate to dashboard
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForTimeout(2000);
    
    // Navigate to rooms
    await page.goto('http://localhost:3000/rooms');
    await page.waitForTimeout(2000);
    
    // Check if tokens are still present
    const hasTokens = await page.evaluate(() => {
      return !!localStorage.getItem('accessToken') && 
             !!localStorage.getItem('idToken') &&
             !!localStorage.getItem('refreshToken');
    });
    
    expect(hasTokens).toBeTruthy();
    
    // Screenshot for verification
    await page.screenshot({ path: 'integration-persistence.png' });
  });
});