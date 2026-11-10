import { expect, test } from '@playwright/test'

test('connected application requires login without exposing campaigns', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sua aventura continua.' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Usuário' })).toBeVisible()
  await expect(page.locator('form input')).toHaveCount(2)
  await expect(page.locator('input[type="email"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Criar campanha' })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('protected deep links preserve destination and have no browser runtime errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/campanhas/00000000-0000-4000-8000-000000000001')
  await expect(page.getByRole('heading', { name: 'Sua aventura continua.' })).toBeVisible()
  await expect(page).toHaveURL(/entrar\?next=/)
  expect(errors).toEqual([])
})
