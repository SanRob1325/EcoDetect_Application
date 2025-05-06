import { expect, Page } from '@playwright/test';

// Define types for navigation paths
type NavigationKey = 'dashboard' | 'rooms' | 'ai-assistant' | 'reports' | 'settings' | 
                    'welcome' | 'notice-board' | 'alerts' | 'vehicle' | 'guide';

export class TestUtils {
  constructor(private page: Page) {}

  async login(email: string = 'test@example.com', password: string = 'password123') {
    console.log('TestUtils.login called');
    
    try {
      // Simplified login - just set the tokens directly
      await this.page.evaluate((email) => {
        localStorage.setItem('accessToken', 'fake-access-token');
        localStorage.setItem('idToken', 'fake-id-token');
        localStorage.setItem('refreshToken', 'fake-refresh-token');
        localStorage.setItem('username', email);
      }, email);
      
      console.log('TestUtils.login: tokens set in localStorage');
      
      // Navigate to welcome page (skipping actual login flow)
      await this.page.goto('http://localhost:3000/welcome');
      console.log('TestUtils.login: navigated to welcome page');
      
      return true;
    } catch (error) {
      console.error('Error in TestUtils.login:', error);
      throw error;
    }
  }

  async clearStorage() {
    try {
      await this.page.context().clearCookies();
      await this.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      console.log('Storage cleared');
    } catch (error) {
      console.warn('Error clearing storage:', (error as Error).message);
      // Continue test execution even if clearing fails
    }
  }

  async verifyAlertPresent(message: string, type: 'error' | 'warning' | 'success' | 'info' = 'error') {
    const selector = `.ant-alert-${type}`;
    await this.page.waitForSelector(selector);
    const alertText = await this.page.textContent(selector);
    expect(alertText).toContain(message);
  }

  async interceptApiCall(endpoint: string, mockResponse: any) {
    await this.page.route(`**/api/${endpoint}`, async route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      });
    });
  }

  async verifyCardPresent(title: string) {
    const cardSelector = `.ant-card-head-title:has-text("${title}")`;
    await this.page.waitForSelector(cardSelector);
    expect(await this.page.isVisible(cardSelector)).toBeTruthy();
  }

  // New helper methods for system tests

  /**
   * Navigate to a specific page in the application
   */
  async navigateTo(path: NavigationKey) {
    await this.page.goto(`http://localhost:3000/${path}`);
    console.log(`Navigated to /${path}`);
  }

  /**
   * Wait for sensor data to be loaded (by checking for specific data elements)
   */
  async waitForSensorDataLoaded() {
    // Wait for temperature element to be visible with data
    await this.page.waitForSelector('text=/[0-9]+(\.[0-9]+)?°C/');
    console.log('Sensor data appears to be loaded');
  }

  /**
   * Verify chart is present on the page
   */
  async verifyChartPresent() {
    await this.page.waitForSelector('canvas');
    const chartVisible = await this.page.isVisible('canvas');
    expect(chartVisible).toBeTruthy();
    console.log('Chart is visible');
  }

  /**
   * Submit a query to the AI Assistant
   */
  async submitAIQuery(query: string) {
    await this.page.fill('textarea[placeholder*="Ask about"]', query);
    await this.page.click('button:has(svg[data-icon="send"])');
    console.log(`Submitted AI query: "${query}"`);
  }

  /**
   * Mock API responses for dashboard data
   */
  async mockDashboardData() {
    await this.interceptApiCall('sensor-data', {
      temperature: 22.5,
      humidity: 45.3,
      pressure: 1013.2,
      altitude: 50.2,
      imu: {
        acceleration: [0.1, 0.2, 9.8],
        gyroscope: [0.01, 0.02, 0.003],
        magnetometer: [20.1, 15.2, 40.3]
      },
      timestamp: new Date().toISOString(),
      location: 'Test Location'
    });

    await this.interceptApiCall('water-usage', {
      flow_rate: 2.5,
      unit: 'L/min',
      timestamp: new Date().toISOString()
    });

    await this.interceptApiCall('carbon-footprint', {
      carbon_footprint: 35.7,
      timestamp: new Date().toISOString()
    });

    console.log('Mocked dashboard data');
  }

  /**
   * Verify a specific value is displayed on the page
   */
  async verifyValueDisplayed(value: string | number | RegExp) {
    const valueString = value instanceof RegExp ? value : String(value);
    await this.page.waitForSelector(`text=${valueString}`);
    expect(await this.page.isVisible(`text=${valueString}`)).toBeTruthy();
    console.log(`Value "${valueString}" is displayed`);
  }

  /**
   * Click a tab with the given name
   */
  async clickTab(tabName: string) {
    await this.page.click(`div.ant-tabs-tab:has-text("${tabName}")`);
    console.log(`Clicked on tab: ${tabName}`);
  }
}

// Helper functions that don't require page instance
export async function mockSensorData() {
  return {
    temperature: 22.5,
    humidity: 45,
    waterUsage: 5.2,
    co2: 400,
    pressure: 1013,
    altitude: 100,
    imu: {
      acceleration: [0.1, 0.2, 0.3],
      gyroscope: [0.5, 0.6, 0.7],
      magnetometer: [0.8, 0.9, 1.0],
    },
  };
}

export async function mockRoom(roomName: string, data: any = {}) {
  return {
    id: roomName,
    temperature: 23,
    humidity: 50,
    flow_rate: 2.5,
    ...data,
  };
}

export async function setupAuthToken(page: Page) {
  // Mock successful auth token
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'fake-access-token');
    localStorage.setItem('idToken', 'fake-id-token');
    localStorage.setItem('refreshToken', 'fake-refresh-token');
  });
}

export async function mockVehicleData() {
  return {
    accel_magnitude: 0.35,
    rotation_rate: 0.12,
    orientation: {
      pitch: 2.1,
      roll: 1.5,
      heading: 180.2
    },
    movement_type: 'steady_movement',
    timestamp: new Date().toISOString()
  };
}

export async function mockPredictionData(dataType: string = 'temperature') {
  return {
    data_type: dataType,
    predictions: [
      { date: new Date(Date.now() + 86400000).toISOString().split('T')[0], predicted_value: 22.8 },
      { date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], predicted_value: 23.1 },
      { date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], predicted_value: 23.5 },
      { date: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0], predicted_value: 22.9 },
      { date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], predicted_value: 22.7 }
    ],
    anomalies: [
      { date: new Date(Date.now() + 86400000 * 2).toISOString(), value: 28.5 }
    ],
    data_points_analysed: 120
  };
}