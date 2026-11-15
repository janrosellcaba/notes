import {
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Code,
  Coffee,
  Dumbbell,
  Flag,
  Folder,
  Globe,
  GraduationCap,
  Heart,
  House,
  Layers,
  Leaf,
  Lightbulb,
  Music,
  Palette,
  PenLine,
  Plane,
  Rocket,
  ShoppingBag,
  Star,
  User,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const CONTEXT_ICONS: Array<{ name: string; icon: LucideIcon }> = [
  { name: "briefcase", icon: Briefcase },
  { name: "building-2", icon: Building2 },
  { name: "house", icon: House },
  { name: "user", icon: User },
  { name: "heart", icon: Heart },
  { name: "star", icon: Star },
  { name: "bookmark", icon: Bookmark },
  { name: "folder", icon: Folder },
  { name: "code", icon: Code },
  { name: "palette", icon: Palette },
  { name: "graduation-cap", icon: GraduationCap },
  { name: "plane", icon: Plane },
  { name: "shopping-bag", icon: ShoppingBag },
  { name: "dumbbell", icon: Dumbbell },
  { name: "music", icon: Music },
  { name: "camera", icon: Camera },
  { name: "coffee", icon: Coffee },
  { name: "globe", icon: Globe },
  { name: "zap", icon: Zap },
  { name: "flag", icon: Flag },
  { name: "calendar", icon: Calendar },
  { name: "pen-line", icon: PenLine },
  { name: "lightbulb", icon: Lightbulb },
  { name: "rocket", icon: Rocket },
  { name: "leaf", icon: Leaf },
  { name: "layers", icon: Layers },
];

const BY_NAME = new Map(CONTEXT_ICONS.map((entry) => [entry.name, entry.icon]));

function isLight(color: string): boolean {
  const hex = color.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return false;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255 > 0.64;
}

export function ContextMark({
  icon,
  color,
  size = 22,
}: {
  icon: string | null;
  color: string;
  size?: number;
}) {
  const Icon = BY_NAME.get(icon ?? "") ?? Layers;
  const light = isLight(color);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[6px]"
      style={{
        width: size,
        height: size,
        background: color,
        color: light ? "#18181b" : "#ffffff",
        boxShadow: light ? "inset 0 0 0 1px rgba(24, 24, 27, 0.18)" : undefined,
      }}
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2.25} />
    </span>
  );
}
