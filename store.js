// Shared expense store.
//
// When window.TRACKER_API_URL is set (pointing at the deployed Apps Script),
// all mutations sync to Google Sheets and state is polled every 30 s so all
// three users stay in sync. localStorage is used as a fast offline cache so
// the app loads instantly and works without a connection.
//
// When TRACKER_API_URL is empty the app runs in localStorage-only mode —
// useful for development before the sheet is wired up.

(function () {
  // ── Config ─────────────────────────────────────────────────────────────────
  const API_URL  = (typeof window !== 'undefined' && window.TRACKER_API_URL) || '';
  const POLL_MS  = 30_000;   // refresh from Sheets every 30 s
  const LS_KEY   = 'swiss-tracker-cache.v2';

  // ── Static data — used as fallback until the sheet is fetched ─────────────
  const PEOPLE = ['Asha', 'Ajit', 'Nishant'];

  // `let` so _syncFromSheets() can overwrite with live sheet values
  let FIXED_COSTS = [
    { category: 'Flight Tickets',     budget: 297325, actual: 297325, note: 'Actuals paid via Cleartrip' },
    { category: 'Transit Hotel Stay', budget: 12181,  actual: 12181,  note: 'Pride Plaza Delhi' },
    { category: 'Airbnb Stay',        budget: 127508, actual: 127508, note: 'Actuals paid' },
    { category: 'Visa',               budget: 46470,  actual: 46470,  note: 'Booking + counter + Syed + photo + day' },
    { category: 'Travel Card',        budget: 165188, actual: 165188, note: '2 adults 998 CHF, 356 child' },
    { category: 'Telephone',          budget: 10000,  actual: 0,      note: 'Approx for 3 people' },
    { category: 'Insurance',          budget: 2763,   actual: 2763,   note: 'Approx for 3 people' },
  ];

  let VARIABLE_BUDGETS = [
    { category: 'Food',                 budget: 219600, note: '20 CHF × 3 × 3 × 10 days' },
    { category: 'Pre Travel Purchases', budget: 30000,  note: 'Clothes, stuff for Hitesh, etc.' },
    { category: 'Swiss Travel Extras',  budget: 20000,  note: 'Trains/cabs beyond Travel Card' },
    { category: 'Gifts',                budget: 10000,  note: 'Chocolates, clothes' },
    { category: 'Transit Expense',      budget: 6000,   note: 'Airport taxi, food, etc.' },
  ];

  const DEFAULTS = {
    settings: { chfRate: 123, warningThreshold: 80 },
    entries: [],
  };

  // ── Internal state ─────────────────────────────────────────────────────────
  let _state      = _loadCache();
  let _syncStatus = API_URL ? 'connecting' : 'local';

  function _loadCache() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        // Restore budget structure so the UI shows correct numbers immediately on load
        if (cached.fixedCosts?.length)      FIXED_COSTS      = cached.fixedCosts;
        if (cached.variableBudgets?.length) VARIABLE_BUDGETS = cached.variableBudgets;
        return {
          settings:        cached.settings        || DEFAULTS.settings,
          entries:         cached.entries         || [],
          fixedCosts:      cached.fixedCosts?.length      ? cached.fixedCosts      : FIXED_COSTS,
          variableBudgets: cached.variableBudgets?.length ? cached.variableBudgets : VARIABLE_BUDGETS,
        };
      }
    } catch (e) { /* ignore */ }
    return { ...structuredClone(DEFAULTS), fixedCosts: FIXED_COSTS, variableBudgets: VARIABLE_BUDGETS };
  }

  function _saveCache(s) {
    // s already contains fixedCosts and variableBudgets — save it wholesale
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  function _emit(s) {
    _state = s;
    _saveCache(s);
    window.dispatchEvent(new CustomEvent('store:change', { detail: s }));
  }

  function _emitSync(status) {
    _syncStatus = status;
    window.dispatchEvent(new CustomEvent('store:sync', { detail: status }));
  }

  // ── API helpers ────────────────────────────────────────────────────────────

  async function _apiFetch() {
    // Cache-bust so Google's CDN doesn't serve stale data
    const url = API_URL + (API_URL.includes('?') ? '&' : '?') + '_t=' + Date.now();
    const res  = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  async function _apiPost(body) {
    // Apps Script requires text/plain (not application/json) to populate e.postData.contents
    const res = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  async function _syncFromSheets() {
    if (!API_URL) return;
    _emitSync('syncing');
    try {
      const remote = await _apiFetch();

      // Update budget structure from sheet — also push to the exported object so
      // components that destructure window.ExpenseStore pick up the new arrays
      if (remote.fixedCosts?.length) {
        FIXED_COSTS = remote.fixedCosts;
        window.ExpenseStore.FIXED_COSTS = FIXED_COSTS;
      }
      if (remote.variableBudgets?.length) {
        VARIABLE_BUDGETS = remote.variableBudgets;
        window.ExpenseStore.VARIABLE_BUDGETS = VARIABLE_BUDGETS;
      }

      _emit({
        settings:        { ...DEFAULTS.settings, ...remote.settings },
        entries:         remote.entries || [],
        fixedCosts:      FIXED_COSTS,
        variableBudgets: VARIABLE_BUDGETS,
      });
      _emitSync('ok');
    } catch (e) {
      console.warn('[store] sync failed:', e.message);
      _emitSync('error');
    }
  }

  // Initial load + polling + refetch on tab focus
  if (API_URL) {
    _syncFromSheets();
    setInterval(_syncFromSheets, POLL_MS);
    window.addEventListener('focus', _syncFromSheets);
  }

  // ── Public CRUD ────────────────────────────────────────────────────────────
  //
  // Each mutator does an optimistic local update first (instant UI feedback),
  // then fires the API call in the background. On success it re-fetches to
  // pick up the server's canonical state (including any recalculations).

  function load() { return _state; }

  function reset() {
    _emit(structuredClone(DEFAULTS));
    // No API call — reset is intentionally local-only (used for dev)
  }

  function addEntry(entry) {
    // Optimistic
    const id       = 'e' + Date.now() + Math.random().toString(36).slice(2, 6);
    const amount   = Number(entry.amount) || 0;
    const amountINR = entry.currency === 'CHF'
      ? Math.round(amount * _state.settings.chfRate)
      : Math.round(amount);
    const newEntry = {
      id, amount, currency: entry.currency, amountINR,
      category: entry.category, person: entry.person,
      note: entry.note || '', ts: Date.now(),
    };
    _emit({ ..._state, entries: [newEntry, ..._state.entries] });

    // Background sync
    if (API_URL) {
      _apiPost({ action: 'addEntry', entry })
        .then(_syncFromSheets)
        .catch(e => { console.warn('[store] addEntry failed:', e.message); _emitSync('error'); });
    }
    return id;
  }

  function updateEntry(id, patch) {
    // Optimistic
    const entries = _state.entries.map(e => {
      if (e.id !== id) return e;
      const merged    = { ...e, ...patch };
      const amount    = Number(merged.amount) || 0;
      merged.amount   = amount;
      merged.amountINR = merged.currency === 'CHF'
        ? Math.round(amount * _state.settings.chfRate)
        : Math.round(amount);
      return merged;
    });
    _emit({ ..._state, entries });

    if (API_URL) {
      _apiPost({ action: 'updateEntry', id, patch })
        .then(_syncFromSheets)
        .catch(e => { console.warn('[store] updateEntry failed:', e.message); _emitSync('error'); });
    }
  }

  function deleteEntry(id) {
    // Optimistic
    _emit({ ..._state, entries: _state.entries.filter(e => e.id !== id) });

    if (API_URL) {
      _apiPost({ action: 'deleteEntry', id })
        .then(_syncFromSheets)
        .catch(e => { console.warn('[store] deleteEntry failed:', e.message); _emitSync('error'); });
    }
  }

  function setSettings(patch) {
    const settings = { ..._state.settings, ...patch };
    // Re-convert CHF entries with the new rate
    const entries = _state.entries.map(e => ({
      ...e,
      amountINR: e.currency === 'CHF'
        ? Math.round(e.amount * settings.chfRate)
        : Math.round(e.amount),
    }));
    _emit({ ..._state, settings, entries });

    if (API_URL) {
      _apiPost({ action: 'setSettings', patch })
        .then(_syncFromSheets)
        .catch(e => { console.warn('[store] setSettings failed:', e.message); _emitSync('error'); });
    }
  }

  // ── React hooks ────────────────────────────────────────────────────────────

  function useStore() {
    const [state, setState] = React.useState(_state);
    React.useEffect(() => {
      const onStoreChange = () => setState(load());
      const onStorage     = (e) => { if (e.key === LS_KEY) setState(load()); };
      window.addEventListener('store:change', onStoreChange);
      window.addEventListener('storage',      onStorage);
      return () => {
        window.removeEventListener('store:change', onStoreChange);
        window.removeEventListener('storage',      onStorage);
      };
    }, []);
    return state;
  }

  // 'local' | 'connecting' | 'syncing' | 'ok' | 'error'
  function useSyncStatus() {
    const [status, setStatus] = React.useState(_syncStatus);
    React.useEffect(() => {
      const handler = (e) => setStatus(e.detail);
      window.addEventListener('store:sync', handler);
      return () => window.removeEventListener('store:sync', handler);
    }, []);
    return status;
  }

  // ── Derived summary ────────────────────────────────────────────────────────

  function summarize(state) {
    const fixedCosts      = state.fixedCosts      || FIXED_COSTS;
    const variableBudgets = state.variableBudgets || VARIABLE_BUDGETS;

    const byCategory = {};
    variableBudgets.forEach(c => { byCategory[c.category] = 0; });
    state.entries.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amountINR;
    });

    const fixedBudget    = fixedCosts.reduce((s, c) => s + c.budget, 0);
    const fixedActual    = fixedCosts.reduce((s, c) => s + c.actual, 0);
    const variableBudget = variableBudgets.reduce((s, c) => s + c.budget, 0);
    const variableActual = Object.values(byCategory).reduce((a, b) => a + b, 0);
    const totalBudget    = fixedBudget + variableBudget;
    const totalActual    = fixedActual + variableActual;
    const pct            = totalActual / totalBudget;
    const threshold      = state.settings.warningThreshold / 100;

    let status = 'ok';
    if (pct >= 1)         status = 'over';
    else if (pct >= threshold) status = 'warn';

    return {
      byCategory, fixedBudget, fixedActual,
      variableBudget, variableActual,
      totalBudget, totalActual, pct, status,
    };
  }

  window.ExpenseStore = {
    PEOPLE, FIXED_COSTS, VARIABLE_BUDGETS,
    load, reset,
    addEntry, updateEntry, deleteEntry, setSettings,
    useStore, useSyncStatus, summarize,
  };
})();
