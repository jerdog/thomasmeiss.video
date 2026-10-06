/**
 * Dashboard colour theme. Light by default; the owner can switch to dark and
 * the choice is remembered in this browser only. That one localStorage key is
 * an admin convenience — the public site's no-storage rule is about visitors.
 */

export type Theme = "light" | "dark";

const STORAGE_KEY = "admin-theme";

export function storedTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** `data-theme="light"` swaps the colour tokens in index.css; dark is the base palette. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "light" ? "#f5f4f0" : "#23282e");
}

export function saveTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the switch still applies for this visit.
  }
}
