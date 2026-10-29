/** The style props a pressed look can set; anything else in an `active:` class is ignored. */
export interface PressedStyle {
  backgroundColor?: string;
  borderColor?: string;
  opacity?: number;
  transform?: { scale: number }[];
}

const NAMED: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
};

/** "#rrggbb" plus a Tailwind alpha ("10" → 10%) as rgba; other colours pass through unchanged. */
function withAlpha(color: string, alpha?: string) {
  if (!alpha) return color;
  const hex = /^#([0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return color;
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha) / 100})`;
}

/** "accent" or "white/10" as a colour from the theme; undefined when it isn't one. */
function color(value: string, colors: Readonly<Record<string, string>>) {
  const [name, alpha] = value.split("/");
  const base = colors[name] ?? NAMED[name];
  return base ? withAlpha(base, alpha) : undefined;
}

/**
 * The pressed look of a Pressable's `active:` classes (already without the prefix) as an inline style:
 * bg-*, border-*, opacity-* and scale-*. Inline, because swapping NativeWind classes on press makes it
 * re-create the component and crash in development.
 */
export function pressedStyle(
  classes: readonly string[],
  colors: Readonly<Record<string, string>>,
): PressedStyle {
  const style: PressedStyle = {};
  for (const name of classes) {
    let match: RegExpExecArray | null;
    if ((match = /^(bg|border)-(.+)$/.exec(name))) {
      const value = color(match[2], colors);
      if (value) style[match[1] === "bg" ? "backgroundColor" : "borderColor"] = value;
    } else if ((match = /^opacity-(\d+)$/.exec(name))) style.opacity = Number(match[1]) / 100;
    else if ((match = /^scale-(?:\[([\d.]+)\]|(\d+))$/.exec(name)))
      style.transform = [{ scale: match[1] ? Number(match[1]) : Number(match[2]) / 100 }];
  }
  return style;
}
