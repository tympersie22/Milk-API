"use client";

import { useCallback, useEffect, useState } from "react";

export type SearchHistoryItem = {
  id: string;
  title_number: string;
  region: string;
  property_id?: string;
  timestamp: number;
  favorited: boolean;
};

const STORAGE_KEY = "milki_search_history";
const MAX_HISTORY = 50;

function loadHistory(): SearchHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SearchHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: SearchHistoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch { /* storage full */ }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const addSearch = useCallback((titleNumber: string, region: string, propertyId?: string) => {
    setHistory(prev => {
      // Deduplicate by title_number+region
      const filtered = prev.filter(
        h => !(h.title_number === titleNumber && h.region === region)
      );
      const item: SearchHistoryItem = {
        id: `${titleNumber}_${region}_${Date.now()}`,
        title_number: titleNumber,
        region,
        property_id: propertyId,
        timestamp: Date.now(),
        favorited: false,
      };
      const next = [item, ...filtered].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setHistory(prev => {
      const next = prev.map(h =>
        h.id === id ? { ...h, favorited: !h.favorited } : h
      );
      saveHistory(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }, []);

  const favorites = history.filter(h => h.favorited);

  return { history, favorites, addSearch, toggleFavorite, removeItem, clearHistory };
}
