import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById, waitForEditor } from './helpers'

// #3516 — a heading that begins with an image (`# ![alt](url) Section`) showed
// the raw image markdown in the TOC/"content table". The TOC label should not
// display image tags.

const INITIAL_DOC = '# ![My Icon](https://example.com/i.png) Section One\n\n## Plain Two\n'

const readTocLabels = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('.side-bar-toc .el-tree-node__label')).map(
      (el) => (el.textContent || '').trim()
    )
  )

const ensureSidebarVisible = async(app: ElectronApplication, page: Page): Promise<void> => {
  const visible = await page.evaluate(() => {
    const el = document.querySelector('.side-bar') as HTMLElement | null
    return !!(el && el.offsetParent !== null)
  })
  if (!visible) {
    await clickMenuById(app, 'sideBarMenuItem')
    await page.waitForFunction(
      () => {
        const el = document.querySelector('.side-bar') as HTMLElement | null
        return !!(el && el.offsetParent !== null)
      },
      null,
      { timeout: 5000 }
    )
  }
}

test.describe('TOC hides image tags in headings (#3516)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(INITIAL_DOC)
    app = launched.app
    page = launched.page
    await waitForEditor(page)
    await ensureSidebarVisible(app, page)
    await clickMenuById(app, 'tocMenuItem')
    await page.waitForSelector('.side-bar-toc .el-tree', { state: 'visible', timeout: 10000 })
    await page.waitForFunction(
      () => document.querySelectorAll('.side-bar-toc .el-tree-node__label').length >= 2,
      null,
      { timeout: 10000 }
    )
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the image markdown is stripped from the TOC entry', async() => {
    const labels = await readTocLabels(page)
    // The image heading must not render its markdown; the alt text is kept.
    expect(labels[0]).toBe('My Icon Section One')
    expect(labels[0]).not.toContain('![')
    expect(labels[0]).not.toContain('](')
    expect(labels[1]).toBe('Plain Two')
  })
})
