import { MatchedSnippet, Snippet } from './types';

const normalizePattern = (pattern: string) => {
  // 補助: スキームがない場合は任意スキームを許可する
  if (!pattern.includes('://')) {
    return `*://${pattern}`;
  }
  return pattern;
};

const wildcardToRegex = (pattern: string) => {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
};

export const matchSnippetsForUrl = (url: string, snippets: Snippet[]): MatchedSnippet[] => {
  return snippets
    .filter((snippet) => snippet.enabled)
    .filter((snippet) => {
      if (!snippet.scopePattern) return false;
      const normalized = normalizePattern(snippet.scopePattern.trim());
      const regex = wildcardToRegex(normalized);
      return regex.test(url);
    })
    .map((snippet) => ({
      id: snippet.id,
      name: snippet.name,
      cssText: snippet.cssText,
      order: snippet.order,
    }))
    .sort((a, b) => a.order - b.order);
};
