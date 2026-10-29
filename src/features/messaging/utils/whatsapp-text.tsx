import * as Linking from "expo-linking";
import type { ReactNode } from "react";
import { CustomText } from "@/components/shadcn-custom/customtext";
import type { MentionedParticipant } from "../types";
import { mentionRuns, resolveMentionText } from "./mentions";

// The web app's tokens (lib/inbox/format.tsx): ```mono```, *bold*, _italic_, ~strike~ and links.
const TOKEN = /(```[\s\S]+?```|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|https?:\/\/[^\s<]+)/g;

function render(
  text: string,
  key: string,
  links: boolean,
  participants: MentionedParticipant[],
): ReactNode[] {
  const nodes: ReactNode[] = [];
  function pushText(value: string, prefix: string) {
    mentionRuns(value, participants).forEach((run, i) =>
      nodes.push(
        run.mention ? (
          <CustomText key={`${prefix}-mention-${i}`} className="font-sans-semibold text-primary">
            {run.text}
          </CustomText>
        ) : (
          run.text
        ),
      ),
    );
  }
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) pushText(text.slice(last, start), `${key}-${index}`);
    const id = `${key}-${index++}`;
    if (token.startsWith("```"))
      nodes.push(
        <CustomText key={id} className="font-mono text-[13px]">
          {token.slice(3, -3)}
        </CustomText>,
      );
    else if (token.startsWith("http"))
      nodes.push(
        links ? (
          <CustomText
            key={id}
            role="link"
            className="text-info-fg underline"
            onPress={() => void Linking.openURL(token).catch(() => undefined)}
          >
            {token}
          </CustomText>
        ) : (
          token
        ),
      );
    else {
      const inner = render(token.slice(1, -1), id, links, participants);
      const style =
        token[0] === "*" ? "font-sans-semibold" : token[0] === "_" ? "italic" : "line-through";
      nodes.push(
        <CustomText key={id} className={style}>
          {inner}
        </CustomText>,
      );
    }
    last = start + token.length;
  }
  if (last < text.length) pushText(text.slice(last), `${key}-${index}`);
  return nodes;
}

/** Message text with WhatsApp formatting, as children of a Text. `links: false` for previews inside a pressable row. */
export function renderWhatsAppText(
  text: string,
  {
    links = true,
    participants = [],
  }: { links?: boolean; participants?: MentionedParticipant[] } = {},
) {
  return render(text, "t", links, participants);
}

/** The text without its markers, for one-line previews and accessibility labels. */
export function plainWhatsAppText(text: string, participants: MentionedParticipant[] = []): string {
  let output = "";
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    output += resolveMentionText(text.slice(last, match.index), participants);
    const token = match[0];
    output += token.startsWith("```")
      ? token.slice(3, -3)
      : token.startsWith("http")
        ? token
        : plainWhatsAppText(token.slice(1, -1), participants);
    last = match.index + token.length;
  }
  return output + resolveMentionText(text.slice(last), participants);
}
