import { expect, test } from '@playwright/test'

test('loads the dashboard', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Resolution too small' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Time selection' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'Nrgy' })).toBeVisible()
})
