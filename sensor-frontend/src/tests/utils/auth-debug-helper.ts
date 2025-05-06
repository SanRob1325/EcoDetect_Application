import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Simple function to log auth state without complex operations
 */
export async function debugAuthState(page: Page) {
  try {
    console.log('\n=== Authentication Debug ===');
    console.log('Current URL:', page.url());
    
    // Basic information that doesn't require complex evaluation
    const title = await page.title();
    console.log('Page title:', title);
    
    console.log('===========================\n');
  } catch (error) {
    console.error('Error in debugAuthState:', error);
  }
}

/**
 * Simple function to capture screenshot on failure
 */
export async function captureFailureState(page: Page, testName: string) {
  try {
    // Create directory if it doesn't exist
    const dir = 'test-results';
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Take screenshot if possible
    try {
      await page.screenshot({ 
        path: path.join(dir, `${testName}-failure.png`),
        fullPage: true 
      });
      console.log(`Screenshot saved to ${testName}-failure.png`);
    } catch (screenshotError) {
      console.error('Failed to take screenshot:', screenshotError);
    }
    
    // Log basic debug info
    console.log(`Test failed: ${testName}`);
    console.log('Current URL:', page.url());
  } catch (error) {
    console.error('Error in captureFailureState:', error);
  }
}