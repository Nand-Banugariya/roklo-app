/* Local browser review with intercepted fixtures. Never signs into or writes to the real API. */
const { spawn } = require("node:child_process");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const origin = "http://localhost:8090";
const groupMentionsOnly = process.argv.includes("--group-mentions");
const notificationsOnly = process.argv.includes("--notifications");
const groupMentionText = "Hi @23984327598432, please check with @919999999999.";
const mentionPeople = [
  { number: "23984327598432", name: "Priya Shah", mobileNumber: "919876543210" },
  { number: "919999999999", name: "Kabir Khan", mobileNumber: "919999999999" },
];
const output = path.resolve(".expo/mobile-review");
mkdirSync(output, { recursive: true });
const environment = readFileSync(".env", "utf8");
const configured = environment
  .match(/^EXPO_PUBLIC_API_BASE_URL\s*=\s*(.+)$/m)?.[1]
  .trim()
  .replace(/^["']|["']$/g, "");
if (!configured) throw new Error("A public API URL is required for interception.");
const apiOrigin = new URL(configured).origin;
const browser = spawn(
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-port=9243",
    `--user-data-dir=${path.join(output, "chrome-profile")}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const numbers = [
  {
    id: "sales",
    userId: "ui-user",
    sessionName: "sales",
    displayName: "Sales",
    phoneNumber: "919876543210",
    status: "WORKING",
    isWhatsAppConnected: true,
    isActive: true,
  },
  {
    id: "support",
    userId: "ui-user",
    sessionName: "support",
    displayName: "Support",
    phoneNumber: "919876543211",
    status: "WORKING",
    isWhatsAppConnected: true,
    isActive: true,
  },
];
const conversation = (sessionId) => ({
  id: `chat-${sessionId}`,
  sessionId,
  name: sessionId === "sales" ? "Ananya Shah" : "Rahul Mehta",
  mobileNumber: "919999999999",
  isGroup: groupMentionsOnly,
  isPinned: false,
  isMuted: false,
  unreadCount: 2,
  lastMessageAt: new Date().toISOString(),
  lastMessagePreview: groupMentionsOnly ? groupMentionText : "Is the blue one available?",
  canSendMessage: true,
  labels: [{ id: "vip", name: "VIP", color: null }],
});
const messages = {};
for (const number of numbers)
  messages[`chat-${number.id}`] = [
    {
      id: `message-${number.id}`,
      conversationId: `chat-${number.id}`,
      type: "REPLY",
      direction: "INBOUND",
      body: "Is the blue one available?",
      files: [],
      fileNames: [],
      deliveryStatus: "READ",
      failureReason: null,
      createdAt: new Date().toISOString(),
      isRevoked: false,
    },
  ];
if (groupMentionsOnly) {
  messages["chat-sales"][0] = {
    ...messages["chat-sales"][0],
    body: groupMentionText,
    mentionedParticipants: mentionPeople,
    sender: { id: "sender", name: "Ananya Shah", mobileNumber: "919999999999" },
    isPinned: true,
  };
  messages["chat-sales"].push({
    ...messages["chat-sales"][0],
    id: "note-sales",
    type: "PRIVATE_NOTE",
    body: "Team-only note",
    mentionedParticipants: [],
  });
}
let sendCount = 0;
let scheduleCount = 0;
let scheduleFailure = false;
const scheduledMessages = [];
let mode = "normal";
let theme = "light";
let socket;
const errors = [];
const requests = [];
const results = [];
const popupOnly = process.argv.includes("--popup-spacing");
const scheduledOnly = process.argv.includes("--scheduled-messages");
const checkChatLoading = process.argv.includes("--chat-loading") || popupOnly;
let threadFixture = { empty: false, backfilling: false, failure: false, delay: 0 };
let threadReplies = 0;

async function main() {
  let targets;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      targets = await fetch("http://localhost:9243/json").then((response) => response.json());
      if (targets.length) break;
    } catch {}
    await delay(250);
  }
  if (!targets?.length) throw new Error("Headless browser did not start.");
  socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let sequence = 0;
  const pending = new Map();
  function call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  socket.onmessage = async ({ data }) => {
    const event = JSON.parse(data);
    if (event.id) {
      const request = pending.get(event.id);
      pending.delete(event.id);
      if (event.error) request?.reject(new Error(event.error.message));
      else request?.resolve(event.result);
      return;
    }
    if (event.method === "Runtime.exceptionThrown")
      errors.push(
        event.params.exceptionDetails.exception?.description || event.params.exceptionDetails.text,
      );
    if (event.method !== "Fetch.requestPaused") return;
    const { requestId, request } = event.params;
    const url = new URL(request.url);
    try {
      if (url.origin !== apiOrigin) {
        await call("Fetch.continueRequest", { requestId });
        return;
      }
      // No socket server in the fixtures: the app falls back to polling, as it does when the socket is down.
      if (url.pathname.startsWith("/socket.io/")) {
        await call("Fetch.failRequest", { requestId, errorReason: "ConnectionRefused" });
        return;
      }
      requests.push({ method: request.method, pathname: url.pathname, query: url.search });
      const envelope = (data) => ({ success: true, data });
      let body;
      let status = 200;
      const pathname = url.pathname;
      if (request.method === "OPTIONS") body = {};
      else if (pathname.endsWith("/auth/me"))
        body = envelope({
          id: "ui-user",
          name: "Alex",
          mobileNumber: "919876543210",
          email: null,
          isVerified: true,
          isEmailVerified: false,
          isOnboarded: true,
          workspaceId: "ui-workspace",
          defaultWorkspaceId: "ui-workspace",
          preferences: { theme },
        });
      else if (pathname.endsWith("/workspaces"))
        body = envelope([
          { id: "ui-workspace", name: "Acme Store", logo: null, role: "OWNER", status: "ENABLED" },
          ...(notificationsOnly
            ? [
                {
                  id: "other-workspace",
                  name: "Other store",
                  logo: null,
                  role: "OWNER",
                  status: "ENABLED",
                },
              ]
            : []),
        ]);
      else if (pathname.endsWith("/workspaces/ui-workspace"))
        body = envelope({
          id: "ui-workspace",
          name: "Acme Store",
          logo: null,
          role: "OWNER",
          status: "ENABLED",
        });
      else if (notificationsOnly && pathname.endsWith("/workspaces/other-workspace"))
        body = envelope({
          id: "other-workspace",
          name: "Other store",
          logo: null,
          role: "OWNER",
          status: "ENABLED",
        });
      else if (notificationsOnly && pathname.endsWith("/set-default")) body = envelope(null);
      else if (pathname.endsWith("/whatsapp/sessions")) body = envelope({ sessions: numbers });
      else if (pathname.endsWith("/ai-rephrase"))
        body = envelope({ rephrasedContent: "Hi {{firstName}}, happy to help!" });
      else if (/\/inbox\/conversations\/[^/]+\/picture$/.test(pathname)) body = { url: null };
      else if (/\/inbox\/conversations\/[^/]+\/typing$/.test(pathname)) body = { success: true };
      else if (pathname.endsWith("/inbox/conversations/bulk")) body = { updated: 1 };
      else if (pathname.endsWith("/inbox/conversations/contact"))
        body = conversation(JSON.parse(request.postData).sessionId);
      else if (/\/inbox\/conversations\/[^/]+\/scheduled-messages$/.test(pathname)) {
        const id = pathname.split("/").at(-2);
        if (request.method === "POST") {
          if (scheduleFailure) {
            status = 503;
            body = { message: "Scheduling temporarily unavailable" };
          } else {
            scheduleCount++;
            const field = (name) =>
              request.postData?.match(
                new RegExp(`name="${name}"\\s*\\r?\\n\\r?\\n([^\\r\\n]*)`),
              )?.[1];
            body = {
              id: `scheduled-${scheduleCount}`,
              conversationId: id,
              status: "PENDING",
              scheduledAt: field("scheduledAt"),
              timezone: field("timezone"),
              body: field("text"),
              files: [],
              fileNames: [],
              contentType: "TEXT",
              failureReason: null,
              canManage: true,
            };
            assert.ok(
              Date.parse(body.scheduledAt) > Date.now() + 59_000,
              "A future absolute send time is uploaded",
            );
            scheduledMessages.push(body);
          }
        } else {
          const rows = scheduledMessages.filter(
            (item) =>
              item.conversationId === id &&
              ["PENDING", "PROCESSING", "FAILED"].includes(item.status),
          );
          body = { data: rows, total: rows.length, page: 1, limit: 100 };
        }
      } else if (/\/inbox\/scheduled-messages\/[^/]+(?:\/(?:send-now|retry))?$/.test(pathname)) {
        const id = pathname.match(/\/scheduled-messages\/([^/]+)/)[1];
        const item = scheduledMessages.find((message) => message.id === id);
        assert.ok(item, `Scheduled message ${id} exists`);
        item.status =
          request.method === "DELETE"
            ? "CANCELLED"
            : pathname.endsWith("/retry")
              ? "PENDING"
              : "PROCESSING";
        body = item;
      } else if (/\/inbox\/conversations\/[^/]+\/messages$/.test(pathname)) {
        const id = pathname.split("/").at(-2);
        if (request.method === "POST") {
          sendCount++;
          const text =
            request.postData?.match(/name="text"\s*\r?\n\r?\n([^\r\n]*)/)?.[1] ||
            "Yes, blue is available";
          const message = {
            ...messages[id][0],
            id: `sent-${sendCount}`,
            direction: "OUTBOUND",
            body: text,
            deliveryStatus: "SENT",
          };
          messages[id].push(message);
          body = message;
        } else {
          const fixture = { ...threadFixture };
          if (fixture.delay) await delay(fixture.delay);
          if (fixture.failure) {
            status = 503;
            body = { message: "Messages temporarily unavailable" };
          } else
            body = {
              data: fixture.empty ? [] : messages[id],
              hasMore: false,
              nextCursor: null,
              backfilling: fixture.backfilling,
            };
        }
      } else if (pathname.endsWith("/inbox/conversations")) {
        const conversationId = url.searchParams.get("conversationId");
        const sessionId =
          url.searchParams.get("sessionId") ||
          (notificationsOnly && conversationId?.startsWith("chat-")
            ? conversationId.slice(5)
            : null);
        assert.ok(
          sessionId,
          "Every conversation request must specify a number or an exact notification conversation",
        );
        if (mode === "failure") {
          body = { message: "Unable to load chats right now" };
          status = 503;
        } else
          body = {
            data: mode === "empty" || sessionId === "removed" ? [] : [conversation(sessionId)],
            total: mode === "empty" ? 0 : 1,
            page: 1,
            limit: 30,
          };
      } else if (pathname.endsWith("/contacts/all"))
        body = envelope({
          contacts: [{ id: "contact-1", name: "Ananya Shah", mobileNumber: "919999999999" }],
          hasMore: false,
        });
      else {
        errors.push(`Unexpected API request: ${request.method} ${pathname}`);
        body = { success: false, message: "Unmocked test endpoint" };
      }
      await call("Fetch.fulfillRequest", {
        requestId,
        responseCode: status,
        responseHeaders: [
          { name: "Content-Type", value: "application/json" },
          { name: "Access-Control-Allow-Origin", value: origin },
          { name: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
          { name: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
        ],
        body: Buffer.from(JSON.stringify(body)).toString("base64"),
      });
      if (request.method === "GET" && /\/inbox\/conversations\/[^/]+\/messages$/.test(pathname))
        threadReplies++;
    } catch (error) {
      if (/Invalid InterceptionId/.test(error.message)) return;
      errors.push(error.message);
      await call("Fetch.failRequest", { requestId, errorReason: "Aborted" }).catch(() => {});
    }
  };
  const evaluate = async (expression) => {
    const value = await call("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (value.exceptionDetails)
      throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
    return value.result.value;
  };
  const waitFor = async (expression, label) => {
    for (let attempt = 0; attempt < 180; attempt++) {
      if (await evaluate(expression)) return;
      await delay(250);
    }
    throw new Error(`Timed out: ${label}\n${await evaluate("document.body.innerText")}`);
  };
  const click = async (label) => {
    const selector = JSON.stringify(`[aria-label="${label}"]`);
    const target = `(document.querySelector(${selector}) || Array.from(document.querySelectorAll('[role="button"],button')).find(el => el.innerText.trim() === ${JSON.stringify(label)}))`;
    await waitFor(`!!${target}`, label);
    await evaluate(`${target}.click()`);
    await delay(300);
  };
  const screenshot = async (name) => {
    await delay(300);
    const image = await call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    writeFileSync(path.join(output, `${name}.png`), Buffer.from(image.data, "base64"));
    const overflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth + 1");
    assert.equal(overflow, false, `${name}: horizontal page overflow`);
    assert.equal(
      await evaluate(`Array.from(document.querySelectorAll('[role=dialog], [aria-modal=true]')).some(el =>
      el.getAttribute('aria-label') !== 'AI rephrase options' && !el.querySelector('[aria-label="AI rephrase options"]'))`),
      false,
      `${name}: an unexpected dialog was rendered`,
    );
    results.push(name);
    console.log(`PASS ${name}`);
  };
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Network.enable");
  await call("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  await call("Network.setCookie", {
    name: "rk_mobile_access_token",
    value: "ui-review-only",
    url: origin,
  });
  await call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call("Page.navigate", { url: `${origin}/inbox` });
  await waitFor('document.body.innerText.includes("Ananya Shah")', "Inbox loaded");
  if (notificationsOnly) {
    await call("Page.navigate", { url: `${origin}/settings?section=preferences` });
    await waitFor(
      "!!document.querySelector('[aria-label=\"Incoming message notifications\"]')",
      "Notification settings rendered",
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await call("Emulation.setDeviceMetricsOverride", {
        width,
        height: 844,
        deviceScaleFactor: 1,
        mobile: width < 900,
      });
      await evaluate(
        'document.querySelector(\'[aria-label="Phone notifications"]\').scrollIntoView({block:"center"})',
      );
      for (const label of ["Phone notifications", "Incoming message notifications"]) {
        const control = await evaluate(
          `(() => { const el = document.querySelector('[aria-label="${label}"]'); const r = el.getBoundingClientRect(); return { disabled: el.getAttribute('aria-disabled'), role: el.getAttribute('role'), width: r.width, height: r.height }; })()`,
        );
        assert.equal(control.disabled, "true", `${label}: unavailable on web`);
        assert.equal(control.role, "switch");
        assert.ok(control.width >= 44 && control.height >= 44, `${label}: accessible touch target`);
      }
      assert.ok(
        await evaluate('document.body.innerText.includes("available in the Android and iOS app")'),
      );
      await screenshot(`notifications-settings-${width}`);
    }
    await call("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    const openNotification = async (workspaceId, conversationId, messageId) => {
      const params = new URLSearchParams({
        event: "inbox.message.received",
        workspaceId,
        conversationId,
        messageId,
        sessionId: "untrusted-number",
      });
      await call("Page.navigate", { url: `${origin}/notification?${params}` });
    };
    await openNotification("ui-workspace", "chat-support", "message-support");
    await waitFor(
      'location.pathname.includes("/chat/chat-support") && !!document.querySelector("textarea")',
      "Incoming notification opens the other number",
    );
    assert.equal(
      await evaluate('new URLSearchParams(location.search).get("sessionId")'),
      "support",
    );
    assert.equal(
      await evaluate('new URLSearchParams(location.search).get("messageId")'),
      "message-support",
    );
    await screenshot("notifications-open-message");
    await openNotification("other-workspace", "chat-sales", "message-sales");
    await waitFor(
      'location.pathname.includes("/chat/chat-sales") && !!document.querySelector("textarea")',
      "Incoming notification switches workspace",
    );
    assert.ok(
      requests.some(
        (r) => r.method === "PUT" && r.pathname.endsWith("/workspaces/other-workspace/set-default"),
      ),
    );
    await openNotification("ui-workspace", "chat-removed", "message-removed");
    await waitFor(
      'document.body.innerText.includes("no longer available to your account")',
      "Removed conversation shows inline failure",
    );
    await screenshot("notifications-inaccessible");
    await openNotification("missing-workspace", "chat-sales", "message-sales");
    await waitFor(
      'document.body.innerText.includes("This workspace is no longer available")',
      "Removed workspace is blocked",
    );
    assert.deepEqual(errors, []);
    writeFileSync(
      path.join(output, "notifications-results.json"),
      JSON.stringify({ results, errors, requests }, null, 2),
    );
    console.log(
      "PASS notification settings at five widths, safe web fallback, exact-number navigation, workspace switching and access failures.",
    );
    return;
  }
  if (groupMentionsOnly) {
    await waitFor(
      'document.body.innerText.includes("@Priya Shah") && document.body.innerText.includes("@Kabir Khan")',
      "Inbox last message displays participant names",
    );
    assert.equal(
      await evaluate('document.body.innerText.includes("23984327598432")'),
      false,
      "Inbox does not show the raw WhatsApp id",
    );
    await screenshot("mentions-inbox-390");
    await evaluate(
      `Array.from(document.querySelectorAll('[aria-label]')).find(el => el.getAttribute('aria-label').startsWith('Ananya Shah,')).click()`,
    );
    await waitFor(
      '!!document.querySelector("textarea") && document.body.innerText.includes("@Priya Shah")',
      "Group message names loaded",
    );
    assert.equal(
      await evaluate('document.body.innerText.includes("23984327598432")'),
      false,
      "Message and pinned preview show names",
    );
    await screenshot("mentions-group-chat-390");
    await click("Back to chats");
    await waitFor(
      'document.body.innerText.includes("@Priya Shah") && document.body.innerText.includes("@Kabir Khan")',
      "Last message still displays names after returning",
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS group mention names in inbox preview, message bubble, pinned preview and return to inbox; private notes do not replace the last reply.",
    );
    return;
  }
  if (scheduledOnly) {
    await call("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    await evaluate(
      `Array.from(document.querySelectorAll('[aria-label]')).find(el => el.getAttribute('aria-label').startsWith('Ananya Shah,')).click()`,
    );
    await waitFor('!!document.querySelector("textarea")', "Chat opened");
    const draft = async (text) => {
      await evaluate(
        `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(document.querySelector('textarea'), ${JSON.stringify(text)}); document.querySelector('textarea').dispatchEvent(new Event('input', {bubbles:true}));`,
      );
      await delay(100);
    };
    const picker = "!!document.querySelector('[aria-label=\"Cancel scheduling, keep draft\"]')";
    const confirm = async () => {
      await evaluate(`document.querySelector('[aria-label^="Schedule for "]').click()`);
      await delay(300);
    };
    await draft("Hello tomorrow");
    const rect = await evaluate(
      `(() => { const r = document.querySelector('[aria-label="Send message"]').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
    );
    await call("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: rect.x,
      y: rect.y,
      button: "left",
      clickCount: 1,
    });
    await delay(750);
    await call("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: rect.x,
      y: rect.y,
      button: "left",
      clickCount: 1,
    });
    await waitFor(picker, "Holding Send opens the clock");
    assert.equal(sendCount, 0, "Long press never sends immediately");
    assert.equal(scheduleCount, 0, "Opening the clock does not queue a message");
    for (const width of [320, 390, 768, 1024, 1440]) {
      await call("Emulation.setDeviceMetricsOverride", {
        width,
        height: 844,
        deviceScaleFactor: 1,
        mobile: width < 900,
      });
      await screenshot(`schedule-clock-${width}`);
      const bounds = await evaluate(
        `(() => { const r = document.querySelector('[aria-label^="Schedule for "]').getBoundingClientRect(); return {top:r.top,bottom:r.bottom}; })()`,
      );
      assert.ok(bounds.top >= 0 && bounds.bottom <= 844, "Schedule confirmation stays on screen");
    }
    await click("Cancel scheduling, keep draft");
    assert.equal(
      await evaluate('document.querySelector("textarea").value'),
      "Hello tomorrow",
      "Cancel preserves the draft",
    );
    await click("Schedule message");
    scheduleFailure = true;
    await confirm();
    await waitFor(
      'document.body.innerText.includes("Scheduling temporarily unavailable")',
      "API errors remain inline",
    );
    assert.ok(await evaluate(picker), "Failed scheduling keeps the clock open");
    await click("Cancel scheduling, keep draft");
    assert.equal(
      await evaluate('document.querySelector("textarea").value'),
      "Hello tomorrow",
      "Failure preserves the draft",
    );
    scheduleFailure = false;
    await click("Schedule message");
    await click("Date: Today");
    await click("Hour: 12");
    await click("Minute: 00");
    await click("AM/PM: AM");
    await waitFor(
      'document.body.innerText.includes("at least one minute")',
      "Past times are rejected",
    );
    assert.equal(
      await evaluate(
        `document.querySelector('[aria-label^="Schedule for "]').getAttribute('aria-disabled')`,
      ),
      "true",
    );
    await click("Date: Tomorrow");
    await click("Hour: 9");
    await click("Minute: 30");
    await confirm();
    await waitFor(
      '!!document.querySelector("textarea") && document.body.innerText.includes("1 scheduled")',
      "Scheduled message appears above the composer",
    );
    assert.equal(scheduleCount, 1, "Exactly one scheduled POST");
    assert.equal(sendCount, 0, "Scheduling never uses the immediate-send endpoint");
    assert.equal(
      await evaluate('document.querySelector("textarea").value'),
      "",
      "Accepted scheduling clears the draft",
    );
    await draft("Send this now");
    await click("Send message");
    assert.equal(sendCount, 1, "A normal tap still sends immediately");
    await click("1 scheduled messages");
    await waitFor(
      'document.body.innerText.includes("Hello tomorrow")',
      "Queued content can be reviewed",
    );
    await screenshot("schedule-queued");
    await click("Cancel");
    await click("Keep it");
    assert.equal(
      scheduledMessages[0].status,
      "PENDING",
      "Keeping a scheduled message makes no cancellation request",
    );
    await click("Cancel");
    await click("Cancel message");
    await waitFor(
      '!document.body.innerText.includes("1 scheduled")',
      "Cancelled message leaves the scheduled list",
    );
    assert.equal(scheduledMessages[0].status, "CANCELLED");
    await click("Private note");
    await draft("Team note");
    assert.equal(
      await evaluate("!!document.querySelector('[aria-label=\"Schedule message\"]')"),
      false,
      "Private notes cannot be scheduled",
    );
    assert.deepEqual(errors, []);
    writeFileSync(
      path.join(output, "scheduling-results.json"),
      JSON.stringify({ results, sendCount, scheduleCount, errors }, null, 2),
    );
    console.log(
      "PASS long press, clock wheels, cancel and failed drafts, invalid times, multipart scheduling, scheduled list, cancellation, immediate tap and private-note exclusion.",
    );
    return;
  }
  if (checkChatLoading) {
    const skeleton = "!!document.querySelector('[aria-label=\"Loading messages\"]')";
    const greeting = 'document.body.innerText.includes("Say hello to")';
    const message =
      'document.body.innerText.includes("Is the blue one available?") && !!document.querySelector("textarea")';
    const watchGreeting = () =>
      evaluate(`(() => {
      window.greetingObserver?.disconnect();
      window.greetingSeen = false;
      window.greetingObserver = new MutationObserver(() => {
        if (document.body.innerText.includes('Say hello to')) window.greetingSeen = true;
      });
      window.greetingObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
    })()`);
    const openChat = async () => {
      await evaluate(`Array.from(document.querySelectorAll('[aria-label]')).find(el =>
        el.getAttribute('aria-label').startsWith('Ananya Shah,')).click()`);
      await waitFor('!!document.querySelector("textarea")', "Chat opened");
    };
    const noGreeting = async () =>
      assert.equal(
        await evaluate("window.greetingSeen"),
        false,
        "The greeting must never flash while messages load",
      );
    const reloadInbox = async () => {
      await call("Page.navigate", { url: `${origin}/inbox` });
      await waitFor('document.body.innerText.includes("Ananya Shah")', "Inbox reloaded");
      await watchGreeting();
    };
    if (!popupOnly) {
      threadFixture = { empty: true, backfilling: true, failure: false, delay: 600 };
      await watchGreeting();
      await openChat();
      await waitFor(skeleton, "Skeleton while the first request loads");
      for (let attempt = 0; !threadReplies && attempt < 100; attempt++) await delay(100);
      assert.ok(threadReplies > 0, "Initial history-sync response arrived");
      assert.ok(await evaluate(skeleton), "An empty page while history syncs keeps the skeleton");
      await noGreeting();
      await screenshot("chat-history-sync-loading");
      threadFixture.empty = false;
      threadFixture.backfilling = false;
      await waitFor(message, "History appears after sync");
      await noGreeting();
      assert.equal(await evaluate(skeleton), false);
      await screenshot("chat-history-loaded");

      await click("Back to chats");
      threadFixture.delay = 1200;
      await watchGreeting();
      await openChat();
      await waitFor(message, "Cached messages appear immediately");
      assert.equal(await evaluate(skeleton), false, "Populated cache stays visible during refresh");
      await noGreeting();

      threadFixture = { empty: true, backfilling: false, failure: false, delay: 1000 };
      await reloadInbox();
      await openChat();
      await waitFor(skeleton, "Unknown chat starts with a skeleton");
      await noGreeting();
      await waitFor(greeting, "Confirmed empty chat shows the greeting");
      await screenshot("chat-confirmed-empty");

      await click("Back to chats");
      threadFixture = { empty: true, backfilling: true, failure: false, delay: 600 };
      await watchGreeting();
      await openChat();
      await waitFor(skeleton, "Previously empty cache is rechecked");
      await delay(1000);
      await noGreeting();
      assert.ok(await evaluate(skeleton), "Empty cached thread stays loading during sync");
      threadFixture.empty = false;
      threadFixture.backfilling = false;
      await waitFor(message, "Reopened chat receives its history");
      await noGreeting();

      threadFixture = { empty: true, backfilling: false, failure: true, delay: 600 };
      await reloadInbox();
      await openChat();
      await waitFor(
        'document.body.innerText.includes("Messages temporarily unavailable")',
        "Failed load shows an error",
      );
      await noGreeting();
      threadFixture = { empty: false, backfilling: false, failure: false, delay: 800 };
      await click("Try again");
      await waitFor(skeleton, "Retry shows the message skeleton");
      await waitFor(message, "Retry loads messages");
      await noGreeting();
    } else {
      await openChat();
      await waitFor(message, "Chat messages loaded");
    }
    await evaluate(
      "(" +
        function () {
          const input = document.querySelector("textarea");
          Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(
            input,
            "hi can help",
          );
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }.toString() +
        ")()",
    );
    await click("AI Rephrase");
    await waitFor(
      "!!document.querySelector('[aria-label=\"AI rephrase options\"]')",
      "AI popup opens",
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await call("Emulation.setDeviceMetricsOverride", {
        width,
        height: 844,
        deviceScaleFactor: 1,
        mobile: width < 900,
      });
      await delay(300);
      const popup = await evaluate(
        "(" +
          function () {
            const menu = document
              .querySelector('[aria-label="AI rephrase options"]')
              .getBoundingClientRect();
            const trigger = document
              .querySelector('[aria-label="AI Rephrase"]')
              .getBoundingClientRect();
            const tones = Array.from(document.querySelectorAll('[aria-label^="Rephrase as "]')).map(
              (el) => {
                const r = el.getBoundingClientRect();
                return { top: r.top, bottom: r.bottom, height: r.height };
              },
            );
            return {
              width: menu.width,
              height: menu.height,
              left: menu.left,
              right: menu.right,
              gap: trigger.top - menu.bottom,
              optionGaps: tones.slice(2).map((tone, index) => tone.top - tones[index + 1].bottom),
              spaced: tones.slice(2).every((tone, index) => {
                const gap = tone.top - tones[index + 1].bottom;
                return gap >= 2 && gap <= 3;
              }),
              allVisible:
                tones.length === 6 &&
                tones.every(
                  (tone) => tone.top >= menu.top && tone.bottom <= menu.bottom && tone.height >= 40,
                ),
            };
          }.toString() +
          ")()",
      );
      assert.equal(popup.width, 256, "AI popup has room for its labels");
      assert.ok(
        popup.height >= 260 && popup.height <= 330,
        `AI popup keeps compact vertical spacing (${popup.height}px)`,
      );
      await screenshot(`ai-popup-spaced-${width}`);
      assert.ok(
        popup.spaced,
        `Tone options have a small gap between rows (${popup.optionGaps.join(", ")}px)`,
      );
      assert.ok(popup.allVisible, "Every tone has a roomy row and stays visible");
      assert.ok(popup.gap >= 0 && popup.gap <= 8, "AI popup stays directly above the icon");
      assert.ok(popup.left >= 0 && popup.right <= width + 1, "AI popup fits the screen");
    }
    await click("Rephrase as friendly");
    await waitFor(
      'document.querySelector("textarea").value === "Hi Ananya, happy to help!"',
      "AI rewrite fills the draft",
    );
    assert.equal(sendCount, 0, "AI rephrasing never sends the draft");
    await click("Undo AI rephrase");
    assert.equal(await evaluate('document.querySelector("textarea").value'), "hi can help");
    assert.deepEqual(errors, []);
    writeFileSync(
      path.join(output, "chat-loading-results.json"),
      JSON.stringify({ results, errors, threadReplies }, null, 2),
    );
    console.log(
      "PASS chat loading: delayed messages, history sync, cached messages, confirmed empty, reopened empty cache, failed request and retry; no greeting flashes. AI popup spacing, dimensions, rewrite and Undo pass.",
    );
    return;
  }
  assert.equal(await evaluate('document.body.innerText.includes("All numbers")'), false);
  await screenshot("inbox-390");
  for (const label of [
    "New chat",
    "Chats",
    "Broadcast",
    "Contacts",
    "More",
    "Alerts",
    "Working from Sales, +91 98765 43210. Switch number",
  ]) {
    const size = await evaluate(
      `(() => {const el=document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)}); if(!el) throw new Error("Missing " + ${JSON.stringify(label)}); const r=el.getBoundingClientRect(); return [r.width,r.height];})()`,
    );
    assert.ok(size[0] >= 44 && size[1] >= 44, `${label} needs a 44px touch target`);
  }
  await click("Working from Sales, +91 98765 43210. Switch number");
  await waitFor('document.body.innerText.includes("Connect another number")', "Number screen");
  await screenshot("numbers-390");
  await evaluate(
    'Array.from(document.querySelectorAll("[aria-label]")).find(el => el.getAttribute("aria-label").startsWith("Support," )).click()',
  );
  await waitFor(
    'document.body.innerText.includes("Rahul Mehta") && !document.body.innerText.includes("Ananya Shah")',
    "Support selected",
  );
  await screenshot("support-inbox-390");
  await click("More");
  await waitFor('document.body.innerText.includes("AI connections")', "Menu screen");
  await screenshot("menu-390");
  await click("Chats");
  await click("New chat");
  await waitFor('document.body.innerText.includes("Ananya Shah")', "New chat contacts");
  await screenshot("new-chat-390");
  await click("Chat with Ananya Shah");
  await waitFor(
    'document.body.innerText.includes("Is the blue one available?") && !!document.querySelector("textarea")',
    "Chat thread",
  );
  await screenshot("chat-390");
  await evaluate(
    'Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(document.querySelector("textarea"),"Yes, blue is available"); document.querySelector("textarea").dispatchEvent(new Event("input",{bubbles:true}))',
  );
  await click("Send message");
  await waitFor('document.body.innerText.includes("Yes, blue is available")', "Reply appears");
  assert.equal(sendCount, 1, "One reply request");
  await screenshot("chat-reply-390");
  await click("Back to chats");
  for (const width of [320, 768, 1024, 1440]) {
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: width < 900,
    });
    await call("Page.navigate", { url: `${origin}/inbox` });
    await waitFor(
      'document.body.innerText.includes("Rahul Mehta")',
      "Remembered number after reload",
    );
    await screenshot(`inbox-${width}`);
  }
  await call("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: "dark" },
      { name: "prefers-reduced-motion", value: "reduce" },
    ],
  });
  theme = "dark";
  await call("Page.navigate", { url: `${origin}/inbox` });
  await waitFor('document.body.innerText.includes("Rahul Mehta")', "Dark inbox");
  await waitFor('document.documentElement.classList.contains("dark")', "Dark theme applied");
  await screenshot("inbox-dark-reduced-motion-390");
  await call("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: "light" }],
  });
  theme = "light";
  mode = "empty";
  await call("Page.navigate", { url: `${origin}/inbox` });
  await waitFor('document.body.innerText.includes("No chats here yet")', "Empty inbox");
  await screenshot("inbox-empty-390");
  mode = "failure";
  await call("Page.navigate", { url: `${origin}/inbox` });
  await waitFor(
    'document.body.innerText.includes("Unable to load chats right now")',
    "Recoverable error",
  );
  await screenshot("inbox-error-390");
  mode = "normal";
  numbers[1].status = "STOPPED";
  numbers[1].isWhatsAppConnected = false;
  await call("Page.navigate", { url: `${origin}/inbox` });
  await waitFor(
    'document.body.innerText.includes("Not connected") && document.body.innerText.includes("Rahul Mehta")',
    "Disconnected selected number retained",
  );
  assert.ok(
    await evaluate(
      `document.body.innerText.includes("Support isn't connected") && document.body.innerText.includes("Read-only · replies paused")`,
    ),
    "Reconnect dock and paused divider are visible",
  );
  await screenshot("inbox-disconnected-390");
  assert.ok(
    await evaluate(`!document.querySelector(${JSON.stringify('[aria-label="New chat"]')})`),
  );
  await click("Not connected. Switch number");
  await waitFor('document.body.innerText.includes("Manage numbers")', "Numbers screen");
  await call("Page.navigate", { url: `${origin}/inbox` });
  await click("Reconnect Support");
  await waitFor('document.body.innerText.includes("Get linking code")', "Phone linking screen");
  await screenshot("connect-number-390");
  numbers[1].phoneNumber = null;
  await call("Page.navigate", { url: `${origin}/inbox` });
  await waitFor(
    'document.body.innerText.includes("Link your WhatsApp") && !document.body.innerText.includes("Not connected")',
    "First-time link state",
  );
  assert.ok(
    await evaluate(
      `!document.querySelector(${JSON.stringify('[aria-label="Reconnect Support"]')})`,
    ),
    "A never-linked number must not show the reconnect dock",
  );
  await screenshot("inbox-first-link-390");
  assert.deepEqual(errors, []);
  writeFileSync(
    path.join(output, "results.json"),
    JSON.stringify({ results, sendCount, errors, requests }, null, 2),
  );
  console.log(
    `PASS ${results.length} rendered screens, account switching, persisted selection, reply, no dialogs, no overflow.`,
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    socket?.close();
    browser.kill();
  });
