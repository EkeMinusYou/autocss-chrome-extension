import { browserApi } from './shared/browser';
import { matchSnippetsForUrl } from './shared/pattern';
import { deleteSnippetById, loadSnippets, saveSnippets, upsertSnippet } from './shared/storage';
import {
  ContentRequestMessage,
  MatchedSnippet,
  PopupRequestMessage,
  Snippet,
  SnippetInput,
} from './shared/types';

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `snippet-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getNextOrder = (snippets: Snippet[]) => {
  if (snippets.length === 0) return 0;
  return Math.max(...snippets.map((s) => s.order)) + 1;
};

const getActiveTab = async () => {
  try {
    const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined) return null;
    return tab;
  } catch (error) {
    console.warn('Failed to query active tab', error);
    return null;
  }
};

const pushSnippetsToTab = async (tabId: number, url: string, snippets: Snippet[]) => {
  const matches = matchSnippetsForUrl(url, snippets);
  try {
    await browserApi.tabs.sendMessage(tabId, {
      type: 'APPLY_SNIPPETS',
      payload: { snippets: matches },
    } satisfies { type: 'APPLY_SNIPPETS'; payload: { snippets: MatchedSnippet[] } });
  } catch (error) {
    console.warn('Failed to push snippets to tab', tabId, error);
  }
};

const syncActiveTab = async () => {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) return;
  const snippets = await loadSnippets();
  await pushSnippetsToTab(tab.id, tab.url, snippets);
};

const handlePopupMessage = async (message: PopupRequestMessage) => {
  if (message.type === 'GET_SNIPPETS') {
    return loadSnippets();
  }

  if (message.type === 'GET_ACTIVE_TAB') {
    const tab = await getActiveTab();
    return tab ? { id: tab.id, url: tab.url } : null;
  }

  if (message.type === 'RESET_ACTIVE_TAB') {
    const tab = await getActiveTab();
    if (tab?.id) {
      try {
        await browserApi.tabs.sendMessage(tab.id, { type: 'CLEAR_SNIPPETS' });
      } catch (error) {
        console.warn('Failed to clear snippets for tab', tab.id, error);
      }
    }
    return;
  }

  if (message.type === 'CREATE_SNIPPET') {
    const payload: SnippetInput = message.payload;
    const now = Date.now();
    const current = await loadSnippets();
    const newSnippet: Snippet = {
      id: generateId(),
      name: payload.name || 'Untitled',
      cssText: payload.cssText,
      scopePattern: payload.scopePattern,
      enabled: payload.enabled ?? true,
      order: getNextOrder(current),
      createdAt: now,
      updatedAt: now,
    };
    current.push(newSnippet);
    await saveSnippets(current);
    await syncActiveTab();
    return newSnippet;
  }

  if (message.type === 'UPDATE_SNIPPET') {
    const { id, patch } = message.payload;
    const snippets = await loadSnippets();
    const index = snippets.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const updated: Snippet = {
      ...snippets[index],
      ...patch,
      updatedAt: Date.now(),
    };
    await upsertSnippet(updated);
    await syncActiveTab();
    return updated;
  }

  if (message.type === 'DELETE_SNIPPET') {
    await deleteSnippetById(message.payload.id);
    await syncActiveTab();
    return true;
  }

  if (message.type === 'TOGGLE_SNIPPET') {
    const { id, enabled } = message.payload;
    const snippets = await loadSnippets();
    const index = snippets.findIndex((s) => s.id === id);
    if (index === -1) return null;
    snippets[index] = { ...snippets[index], enabled, updatedAt: Date.now() };
    await saveSnippets(snippets);
    await syncActiveTab();
    return snippets[index];
  }

  if (message.type === 'REORDER_SNIPPETS') {
    const { idsInOrder } = message.payload;
    const snippets = await loadSnippets();
    const orderMap = new Map<string, number>();
    idsInOrder.forEach((id, idx) => orderMap.set(id, idx));
    const reordered = snippets.map((snippet) =>
      orderMap.has(snippet.id) ? { ...snippet, order: orderMap.get(snippet.id)! } : snippet,
    );
    reordered.sort((a, b) => a.order - b.order).forEach((snippet, idx) => {
      snippet.order = idx;
    });
    await saveSnippets(reordered);
    await syncActiveTab();
    return reordered;
  }

  return null;
};

const handleContentMessage = async (message: ContentRequestMessage) => {
  if (message.type === 'GET_MATCHED_SNIPPETS') {
    const snippets = await loadSnippets();
    return matchSnippetsForUrl(message.payload.url, snippets);
  }
  return null;
};

export default defineBackground(() => {
  browserApi.runtime.onMessage.addListener((message: unknown, sender) => {
    if ((message as ContentRequestMessage)?.type === 'GET_MATCHED_SNIPPETS') {
      return handleContentMessage(message as ContentRequestMessage);
    }
    if (typeof (message as PopupRequestMessage)?.type === 'string') {
      return handlePopupMessage(message as PopupRequestMessage);
    }
    return undefined;
  });
});
