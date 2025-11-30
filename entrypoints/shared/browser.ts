// Graceful access to the extension API on Chrome (chrome.*) and Firefox (browser.*)
export const browserApi: typeof browser =
  (globalThis as any).browser ?? ((globalThis as any).chrome as typeof browser);
