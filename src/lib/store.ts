import { useSyncExternalStore } from 'react';

export interface Settings {
  speed: number;
  inspectorMode: 'simple' | 'technical' | 'hex';
  reducedMotion: boolean;
  showBinary: boolean;
  name: string;
}
export interface ExamResult { id: string; title: string; score: number; total: number; date: number; byTopic: Record<string, [number, number]> }
export interface State {
  visited: Record<string, number>; // key -> last visit time  (e.g. "protocol:tcp", "sim:dhcp")
  completed: Record<string, number>; // lessons/sims completed
  bookmarks: string[]; // keys
  exams: ExamResult[];
  settings: Settings;
}

const KEY = 'netlab:v1';
const DEFAULT: State = {
  visited: {}, completed: {}, bookmarks: [], exams: [],
  settings: { speed: 1, inspectorMode: 'technical', reducedMotion: false, showBinary: false, name: '' },
};

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const s = JSON.parse(raw);
    return { ...DEFAULT, ...s, settings: { ...DEFAULT.settings, ...(s.settings ?? {}) } };
  } catch {
    return DEFAULT;
  }
}

let state: State = load();
const subs = new Set<() => void>();
function set(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage may be unavailable */ }
  subs.forEach((f) => f());
}

export const store = {
  get: () => state,
  subscribe: (f: () => void) => { subs.add(f); return () => subs.delete(f); },
  visit(key: string) { set({ ...state, visited: { ...state.visited, [key]: Date.now() } }); },
  complete(key: string) { if (!state.completed[key]) set({ ...state, completed: { ...state.completed, [key]: Date.now() } }); },
  uncomplete(key: string) { const c = { ...state.completed }; delete c[key]; set({ ...state, completed: c }); },
  toggleBookmark(key: string) {
    const b = state.bookmarks.includes(key) ? state.bookmarks.filter((k) => k !== key) : [key, ...state.bookmarks];
    set({ ...state, bookmarks: b });
  },
  addExam(r: ExamResult) { set({ ...state, exams: [...state.exams, r].slice(-100) }); },
  settings(p: Partial<Settings>) { set({ ...state, settings: { ...state.settings, ...p } }); },
  reset() { set(DEFAULT); },
  export: () => JSON.stringify(state, null, 2),
  import(json: string) { const s = JSON.parse(json); set({ ...DEFAULT, ...s, settings: { ...DEFAULT.settings, ...(s.settings ?? {}) } }); },
};

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(store.subscribe, () => sel(store.get()));
}
