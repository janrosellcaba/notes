export type LogoStyle = "flat" | "doodle" | "smile" | "threeD";

export const LOGO_KEY = "notes.logo";

export const LOGO_OPTIONS: readonly LogoStyle[] = ["flat", "doodle", "smile", "threeD"];

export const LOGO_SRC: Record<Exclude<LogoStyle, "flat">, string> = {
  doodle: "/brand/logo1.jpg",
  smile: "/brand/logo2.jpg",
  threeD: "/brand/logo3.jpg",
};

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
