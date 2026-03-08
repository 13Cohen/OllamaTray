import { test, expect } from './fixtures'

test.describe('Model List', () => {
  test('displays model list when service is running', async ({ page }) => {
    await page.waitForTimeout(1500)

    await expect(page.getByText('llama3.2:3b')).toBeVisible()
    await expect(page.getByText('qwen2.5:7b')).toBeVisible()
    await expect(page.getByText('deepseek-r1:14b')).toBeVisible()
  })

  test('shows model size and quantization', async ({ page }) => {
    await page.waitForTimeout(1500)

    // Check for size format (e.g. "1.9 GB")
    await expect(page.getByText('1.9 GB')).toBeVisible()
    // Check for quantization badge
    await expect(page.getByText('Q4_K_M').first()).toBeVisible()
  })

  test('shows parameter size', async ({ page }) => {
    await page.waitForTimeout(1500)

    await expect(page.getByText('3.2B')).toBeVisible()
    await expect(page.getByText('7B', { exact: true })).toBeVisible()
    await expect(page.getByText('14B', { exact: true })).toBeVisible()
  })

  test('search filters models', async ({ page }) => {
    await page.waitForTimeout(1500)

    const searchInput = page.getByPlaceholder('Search models...')
    await searchInput.fill('llama')

    await expect(page.getByText('llama3.2:3b')).toBeVisible()
    await expect(page.getByText('qwen2.5:7b')).not.toBeVisible()
    await expect(page.getByText('deepseek-r1:14b')).not.toBeVisible()
  })

  test('search shows no results message', async ({ page }) => {
    await page.waitForTimeout(1500)

    const searchInput = page.getByPlaceholder('Search models...')
    await searchInput.fill('nonexistent-model-xyz')

    await expect(page.getByText('No matching models')).toBeVisible()
  })

  test('sort button cycles through sort modes', async ({ page }) => {
    await page.waitForTimeout(1500)

    const sortButton = page.getByRole('button', { name: /Recent|Name|Size/ })
    await expect(sortButton).toBeVisible()

    // Default sort is "Recent"
    await expect(sortButton).toContainText('Recent')

    // Click to cycle to "Name"
    await sortButton.click()
    await expect(sortButton).toContainText('Name')

    // Click to cycle to "Size"
    await sortButton.click()
    await expect(sortButton).toContainText('Size')
  })
})
