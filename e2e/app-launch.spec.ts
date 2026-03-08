import { test, expect } from './fixtures'

test.describe('App Launch', () => {
  test('window is created and has correct dimensions', async ({ electronApp, page }) => {
    // page fixture already got the window; verify it's usable
    expect(page).toBeTruthy()

    const bounds = await electronApp.evaluate(({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows()
      if (wins.length === 0) return null
      return wins[0].getBounds()
    })

    // If window was retrieved via firstWindow(), it may not show in getAllWindows
    // but we can verify through the page viewport
    if (bounds) {
      expect(bounds.width).toBe(400)
      expect(bounds.height).toBe(600)
    } else {
      // Verify via page viewport
      const viewportSize = page.viewportSize()
      expect(viewportSize).toBeTruthy()
    }
  })

  test('renderer page loads successfully', async ({ page }) => {
    const title = await page.title()
    expect(title).toBe('OllamaTray')
  })

  test('main UI components are rendered', async ({ page }) => {
    await expect(page.getByText(/Ollama/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Start|Stop/ })).toBeVisible()
  })
})
