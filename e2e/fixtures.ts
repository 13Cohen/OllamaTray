import { test as base, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import path from 'node:path'
import { MockOllamaServer } from './mock-ollama-server'

type TestFixtures = {
  mockServer: MockOllamaServer
  electronApp: ElectronApplication
  page: Page
}

export const test = base.extend<TestFixtures>({
  mockServer: async ({}, use) => {
    const server = new MockOllamaServer()
    await server.start()
    await use(server)
    await server.stop()
  },

  electronApp: async ({ mockServer }, use) => {
    const appPath = path.resolve(__dirname, '..')
    const app = await electron.launch({
      args: [path.join(appPath, 'out/main/index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        OLLAMA_HOST: mockServer.url
      }
    })
    await use(app)
    await app.close()
  },

  page: async ({ electronApp }, use) => {
    // The app creates a hidden window; get it and force-show for testing
    const page = await electronApp.firstWindow()

    // Force the window to be visible and focused
    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const wins = BrowserWindow.getAllWindows()
      if (wins.length > 0) {
        const win = wins[0]
        win.removeAllListeners('blur') // prevent auto-hide during tests
        win.show()
        win.focus()
      }
    })

    // Wait for the app to fully render
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)

    await use(page)
  }
})

export { expect } from '@playwright/test'
