import { test, expect } from './fixtures'

test.describe('Model Pull', () => {
  test('pull input is visible when service is running', async ({ page }) => {
    await page.waitForTimeout(1500)

    const pullInput = page.getByPlaceholder('Pull model')
    await expect(pullInput).toBeVisible()
  })

  test('pull input is hidden when service is stopped', async ({ mockServer, page }) => {
    mockServer.setHealthy(false)
    await page.reload()
    await page.waitForTimeout(1000)

    await expect(page.getByPlaceholder('Pull model')).not.toBeVisible()
  })

  test('download button is disabled when input is empty', async ({ page }) => {
    await page.waitForTimeout(1500)

    // The download button near the pull input
    const pullSection = page.locator('.border-t').last()
    const downloadBtn = pullSection.getByRole('button')
    await expect(downloadBtn).toBeDisabled()
  })

  test('can initiate a model pull and see progress', async ({ mockServer, page }) => {
    await page.waitForTimeout(1500)

    const pullInput = page.getByPlaceholder('Pull model')
    await pullInput.fill('test-model:latest')
    await pullInput.press('Enter')

    // Wait for pull to be processed
    await page.waitForTimeout(500)

    // Verify mock server received the pull request
    expect(mockServer.pullRequested.some((p) => p.name === 'test-model:latest')).toBe(true)

    // Progress should show the model name
    await expect(page.getByText('test-model:latest')).toBeVisible()

    // Wait for the pull to complete (mock sends 7 steps at 100ms each)
    await page.waitForTimeout(1500)

    // After completion, the new model should appear in the list
    await page.waitForTimeout(1000)
    await expect(page.getByText('test-model:latest')).toBeVisible()
  })

  test('pull input clears after submitting', async ({ page }) => {
    await page.waitForTimeout(1500)

    const pullInput = page.getByPlaceholder('Pull model')
    await pullInput.fill('some-model:7b')
    await pullInput.press('Enter')

    // Input should be cleared
    await expect(pullInput).toHaveValue('')
  })
})
