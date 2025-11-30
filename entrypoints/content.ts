import { browserApi } from './shared/browser';
import { loadSnippets, STORAGE_KEY } from './shared/storage';
import { matchSnippetsForUrl } from './shared/pattern';
import { MatchedSnippet } from './shared/types';

const STYLE_ATTR = 'data-autocss';

const removeAllStyles = () => {
  document.querySelectorAll(`style[${STYLE_ATTR}]`).forEach((node) => node.remove());
};

const applySnippets = (snippets: MatchedSnippet[]) => {
  removeAllStyles();
  const head = document.head || document.documentElement;
  const sorted = [...snippets].sort((a, b) => a.order - b.order);
  sorted.forEach((snippet) => {
    const style = document.createElement('style');
    style.setAttribute(STYLE_ATTR, snippet.id);
    style.textContent = snippet.cssText;
    head.appendChild(style);
  });
};

const applyFromStorage = async () => {
  try {
    const snippets = await loadSnippets();
    const matched = matchSnippetsForUrl(location.href, snippets);
    applySnippets(matched);
  } catch (error) {
    console.error('Failed to apply snippets from storage', error);
  }
};

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    applyFromStorage();

    type MessageToContent =
      | { type: 'APPLY_SNIPPETS'; payload: { snippets: MatchedSnippet[] } }
      | { type: 'CLEAR_SNIPPETS' };

    browserApi.runtime.onMessage.addListener((message: MessageToContent) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'APPLY_SNIPPETS') {
        applySnippets(message.payload.snippets);
      }
      if (message.type === 'CLEAR_SNIPPETS') {
        removeAllStyles();
      }
    });

    browserApi.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (!(STORAGE_KEY in changes)) return;
      applyFromStorage();
    });
  },
});
