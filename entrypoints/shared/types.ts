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

export type PopupRequestMessage =
  | { type: 'GET_SNIPPETS' }
  | { type: 'CREATE_SNIPPET'; payload: SnippetInput }
  | { type: 'UPDATE_SNIPPET'; payload: { id: string; patch: Partial<Omit<Snippet, 'id' | 'createdAt'>> } }
  | { type: 'DELETE_SNIPPET'; payload: { id: string } }
  | { type: 'TOGGLE_SNIPPET'; payload: { id: string; enabled: boolean } }
  | { type: 'REORDER_SNIPPETS'; payload: { idsInOrder: string[] } }
  | { type: 'RESET_ACTIVE_TAB' }
  | { type: 'GET_ACTIVE_TAB' };

export type ContentRequestMessage = {
  type: 'GET_MATCHED_SNIPPETS';
  payload: { url: string };
};

export type MessageToContent =
  | { type: 'APPLY_SNIPPETS'; payload: { snippets: MatchedSnippet[] } }
  | { type: 'CLEAR_SNIPPETS' };

