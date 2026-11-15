export type Theme = "dark" | "light";

export const THEME_KEY = "notes.theme";

export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const icon = document.querySelector('link[rel="icon"]');
  if (icon instanceof HTMLLinkElement) {
    icon.href = theme === "light" ? "/favicon-light.svg" : "/favicon.svg";
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#fafafa" : "#09090b");
}
