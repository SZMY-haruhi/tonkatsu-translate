const PANEL_WIDTH = 760
const PANEL_HEIGHT = 820

function optionsUrl(): string {
  return browser.runtime.getURL('/options.html')
}

/** Open settings as a dedicated control-panel window (reuse if already open). */
export async function openControlPanel(): Promise<void> {
  const url = optionsUrl()

  try {
    const windows = await browser.windows.getAll({
      populate: true,
      windowTypes: ['popup', 'normal'],
    })
    for (const win of windows) {
      const match = win.tabs?.find(
        (tab) =>
          typeof tab.url === 'string' &&
          (tab.url === url || tab.url.startsWith(`${url}?`) || tab.url.startsWith(`${url}#`)),
      )
      if (match && win.id != null) {
        await browser.windows.update(win.id, { focused: true })
        if (match.id != null) {
          await browser.tabs.update(match.id, { active: true })
        }
        return
      }
    }
  } catch {
    // fall through to create
  }

  await browser.windows.create({
    url,
    type: 'popup',
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    focused: true,
  })
}
