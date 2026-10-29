import assert from "node:assert/strict";
import "./register-typescript.mjs";
import { test } from "node:test";
import {
  applyEdits,
  formatText,
  insertVariable,
} from "../src/features/broadcasts/utils/message-format.ts";

const run = (text, start, end, action) => {
  const result = formatText(text, start, end, action);
  return { text: applyEdits(text, result.edits), selection: result.selection };
};

test("bold wraps the selection, keeps it selected, and a second press unwraps it", () => {
  const on = run("Hello world", 6, 11, "bold");
  assert.deepEqual(on, { text: "Hello *world*", selection: [7, 12] });
  assert.deepEqual(run(on.text, ...on.selection, "bold"), {
    text: "Hello world",
    selection: [6, 11],
  });
});

test("markers hug the words: spaces at the ends of the selection stay outside", () => {
  assert.equal(run("say hi there", 3, 7, "italic").text, "say _hi_ there");
});

test("with nothing selected, a style leaves the caret between its markers", () => {
  assert.deepEqual(run("Hi ", 3, 3, "strike"), { text: "Hi ~~", selection: [4, 4] });
});

test("code wraps in triple backticks", () => {
  assert.equal(run("run npm", 4, 7, "code").text, "run ```npm```");
});

test("a bulleted list starts each selected line, skipping blank ones, and toggles off", () => {
  const on = run("one\n\ntwo", 0, 8, "bullet");
  assert.equal(on.text, "- one\n\n- two");
  assert.equal(run(on.text, 0, on.text.length, "bullet").text, "one\n\ntwo");
});

test("a numbered list replaces bullets, counting from 1", () => {
  assert.equal(run("- a\n- b", 0, 7, "numbered").text, "1. a\n2. b");
});

test("quote starts the caret's line", () => {
  assert.equal(run("first\nsecond", 8, 8, "quote").text, "first\n> second");
});

test("a variable goes in at the caret, spaced from the word before it", () => {
  assert.deepEqual(insertVariable("Hi there", 2, 2, "name"), {
    text: "Hi {{name}} there",
    caret: 11,
  });
  assert.deepEqual(insertVariable("Hi ", 3, 3, "name"), { text: "Hi {{name}}", caret: 11 });
  assert.deepEqual(insertVariable("", 0, 0, "date"), { text: "{{date}}", caret: 8 });
});
