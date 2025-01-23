import { test, expect } from '@playwright/test'

test.describe('Component Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display intro section with scramble text', async ({ page }) => {
    // Check initial greeting
    await expect(page.locator('h1')).toContainText("Hi, I'm")
    
    // Wait for scramble animation to complete
    await expect(page.locator('h1')).toContainText('Peter Bodnar', { timeout: 5000 })
    
    // Verify subtitle
    await expect(page.getByRole('heading', { level: 2 }))
      .toContainText('ML Engineer')
  })

  test('should display contact section with social links', async ({ page }) => {
    // Navigate to contact section
    await page.goto('/#contact')
    
    // Check section title
    await expect(page.getByRole('heading', { level: 2 }))
      .toContainText('Get in Touch')
    
    // Verify social links
    const linkedinLink = page.locator('a[href*="linkedin.com"]')
    const githubLink = page.locator('a[href*="github.com"]')
    
    await expect(linkedinLink).toHaveAttribute('href', 'https://www.linkedin.com/in/peterbodnar/')
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/ptbdnr')
    
    // Verify links open in new tab
    await expect(linkedinLink).toHaveAttribute('target', '_blank')
    await expect(githubLink).toHaveAttribute('target', '_blank')
  })

  test('should have proper navigation', async ({ page }) => {
    // Check if navbar links exist and are clickable
    const navLinks = page.locator('nav a')
    await expect(navLinks).toHaveCount(5) // Adjust based on your actual nav items
    
    // Test smooth scroll navigation
    await page.click('a[href="#contact"]')
    await expect(page.url()).toContain('#contact')
  })
}) 