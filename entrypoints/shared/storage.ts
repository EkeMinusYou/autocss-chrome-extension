import { browserApi } from './browser';
import { Snippet } from './types';

export const STORAGE_KEY = 'autocss:snippets';

export const loadSnippets = async (): Promise<Snippet[]> => {
  const result = await browserApi.storage.local.get(STORAGE_KEY);
  const snippets: Snippet[] = result[STORAGE_KEY] ?? [];
  return snippets.sort((a, b) => a.order - b.order);
};

export const saveSnippets = async (snippets: Snippet[]) => {
  await browserApi.storage.local.set({ [STORAGE_KEY]: snippets });
};

export const deleteSnippetById = async (id: string) => {
  const snippets = await loadSnippets();
  const filtered = snippets.filter((snippet) => snippet.id !== id);
  await saveSnippets(filtered);
  return filtered;
};

export const upsertSnippet = async (snippet: Snippet) => {
  const snippets = await loadSnippets();
  const existingIndex = snippets.findIndex((s) => s.id === snippet.id);
  if (existingIndex >= 0) {
    snippets[existingIndex] = snippet;
  } else {
    snippets.push(snippet);
  }
  await saveSnippets(snippets);
  return snippets;
};
