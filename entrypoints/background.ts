import { browserApi } from './shared/browser';

export default defineBackground(() => {
  // Lightweight background; logic is handled in popup/content with storage listeners.
  console.debug('AutoCSS background ready', { id: browserApi.runtime.id });
});
