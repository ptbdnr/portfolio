import { test, expect } from '@playwright/test';

test.describe('Home', () => {
  test('loads with the right title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Portfolio/);
  });

  test('global nav is present', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: 'Blog' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'About' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Stats' })).toBeVisible();
  });

  test('shows welcome, chat and contact', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Peter Bodnar');
    await expect(
      page.getByRole('heading', { name: 'Ask me anything' })
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Get in Touch' })
    ).toBeVisible();
  });

  test('has a meta description', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /.+/
    );
  });

  test('nav collapses to a menu button on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: /toggle menu/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(
      page.locator('#mobile-menu').getByRole('link', { name: 'Blog' })
    ).toBeVisible();
  });
});
