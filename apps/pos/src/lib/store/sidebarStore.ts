import { create } from "zustand";

const STORAGE_KEY = "rakku-pos-sidebar-collapsed";

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persist(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

function applyDomState(value: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(
    "data-pos-sidebar",
    value ? "collapsed" : "expanded"
  );
}

interface SidebarState {
  isCollapsed: boolean;
  hydrated: boolean;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  hydrate: () => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false,
  hydrated: false,
  setCollapsed: (collapsed) => {
    persist(collapsed);
    applyDomState(collapsed);
    set({ isCollapsed: collapsed });
  },
  toggleCollapsed: () =>
    set((state) => {
      const next = !state.isCollapsed;
      persist(next);
      applyDomState(next);
      return { isCollapsed: next };
    }),
  hydrate: () =>
    set((state) => {
      if (state.hydrated) return state;
      const stored = readStored();
      applyDomState(stored);
      return { isCollapsed: stored, hydrated: true };
    }),
}));