import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

test('registers and signs in again with only username and password', async ({ page }, info) => {
  test.skip(process.env.E2E_LIVE_ACCOUNTS !== '1' || info.project.name !== 'desktop', 'Explicit hosted check with a disposable account')
  const username = 'pc_browser_' + randomUUID().replaceAll('-', '').slice(0, 10)
  const password = randomUUID() + 'Aa1!'
  console.log('Disposable browser username: ' + username)
  await page.goto('/cadastro')
  await expect(page.locator('form input')).toHaveCount(2)
  await page.getByRole('textbox', { name: 'Usuário', exact: true }).fill(username)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Criar conta e entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Campanhas', exact: true })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('@accounts.pequenas-campanhas.invalid', { exact: false })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sair da conta' }).click()
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  await page.getByRole('textbox', { name: 'Usuário', exact: true }).fill(username)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Campanhas', exact: true })).toBeVisible()
  await page.screenshot({ path: info.outputPath('username-home.png'), fullPage: true })
  await info.attach('disposable-account.json', { body: JSON.stringify({ username }), contentType: 'application/json' })
})
