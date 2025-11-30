import { FormEvent, useEffect, useMemo, useState } from 'react';
import { browserApi } from '../shared/browser';
import { matchSnippetsForUrl } from '../shared/pattern';
import { loadSnippets, saveSnippets } from '../shared/storage';
import { MatchedSnippet, Snippet } from '../shared/types';
import './App.css';

type FormState = {
  id?: string;
  name: string;
  scopePattern: string;
  cssText: string;
  enabled: boolean;
};

const emptyForm: FormState = {
  name: '',
  scopePattern: '',
  cssText: '',
  enabled: true,
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `snippet-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getNextOrder = (snippets: Snippet[]) => {
  if (snippets.length === 0) return 0;
  return Math.max(...snippets.map((s) => s.order)) + 1;
};

const getActiveTab = async () => {
  const [tab] = await browserApi.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) return null;
  return tab;
};

function App() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const matched = useMemo<MatchedSnippet[]>(() => {
    if (!activeUrl) return [];
    return matchSnippetsForUrl(activeUrl, snippets);
  }, [activeUrl, snippets]);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await loadSnippets();
      setSnippets(list);
      setError(null);
    } catch (err) {
      setError('Failed to load snippets');
      setSnippets([]);
      console.error(err);
    }
    try {
      const tab = await getActiveTab();
      setActiveUrl(tab?.url ?? '');
    } catch (err) {
      console.warn('Failed to get active tab', err);
      setActiveUrl('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch((err) => {
      setError('Failed to load snippets');
      console.error(err);
    });
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.scopePattern.trim()) {
      setError('Scope pattern is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const current = await loadSnippets();
      const now = Date.now();
      if (form.id) {
        const index = current.findIndex((s) => s.id === form.id);
        if (index !== -1) {
          current[index] = {
            ...current[index],
            name: form.name.trim() || 'Untitled',
            scopePattern: form.scopePattern.trim(),
            cssText: form.cssText,
            enabled: form.enabled,
            updatedAt: now,
          };
        }
        await saveSnippets(current);
      } else {
        const newSnippet: Snippet = {
          id: generateId(),
          name: form.name.trim() || 'Untitled',
          scopePattern: form.scopePattern.trim(),
          cssText: form.cssText,
          enabled: form.enabled,
          order: getNextOrder(current),
          createdAt: now,
          updatedAt: now,
        };
        current.push(newSnippet);
        await saveSnippets(current);
      }
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError('保存に失敗しました');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const list = await loadSnippets();
      const filtered = list.filter((s) => s.id !== id);
      await saveSnippets(filtered);
      if (form.id === id) setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError('削除に失敗しました');
      console.error(err);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const list = await loadSnippets();
      const idx = list.findIndex((s) => s.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], enabled, updatedAt: Date.now() };
        await saveSnippets(list);
        await refresh();
      }
    } catch (err) {
      setError('更新に失敗しました');
      console.error(err);
    }
  };

  const moveSnippet = async (id: string, direction: 'up' | 'down') => {
    const index = snippets.findIndex((s) => s.id === id);
    if (index === -1) return;
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= snippets.length) return;
    try {
      const reordered = [...snippets];
      const [item] = reordered.splice(index, 1);
      reordered.splice(swapWith, 0, item);
      const withOrder = reordered.map((s, idxOrder) => ({ ...s, order: idxOrder }));
      await saveSnippets(withOrder);
      await refresh();
    } catch (err) {
      setError('並び替えに失敗しました');
      console.error(err);
    }
  };

  const handleEdit = (snippet: Snippet) => {
    setForm({
      id: snippet.id,
      name: snippet.name,
      scopePattern: snippet.scopePattern,
      cssText: snippet.cssText,
      enabled: snippet.enabled,
    });
  };

  const resetTab = async () => {
    try {
      const tab = await getActiveTab();
      if (tab?.id) {
        await browserApi.tabs.sendMessage(tab.id, { type: 'CLEAR_SNIPPETS' });
      }
    } catch (err) {
      setError('リセットに失敗しました');
      console.error(err);
    }
  };

  const cancelEdit = () => setForm(emptyForm);

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">Active URL</p>
          <p className="url" title={activeUrl}>
            {activeUrl || 'N/A'}
          </p>
        </div>
        <div className="status">
          <span className="status-dot" />
          <span className="status-text">{matched.length} snippet(s) match</span>
        </div>
      </header>

      <main>
        <section className="card">
          <div className="card-header">
            <h2>{form.id ? 'Edit snippet' : 'New snippet'}</h2>
            {form.id && (
              <button className="ghost" onClick={cancelEdit} type="button">
                Cancel
              </button>
            )}
          </div>
          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Name</span>
              <input
                value={form.name}
                placeholder="e.g. Hide sidebar"
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Scope (URL pattern)</span>
              <input
                value={form.scopePattern}
                placeholder="https://example.com/*"
                onChange={(e) => setForm((prev) => ({ ...prev, scopePattern: e.target.value }))}
                required
              />
            </label>
            <label className="field">
              <span>CSS</span>
              <textarea
                value={form.cssText}
                onChange={(e) => setForm((prev) => ({ ...prev, cssText: e.target.value }))}
                placeholder="body { background: #f5f5f5; }"
                rows={6}
              />
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              />
              <span>Enable immediately</span>
            </label>
            <div className="actions">
              <button type="submit" disabled={saving}>
                {form.id ? 'Update' : 'Save'}
              </button>
              <button type="button" className="ghost" onClick={resetTab}>
                Reset tab
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Saved snippets</h2>
            <span className="muted">{snippets.length} total</span>
          </div>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : snippets.length === 0 ? (
            <p className="muted">No snippets yet. Add one above.</p>
          ) : (
            <ul className="list">
              {snippets.map((snippet, index) => (
                <li key={snippet.id} className="list-item">
                  <div className="list-main">
                    <div className="list-title">
                      <input
                        type="checkbox"
                        checked={snippet.enabled}
                        onChange={(e) => handleToggle(snippet.id, e.target.checked)}
                      />
                      <div>
                        <p className="name">{snippet.name || 'Untitled'}</p>
                        <p className="scope">{snippet.scopePattern}</p>
                      </div>
                    </div>
                    <p className="preview">
                      {snippet.cssText ? snippet.cssText.slice(0, 120) : '(empty)'}
                      {snippet.cssText.length > 120 ? '…' : ''}
                    </p>
                  </div>
                  <div className="list-actions">
                    <button className="ghost" onClick={() => moveSnippet(snippet.id, 'up')} disabled={index === 0}>
                      ↑
                    </button>
                    <button
                      className="ghost"
                      onClick={() => moveSnippet(snippet.id, 'down')}
                      disabled={index === snippets.length - 1}
                    >
                      ↓
                    </button>
                    <button className="ghost" onClick={() => handleEdit(snippet)}>
                      Edit
                    </button>
                    <button className="danger" onClick={() => handleDelete(snippet.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default App;
