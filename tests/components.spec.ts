import { test, expect } from '@playwright/test'

test.describe('Components', () => {
  test('welcome scramble settles to the name', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      "Hi, I'm"
    )
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Peter Bodnar',
      { timeout: 5000 }
    )
  })

  test('contact social links are on the home page', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Get in Touch' })
    ).toBeVisible()
    await expect(page.locator('a[href*="linkedin.com"]')).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/peterbodnar/'
    )
    await expect(page.locator('a[href*="github.com"]')).toHaveAttribute(
      'href',
      'https://github.com/ptbdnr'
    )
  })

  test('about page has intro, work and education', async ({ page }) => {
    await page.goto('/about')
    await expect(
      page.getByRole('heading', { name: /ML Engineer/ })
    ).toBeVisible()
    await expect(page.getByText('Kainos')).toBeVisible()
    await expect(page.getByText('Aarhus University')).toBeVisible()
  })

  test('nav navigates to the blog', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Blog' })
      .click()
    await expect(page).toHaveURL(/\/blog$/)
    await expect(
      page.getByRole('heading', { name: 'Blog', level: 1 })
    ).toBeVisible()
  })
})
