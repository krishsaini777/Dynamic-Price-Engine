import { useState, useCallback } from 'react';
import { calculatePrice, applyDecision, rejectDecision, getRecommendations, getDecisionById } from '../api/pricingApi';

// ── sessionStorage helpers ────────────────────────────────────────────────────
// Persist pricing state within the browser tab so navigation doesn't wipe it.

const SESSION_KEY = 'pricing_engine_state';

function saveSession(state) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or private mode — fail silently
  }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch { /* noop */ }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export default function usePricing() {
  // Rehydrate from sessionStorage on first render
  const [result, setResultState] = useState(() => {
    const s = loadSession();
    return s?.result ?? null;
  });

  const [selectedProductId, setSelectedProductIdState] = useState(() => {
    const s = loadSession();
    return s?.selectedProductId ?? null;
  });

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Wrapper so every result write also persists to sessionStorage
  const setResult = useCallback((value) => {
    setResultState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      // Persist alongside the current selectedProductId
      setSelectedProductIdState((pid) => {
        saveSession({ result: next, selectedProductId: pid });
        return pid;
      });
      return next;
    });
  }, []);

  const setSelectedProductId = useCallback((id) => {
    setSelectedProductIdState(id);
    setResultState((r) => {
      saveSession({ result: r, selectedProductId: id });
      return r;
    });
  }, []);

  // ── calculate ───────────────────────────────────────────────────────────────
  const calculate = useCallback(async (productId) => {
    try {
      setLoading(true);
      setError(null);
      setResultState(null);              // clear stale result immediately
      setSelectedProductIdState(productId);
      saveSession({ result: null, selectedProductId: productId });

      const res = await calculatePrice(productId);
      const data = res.data;
      setResultState(data);
      saveSession({ result: data, selectedProductId: productId });
      return data;
    } catch (err) {
      const msg = err?.message || 'Failed to run pricing engine';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── loadDecision (navigate-from-dashboard shortcut) ─────────────────────────
  const loadDecision = useCallback(async (decisionId) => {
    try {
      setLoading(true);
      setError(null);
      setResultState(null);

      const res = await getDecisionById(decisionId);
      const data = res.data;
      setResultState(data);
      if (data?.product?._id) {
        setSelectedProductIdState(data.product._id);
        saveSession({ result: data, selectedProductId: data.product._id });
      } else {
        saveSession({ result: data, selectedProductId: null });
      }
      return data;
    } catch (err) {
      const msg = err?.message || 'Failed to load decision';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── apply ───────────────────────────────────────────────────────────────────
  const apply = useCallback(async (decisionId, mode) => {
    try {
      setError(null);
      const res = await applyDecision(decisionId, mode);
      // Update persisted result status locally ONLY if it matches the applied decision
      setResult((prev) => {
        if (!prev) return prev;
        const currentId = prev.decisionId || prev._id;
        if (currentId === decisionId) {
          return { ...prev, status: 'APPLIED' };
        }
        return prev;
      });
      return res;
    } catch (err) {
      const msg = err?.message || 'Failed to apply recommendation';
      setError(msg);
      throw err;
    }
  }, [setResult]);

  // ── reject ──────────────────────────────────────────────────────────────────
  const reject = useCallback(async (decisionId) => {
    try {
      setError(null);
      const res = await rejectDecision(decisionId);
      // Update persisted result status locally ONLY if it matches the rejected decision
      setResult((prev) => {
        if (!prev) return prev;
        const currentId = prev.decisionId || prev._id;
        if (currentId === decisionId) {
          return { ...prev, status: 'REJECTED' };
        }
        return prev;
      });
      return res;
    } catch (err) {
      const msg = err?.message || 'Failed to reject recommendation';
      setError(msg);
      throw err;
    }
  }, [setResult]);

  // ── fetchHistory ─────────────────────────────────────────────────────────── 
  const fetchHistory = useCallback(async (params = {}) => {
    try {
      const res = await getRecommendations(params);
      setHistory(res.data || []);
    } catch {
      // non-critical — don't block
    }
  }, []);

  // ── clearState (logout / product change) ────────────────────────────────────
  const clearState = useCallback(() => {
    setResultState(null);
    setSelectedProductIdState(null);
    setHistory([]);
    clearSession();
  }, []);

  return {
    result,
    selectedProductId,
    history,
    loading,
    error,
    setError,
    calculate,
    apply,
    reject,
    fetchHistory,
    loadDecision,
    clearState,
    setSelectedProductId,
  };
}
