import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(
  new URL("../src/features/navigation/components/keyboard-screen.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

// Run the actual wrapper's focus callbacks and animated style against native
// event doubles. The native observer deliberately retains a stale OPEN height
// after navigation, as it can when it misses the end of an Android IME animation.
function screenFixture(
  platform = "android",
  nativeWindow = { top: 0, bottom: 0, decorFits: false },
) {
  const states = { UNKNOWN: 0, OPENING: 1, OPEN: 2, CLOSING: 3, CLOSED: 4 };
  const keyboard = { height: { value: 0 }, state: { value: states.CLOSED } };
  const listeners = new Map();
  const slots = [];
  let cursor = 0;
  let effect;
  let cleanup;
  let tree;
  let dismissals = 0;
  let nativeOptions;
  const slot = (init) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = init();
    return index;
  };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        const index = slot(() => initial);
        return [
          slots[index],
          (value) => {
            slots[index] = typeof value === "function" ? value(slots[index]) : value;
          },
        ];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "expo-router": {
      useFocusEffect: (fn) => {
        effect = fn;
      },
    },
    "react-native": {
      View: "View",
      Platform: { OS: platform },
      Keyboard: {
        dismiss: () => {
          dismissals++;
        },
        addListener: (event, fn) => {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event).add(fn);
          return { remove: () => listeners.get(event).delete(fn) };
        },
      },
    },
    "react-native-reanimated": {
      __esModule: true,
      default: { View: "Animated.View" },
      KeyboardState: states,
      useAnimatedKeyboard: (options = {}) => {
        nativeOptions = options;
        if (platform === "android") nativeWindow.decorFits = false;
        return keyboard;
      },
      useSharedValue: (value) =>
        slots[
          slot(() => ({
            value,
            set(next) {
              this.value = next;
            },
          }))
        ],
      useAnimatedStyle: (read) => ({ read }),
    },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 24 }) },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      assert.ok(name in modules, `Unexpected native dependency: ${name}`);
      return modules[name];
    },
  });
  const render = () => {
    cursor = 0;
    tree = exports.KeyboardScreen({ children: "chat" });
  };
  render();
  return {
    animate(state, height) {
      keyboard.state.value = states[state];
      keyboard.height.value = height;
    },
    emit(event) {
      listeners.get(event)?.forEach((fn) => fn());
    },
    focus() {
      cleanup = effect();
    },
    blur() {
      cleanup();
      cleanup = undefined;
    },
    layout(height) {
      tree.props.onLayout({ nativeEvent: { layout: { height } } });
      render();
    },
    padding() {
      return tree.props.children.props.style[1].read().paddingBottom;
    },
    listeners() {
      return [...listeners.values()].reduce((total, set) => total + set.size, 0);
    },
    dismissals() {
      return dismissals;
    },
    // Model the installed Reanimated WindowsInsetsManager's root-margin policy.
    // AppShell adds safe-area padding inside this root, so any additional margin
    // shifts every screen, including the inbox revealed during a back gesture.
    applyNativeInsets(top, bottom) {
      nativeWindow.top = nativeOptions.isStatusBarTranslucentAndroid ? 0 : top;
      nativeWindow.bottom = nativeOptions.isNavigationBarTranslucentAndroid ? 0 : bottom;
    },
    unmount() {
      cleanup?.();
      nativeWindow.top = 0;
      nativeWindow.bottom = 0;
      nativeWindow.decorFits =
        !nativeOptions.isStatusBarTranslucentAndroid &&
        !nativeOptions.isNavigationBarTranslucentAndroid;
    },
  };
}

test("opening a chat and returning keeps the inbox header and window bounds stationary", () => {
  for (const insets of [
    { top: 24, bottom: 24 },
    { top: 48, bottom: 0 },
  ]) {
    const nativeWindow = { top: 0, bottom: 0, decorFits: false };
    const headerY = () => nativeWindow.top + insets.top + 12;
    const initialHeader = headerY();
    for (let visit = 0; visit < 3; visit++) {
      const screen = screenFixture("android", nativeWindow);
      screen.focus();
      screen.applyNativeInsets(insets.top, insets.bottom);
      assert.equal(
        headerY(),
        initialHeader,
        "the chat observer must not add another status-bar inset",
      );
      assert.equal(nativeWindow.bottom, 0, "AppShell already reserves the bottom safe area");
      screen.blur();
      assert.equal(
        headerY(),
        initialHeader,
        "the revealed inbox stays in place during back navigation",
      );
      screen.unmount();
      assert.equal(headerY(), initialHeader, "unmount must not move the whole app root");
      assert.equal(
        nativeWindow.decorFits,
        false,
        "back navigation must retain the same edge-to-edge window policy",
      );
    }
  }
});

test("leaving with the keyboard open and reopening the same chat clears its old keyboard space", () => {
  const screen = screenFixture();
  screen.focus();
  screen.layout(800);
  screen.animate("OPEN", 320);
  screen.emit("keyboardDidShow");
  assert.equal(screen.padding(), 296);

  screen.blur();
  assert.equal(screen.padding(), 0, "the outgoing screen releases its padding immediately");
  assert.equal(screen.listeners(), 0, "blur removes the old screen's keyboard handlers");
  screen.emit("keyboardDidHide");

  // Reanimated still says OPEN / 320; neither revisit nor a remount may trust it.
  screen.focus();
  assert.equal(screen.padding(), 0);
  const reopened = screenFixture();
  reopened.animate("OPEN", 320);
  reopened.focus();
  assert.equal(reopened.padding(), 0);
  assert.equal(screen.dismissals(), 3, "entry, exit and return dismiss the old input");
});

test("opening still follows native animation and a native hide clears even a stale OPEN height", () => {
  const screen = screenFixture();
  screen.focus();
  screen.layout(800);
  screen.animate("OPENING", 160);
  assert.equal(screen.padding(), 136, "the composer rises before Android's didShow event");
  screen.animate("OPEN", 320);
  screen.emit("keyboardDidShow");
  assert.equal(screen.padding(), 296);
  screen.animate("CLOSING", 160);
  assert.equal(screen.padding(), 136);
  screen.animate("OPEN", 320);
  screen.emit("keyboardDidHide");
  assert.equal(screen.padding(), 0, "the hide event overrides the retained native height");
});

test("an unfocused chat ignores another screen's keyboard and can open it again on return", () => {
  const screen = screenFixture();
  screen.focus();
  screen.blur();
  screen.animate("OPENING", 180);
  screen.emit("keyboardDidShow");
  assert.equal(screen.padding(), 0);
  screen.animate("CLOSED", 0);
  screen.focus();
  screen.animate("OPEN", 360);
  screen.emit("keyboardDidShow");
  assert.equal(screen.padding(), 336);
});

test("a resized Android window does not count keyboard spacing twice", () => {
  const screen = screenFixture();
  screen.focus();
  screen.layout(800);
  screen.animate("OPEN", 320);
  screen.emit("keyboardDidShow");
  screen.layout(480);
  assert.equal(screen.padding(), 0);
  screen.layout(640);
  assert.equal(screen.padding(), 136, "only the remaining overlap is padded");
});

test("iOS willShow supports the first animation and closing follows the shrinking native height", () => {
  const screen = screenFixture("ios");
  screen.focus();
  screen.animate("OPEN", 300);
  screen.emit("keyboardWillShow");
  assert.equal(screen.padding(), 276);
  screen.animate("CLOSING", 120);
  assert.equal(screen.padding(), 96);
  screen.emit("keyboardDidHide");
  assert.equal(screen.padding(), 0);
  screen.blur();
  assert.equal(screen.listeners(), 0);
});
