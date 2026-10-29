// WhatsApp formatting for the broadcast message's toolbar, as text edits (the web's lib/messages/format):
// *bold* _italic_ ~strike~ ```code``` wrap the selection; "- ", "1. " and "> "
// start the selected lines (bulleted list, numbered list, quote).

export type FormatAction = "bold" | "italic" | "strike" | "bullet" | "numbered" | "quote" | "code";

/** Replace `remove` characters at `at` with `insert`. */
export interface TextEdit {
  at: number;
  remove: number;
  insert: string;
}

/** Edits from last to first (apply them in order), and the selection afterwards. */
export interface FormatResult {
  edits: TextEdit[];
  selection: [number, number];
}

const WRAP: Partial<Record<FormatAction, string>> = {
  bold: "*",
  italic: "_",
  strike: "~",
  code: "```",
};

const LINE_PREFIX: Record<"bullet" | "numbered" | "quote", RegExp> = {
  bullet: /^[-•*] /,
  numbered: /^\d+\. /,
  quote: /^> /,
};

/** The edits that apply (or remove) `action` on `text` between `start` and `end`. */
export function formatText(
  text: string,
  start: number,
  end: number,
  action: FormatAction,
): FormatResult {
  const marker = WRAP[action];
  if (marker) return wrap(text, start, end, marker);
  return prefixLines(text, start, end, action as keyof typeof LINE_PREFIX);
}

/** `text` with the edits applied. */
export function applyEdits(text: string, edits: TextEdit[]): string {
  return edits.reduce(
    (value, { at, remove, insert }) => value.slice(0, at) + insert + value.slice(at + remove),
    text,
  );
}

/** `{{key}}` in place of the selection, spaced from the word before it, and where the caret goes after it. */
export function insertVariable(
  text: string,
  start: number,
  end: number,
  key: string,
): { text: string; caret: number } {
  const gap = start > 0 && !/\s/.test(text[start - 1]) ? " " : "";
  const token = `${gap}{{${key}}}`;
  return { text: text.slice(0, start) + token + text.slice(end), caret: start + token.length };
}

function wrap(text: string, start: number, end: number, marker: string): FormatResult {
  // WhatsApp only styles markers that hug the text.
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  const m = marker.length;
  const remove = (at: number): TextEdit => ({ at, remove: m, insert: "" });

  // Already styled: markers just outside, or at the ends of, the selection.
  if (
    start >= m &&
    text.slice(start - m, start) === marker &&
    text.slice(end, end + m) === marker
  ) {
    return { edits: [remove(end), remove(start - m)], selection: [start - m, end - m] };
  }
  if (
    end - start >= 2 * m + 1 &&
    text.slice(start, start + m) === marker &&
    text.slice(end - m, end) === marker
  ) {
    return { edits: [remove(end - m), remove(start)], selection: [start, end - 2 * m] };
  }
  return {
    edits: [
      { at: end, remove: 0, insert: marker },
      { at: start, remove: 0, insert: marker },
    ],
    selection: [start + m, end + m],
  };
}

function prefixLines(
  text: string,
  start: number,
  end: number,
  action: keyof typeof LINE_PREFIX,
): FormatResult {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  // A selection that ends at the start of a line doesn't take that line.
  const stop = end > start && text[end - 1] === "\n" ? end - 1 : end;
  const next = text.indexOf("\n", stop);
  const to = next === -1 ? text.length : next;
  const lines = text.slice(from, to).split("\n");
  const pattern = LINE_PREFIX[action];
  // Empty lines inside a multi-line selection stay empty.
  const counts = (line: string) => lines.length === 1 || line.trim() !== "";
  const removing = lines.filter(counts).every((line) => pattern.test(line));
  // A list replaces the other kind of list.
  const other =
    action === "bullet" ? LINE_PREFIX.numbered : action === "numbered" ? LINE_PREFIX.bullet : null;

  const edits: TextEdit[] = [];
  let at = from;
  let number = 1;
  for (const line of lines) {
    if (counts(line)) {
      if (removing) {
        edits.push({ at, remove: pattern.exec(line)![0].length, insert: "" });
      } else {
        const prefix = action === "bullet" ? "- " : action === "numbered" ? `${number++}. ` : "> ";
        const existing = pattern.exec(line) ?? other?.exec(line);
        edits.push({ at, remove: existing?.[0].length ?? 0, insert: prefix });
      }
    }
    at += line.length + 1;
  }
  edits.reverse();
  return { edits, selection: [mapPosition(start, edits), mapPosition(end, edits)] };
}

/** Where `position` ends up once the edits are made. */
function mapPosition(position: number, edits: TextEdit[]): number {
  let shift = 0;
  for (const { at, remove, insert } of edits) {
    if (at + remove <= position) shift += insert.length - remove;
    else if (at < position) shift += at + insert.length - position;
  }
  return position + shift;
}
