import { test, expect } from '@playwright/test';

test.describe('Portfolio Homepage', () => {
  test('should load the homepage successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Portfolio/);
  });

  test('should have main navigation elements', async ({ page }) => {
    await page.goto('/');
    
    // Check for main navigation sections
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByRole('link', { name: /projects/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /experience/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /contact/i })).toBeVisible();
  });

  test('should have proper meta description', async ({ page }) => {
    await page.goto('/');
    const metaDescription = await page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/); // Ensures description exists
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page).toHaveScreenshot('mobile-viewport.png', {
      maxDiffPixelRatio: 0.1,
    });

    // Test desktop viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page).toHaveScreenshot('desktop-viewport.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
}); 