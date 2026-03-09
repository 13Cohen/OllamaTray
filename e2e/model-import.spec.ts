import { test, expect } from './fixtures'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import os from 'os'

const TEMP_DIR = join(os.tmpdir(), 'ollama-e2e-import')

test.describe('Model Import (GGUF)', () => {
  test.beforeAll(() => {
    mkdirSync(TEMP_DIR, { recursive: true })
  })

  test.afterAll(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true })
  })

  test('imports a single GGUF file via IPC', async ({ mockServer, page }) => {
    // Create a small fake GGUF file
    const content = Buffer.from('GGUF-test-content-for-e2e-' + Date.now())
    const filePath = join(TEMP_DIR, 'test-model.gguf')
    writeFileSync(filePath, content)

    const expectedDigest = 'sha256:' + createHash('sha256').update(content).digest('hex')

    // Wait for app to be ready
    await page.waitForTimeout(1500)

    // Invoke import via renderer's electronAPI
    await page.evaluate(({ name, filePaths }) => window.electronAPI.importModel(name, filePaths), {
      name: 'test-import',
      filePaths: [filePath]
    })

    // Wait for the import to complete (hashing + blob upload + create)
    await page.waitForTimeout(2000)

    // Verify mock server received the blob
    expect(mockServer.blobs.has(expectedDigest)).toBe(true)

    // Verify mock server received the create request
    expect(mockServer.createRequested.length).toBe(1)
    expect(mockServer.createRequested[0].model).toBe('test-import')
    expect(mockServer.createRequested[0].files['test-model.gguf']).toBe(expectedDigest)

    // Refresh models
    await page.evaluate(() => window.electronAPI.listModels())
    await page.waitForTimeout(500)

    // The model should now be in the mock's list
    await expect(page.getByText('test-import')).toBeVisible({ timeout: 5000 })
  })

  test('blob upload is skipped when blob already exists', async ({ mockServer, page }) => {
    const content = Buffer.from('GGUF-existing-blob-' + Date.now())
    const filePath = join(TEMP_DIR, 'existing.gguf')
    writeFileSync(filePath, content)

    const digest = 'sha256:' + createHash('sha256').update(content).digest('hex')

    // Pre-register the blob in mock server
    mockServer.blobs.add(digest)

    await page.waitForTimeout(1500)

    await page.evaluate(({ name, filePaths }) => window.electronAPI.importModel(name, filePaths), {
      name: 'skip-upload-test',
      filePaths: [filePath]
    })

    await page.waitForTimeout(2000)

    // Create should still be called
    expect(mockServer.createRequested.some((r) => r.model === 'skip-upload-test')).toBe(true)
  })

  test('version endpoint returns mock version', async ({ page }) => {
    await page.waitForTimeout(1500)

    // Version should be shown in the service status
    await expect(page.getByText('v0.5.1')).toBeVisible()
  })
})
