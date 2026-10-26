import * as Linking from "expo-linking";
import type { ReactNode } from "react";
import { CustomText } from "@/components/shadcn-custom/customtext";

// The web app's tokens (lib/inbox/format.tsx): ```mono```, *bold*, _italic_, ~strike~ and links.
const TOKEN = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s<]+)/g;

function render(text: string, key: string, links: boolean): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const id = `${key}-${index++}`;
    if (token.startsWith("```")) nodes.push(<CustomText key={id} className="font-mono text-[13px]">{token.slice(3, -3)}</CustomText>);
    else if (token.startsWith("http")) nodes.push(links
      ? <CustomText key={id} role="link" className="text-info-fg underline" onPress={() => void Linking.openURL(token).catch(() => undefined)}>{token}</CustomText>
      : token);
    else {
      const inner = render(token.slice(1, -1), id, links);
      const style = token[0] === "*" ? "font-sans-semibold" : token[0] === "_" ? "italic" : "line-through";
      nodes.push(<CustomText key={id} className={style}>{inner}</CustomText>);
    }
    last = start + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Message text with WhatsApp formatting, as children of a Text. `links: false` for previews inside a pressable row. */
export function renderWhatsAppText(text: string, { links = true }: { links?: boolean } = {}) {
  return render(text, "t", links);
}

/** The text without its markers, for one-line previews and accessibility labels. */
export function plainWhatsAppText(text: string): string {
  return text.replace(TOKEN, (token): string => token.startsWith("```") ? token.slice(3, -3)
    : token.startsWith("http") ? token : plainWhatsAppText(token.slice(1, -1)));
}
