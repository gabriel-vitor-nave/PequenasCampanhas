import { expect, test } from '@playwright/test'

test('unconfigured application explains setup without claiming working persistence', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Toda grande aventura/ })).toBeVisible()
  await expect(page.getByText('VITE_SUPABASE_PUBLISHABLE_KEY', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Criar campanha' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('setup has no browser runtime errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/campanhas/00000000-0000-4000-8000-000000000001')
  await expect(page.getByRole('heading', { name: 'Conecte sua plataforma' })).toBeVisible()
  expect(errors).toEqual([])
})
