export type LogoStyle = "flat" | "doodle" | "smile" | "threeD";

export const LOGO_KEY = "notes.logo";

export const LOGO_OPTIONS: readonly LogoStyle[] = ["flat", "threeD", "doodle", "smile"];

export const LOGO_SRC: Record<Exclude<LogoStyle, "flat">, { light: string; dark: string }> = {
  doodle: { light: "/brand/logo1.jpg", dark: "/brand/logo1-dark.png" },
  smile: { light: "/brand/logo2.jpg", dark: "/brand/logo2-dark.png" },
  threeD: { light: "/brand/logo3-light.png", dark: "/brand/logo3.png" },
};

export function logoSrc(style: Exclude<LogoStyle, "flat">, theme: "dark" | "light"): string {
  return LOGO_SRC[style][theme];
}

export function readLogoStyle(): LogoStyle {
  try {
    const value = localStorage.getItem(LOGO_KEY);
    if (value === "doodle" || value === "smile" || value === "threeD") return value;
    return "flat";
  } catch {
    return "flat";
  }
}

export function writeLogoStyle(style: LogoStyle): void {
  try {
    localStorage.setItem(LOGO_KEY, style);
  } catch {
    // Private browsing can reject storage.
  }
}
