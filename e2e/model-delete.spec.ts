import { test, expect } from './fixtures'

test.describe('Model Delete', () => {
  test('shows delete confirmation dialog', async ({ page }) => {
    await page.waitForTimeout(1500)

    // The delete button has opacity-0 (CSS hover effect), use force click
    const deleteBtn = page.getByRole('button', { name: 'Delete llama3.2:3b' })
    await deleteBtn.click({ force: true })

    // Confirmation dialog should appear
    await expect(page.getByText('Delete Model')).toBeVisible()
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible()
  })

  test('cancel delete dismisses dialog', async ({ page }) => {
    await page.waitForTimeout(1500)

    const deleteBtn = page.getByRole('button', { name: 'Delete llama3.2:3b' })
    await deleteBtn.click({ force: true })

    await expect(page.getByText('Delete Model')).toBeVisible()

    // Click cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Dialog should be dismissed
    await expect(page.getByText('Delete Model')).not.toBeVisible()
    // Model should still be in the list
    await expect(page.getByText('llama3.2:3b')).toBeVisible()
  })

  test('confirm delete removes model and refreshes list', async ({ mockServer, page }) => {
    await page.waitForTimeout(1500)

    const deleteBtn = page.getByRole('button', { name: 'Delete llama3.2:3b' })
    await deleteBtn.click({ force: true })

    // Click the Delete button in the dialog
    await page.getByRole('button', { name: 'Delete', exact: true }).click()

    // Wait for the delete to process and list to refresh
    await page.waitForTimeout(1000)

    // Model should be removed from the list
    await expect(page.getByText('llama3.2:3b')).not.toBeVisible()

    // Verify the mock server received the delete request
    expect(mockServer.deleteRequested).toContain('llama3.2:3b')

    // Other models should still be visible
    await expect(page.getByText('qwen2.5:7b')).toBeVisible()
  })
})
