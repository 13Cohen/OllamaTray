import { test, expect } from './fixtures'

test.describe('Service Status', () => {
  test('shows running status when Ollama is healthy', async ({ page }) => {
    // Mock server is healthy by default
    await page.waitForTimeout(1000)
    await expect(page.getByText('Ollama Running')).toBeVisible()
    await expect(page.getByRole('button', { name: /Stop/ })).toBeVisible()
  })

  test('shows stopped status when Ollama is not healthy', async ({ mockServer, page }) => {
    mockServer.setHealthy(false)
    // Trigger a status refresh by reloading
    await page.reload()
    await page.waitForTimeout(1000)
    await expect(page.getByText('Ollama Stopped')).toBeVisible()
    await expect(page.getByRole('button', { name: /Start/ })).toBeVisible()
  })

  test('shows empty state when service is stopped', async ({ mockServer, page }) => {
    mockServer.setHealthy(false)
    await page.reload()
    await page.waitForTimeout(1000)
    await expect(page.getByText('Start Ollama to view models')).toBeVisible()
  })
})
