import { defineConfig } from '@playwright/test'

const requestedPort = process.env.MJL_PLAYWRIGHT_PORT || '4173'
if (!/^\d+$/.test(requestedPort))
  throw new Error('MJL_PLAYWRIGHT_PORT must be an integer from 1 to 65535')
const port = Number(requestedPort)
if (port < 1 || port > 65535)
  throw new Error('MJL_PLAYWRIGHT_PORT must be an integer from 1 to 65535')
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: process.env.MJL_PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: `npm run preview -- --host 127.0.0.1 --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
      },
})
