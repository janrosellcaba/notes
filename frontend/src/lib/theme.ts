import { logoSrc, readLogoStyle, type LogoStyle } from "./logo";

export type Theme = "dark" | "light";

export const THEME_KEY = "notes.theme";

export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function faviconFor(theme: Theme, logo: LogoStyle): { href: string; type: string } {
  if (logo === "flat") {
    return {
      href: theme === "light" ? "/favicon-light.svg" : "/favicon.svg",
      type: "image/svg+xml",
    };
  }
  const href = logoSrc(logo, theme);
  const type = href.endsWith(".svg")
    ? "image/svg+xml"
    : href.endsWith(".png")
      ? "image/png"
      : "image/jpeg";
  return { href, type };
}

export function applyFavicon(theme: Theme = readTheme(), logo: LogoStyle = readLogoStyle()): void {
  const icon = document.querySelector('link[rel="icon"]');
  if (!(icon instanceof HTMLLinkElement)) return;
  const next = faviconFor(theme, logo);
  // Force a reload when switching between same-type assets (e.g. jpg → jpg).
  icon.href = `${next.href}${next.href.includes("?") ? "&" : "?"}v=${encodeURIComponent(`${logo}-7`)}`;
  icon.type = next.type;
}

export function applyTheme(theme: Theme, logo: LogoStyle = readLogoStyle()): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  applyFavicon(theme, logo);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#fafafa" : "#09090b");
}
