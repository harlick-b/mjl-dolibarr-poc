import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

const template = readFileSync(
  new URL(
    '../../backend/app/mail_templates/activity-reminder.html',
    import.meta.url,
  ),
  'utf8',
)

function reminderHtml() {
  const values = {
    app_name: 'MJL',
    email_title: 'Rappel d’échéance',
    recipient_name: 'Aminata ' + 'Dossou '.repeat(32),
    activity_reference: 'ACT-2028-001',
    activity_name: 'Activité très longue ' + 'coordination '.repeat(30),
    activity_end_date: '29 février 2028',
  }
  let html = template.replace(
    '{% if recipient_name %} {{ recipient_name }}{% endif %}',
    ` ${values.recipient_name}`,
  )
  for (const [name, value] of Object.entries(values)) {
    html = html.replaceAll(new RegExp(`{{\\s*${name}\\s*}}`, 'g'), value)
  }
  return html
}

for (const viewport of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'desktop', width: 1440, height: 1000 },
]) {
  test(`long reminder content fits the ${viewport.name} email viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.setContent(reminderHtml())

    await expect(
      page.getByText('29 février 2028', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('ACT-2028-001')).toBeVisible()
    const layout = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      contentRight: document
        .querySelector('.email-content')
        .getBoundingClientRect().right,
    }))
    expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.contentRight).toBeLessThanOrEqual(layout.viewportWidth)
  })
}
