export type Snippet = {
  id: string;
  name: string;
  cssText: string;
  scopePattern: string;
  enabled: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
};

export type SnippetInput = {
  name: string;
  cssText: string;
  scopePattern: string;
  enabled?: boolean;
};

export type MatchedSnippet = {
  id: string;
  name: string;
  cssText: string;
  order: number;
};
