function optionsUrl(): string {
  return browser.runtime.getURL('/options.html')
}

/** Open settings in a normal browser tab, reusing an existing options tab. */
export async function openControlPanel(): Promise<void> {
  const url = optionsUrl()

  try {
    const tabs = await browser.tabs.query({})
    const match = tabs.find(
      (tab) =>
        typeof tab.url === 'string' &&
        (tab.url === url || tab.url.startsWith(`${url}?`) || tab.url.startsWith(`${url}#`)),
    )
    if (match?.id != null) {
      await browser.tabs.update(match.id, { active: true })
      if (match.windowId != null) {
        await browser.windows.update(match.windowId, { focused: true })
      }
      return
    }
  } catch {
    // fall through to create
  }

  await browser.tabs.create({ url, active: true })
}
