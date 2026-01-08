export type HistorySnapshot = {
  mainQuestion: string;
  fields: Array<{
    id: number;
    title: string;
    content: string;
    expanded: boolean;
  }>;
};

export type CopyHistoryItem = {
  text: string;
  createdAt: number;
  snapshot?: HistorySnapshot;
};

type HistoryListener = (items: CopyHistoryItem[]) => void;

const STORAGE_KEY = 'copyHistoryCache';
const MAX_HISTORY = 10;
const listeners = new Set<HistoryListener>();

const hasWindow = (): boolean => typeof window !== 'undefined';

const normalizeHistory = (items: unknown): CopyHistoryItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter(
      (item): item is CopyHistoryItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as CopyHistoryItem).text === 'string' &&
        typeof (item as CopyHistoryItem).createdAt === 'number'
    )
    .map((item) => ({
      text: item.text,
      createdAt: item.createdAt,
      snapshot: item.snapshot,
    }));
};

const loadHistory = (): CopyHistoryItem[] => {
  if (!hasWindow()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    return normalizeHistory(JSON.parse(raw)).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
};

const saveHistory = (items: CopyHistoryItem[]): void => {
  if (!hasWindow()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ローカルストレージが使えない場合は無視する
  }
};

const notify = (items: CopyHistoryItem[]): void => {
  listeners.forEach((listener) => listener([...items]));
};

export const copyHistoryCache = {
  getHistory(): CopyHistoryItem[] {
    return loadHistory();
  },

  addHistory(text: string, snapshot?: HistorySnapshot): CopyHistoryItem[] {
    if (!text || text.trim() === '') {
      return loadHistory();
    }

    const existing = loadHistory();
    if (existing.some((item) => item.text === text)) {
      return existing;
    }

    const next = [
      { text, createdAt: Date.now(), snapshot },
      ...existing,
    ].slice(0, MAX_HISTORY);

    saveHistory(next);
    notify(next);
    return next;
  },

  clearHistory(): CopyHistoryItem[] {
    const empty: CopyHistoryItem[] = [];
    saveHistory(empty);
    notify(empty);
    return empty;
  },

  subscribe(listener: HistoryListener): () => void {
    listeners.add(listener);
    listener(loadHistory());
    return () => listeners.delete(listener);
  },
};
