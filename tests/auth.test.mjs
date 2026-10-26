import assert from "node:assert/strict";
import { test } from "node:test";

import { createApiClient } from "../src/services/api/create-client.ts";
import { createAuthApi } from "../src/features/auth/services/auth-api.ts";
import { createSession } from "../src/services/storage/create-session.ts";
import {
  keyboardOverlap,
  revealOffset,
} from "../src/features/auth/utils/keyboard-scroll.ts";

const phone = { dial: "+91", phone: "9876543210", countryCode: "in" };
const user = {
  id: "user-1",
  mobileNumber: "919876543210",
  name: null,
  email: null,
  isVerified: true,
  isEmailVerified: false,
  isOnboarded: false,
  workspaceId: null,
};
function fixture(responseData, status = 201, headers = {}) {
  const calls = [];
  const client = createApiClient({
    baseUrl: "https://api.example.test",
    getToken: () => "existing-session",
    fetch: async (url, options) => {
      calls.push({
        url,
        ...options,
        json: options.body ? JSON.parse(options.body) : undefined,
      });
      return Response.json(responseData, { status, headers });
    },
  });
  return { api: createAuthApi(client), client, calls };
}
const success = (data) => ({
  success: true,
  statusCode: 200,
  data,
  message: "OK",
});

test("an overlay keypad reduces the scroll viewport, creating room to reveal OTP and Verify", () => {
  const inset = keyboardOverlap(24, 780, 480);
  assert.equal(inset, 324);
  const y = revealOffset({
    offset: 0,
    viewportTop: 24,
    viewportHeight: 780 - inset,
    targetTop: 510,
    targetHeight: 210,
    keyboardTop: 480,
  });
  assert.equal(y, 256);
  assert.equal(510 + 210 - y, 480 - 16);
});

test("Android resize does not produce a second keyboard inset; dismissing clears it", () => {
  assert.equal(keyboardOverlap(24, 430, 480), 0);
  assert.equal(keyboardOverlap(24, 780, null), 0);
});

test("OTP and Verify are revealed above an overlay keyboard with spacing", () => {
  assert.equal(
    revealOffset({
      offset: 0,
      viewportTop: 24,
      viewportHeight: 780,
      targetTop: 510,
      targetHeight: 210,
      keyboardTop: 480,
    }),
    256,
  );
});
test("OTP visibility uses the resized Android viewport instead of subtracting the keyboard twice", () => {
  assert.equal(
    revealOffset({
      offset: 0,
      viewportTop: 24,
      viewportHeight: 430,
      targetTop: 370,
      targetHeight: 190,
      keyboardTop: 500,
    }),
    122,
  );
});
test("visible OTP controls do not jump and tall error sections align their top", () => {
  assert.equal(
    revealOffset({
      offset: 120,
      viewportTop: 24,
      viewportHeight: 430,
      targetTop: 100,
      targetHeight: 200,
      keyboardTop: 500,
    }),
    120,
  );
  assert.equal(
    revealOffset({
      offset: 0,
      viewportTop: 24,
      viewportHeight: 250,
      targetTop: 300,
      targetHeight: 260,
      keyboardTop: 400,
    }),
    260,
  );
});

test("login sends the backend DTO and never sends an existing token to public auth", async () => {
  const { api, calls } = fixture(success({ otpRef: "first" }));
  assert.deepEqual(await api.sendOtp(phone), {
    ok: true,
    channel: "sms",
    otpRef: "first",
  });
  assert.equal(calls[0].url, "https://api.example.test/auth/login");
  assert.deepEqual(calls[0].json, {
    mobileNumber: "+919876543210",
    country: "IN",
  });
  assert.equal(calls[0].headers.Authorization, undefined);
});
test("international email-required response does not become a mobile challenge", async () => {
  const { api } = fixture(success({ emailRequired: true }));
  assert.deepEqual(await api.sendOtp(phone), {
    ok: true,
    channel: "email_required",
  });
});
test("email challenge retains the server delivery address and normalized email request", async () => {
  const { api, calls } = fixture(
    success({
      otpRef: "email-1",
      email: "saved@example.test",
      emailVerificationStep: true,
    }),
  );
  assert.deepEqual(
    await api.sendOtp({
      ...phone,
      email: " Jamie@Example.test ",
      captchaToken: "challenge-token",
    }),
    {
      ok: true,
      channel: "email",
      otpRef: "email-1",
      email: "saved@example.test",
    },
  );
  assert.equal(calls[0].json.email, "jamie@example.test");
  assert.equal(calls[0].json.captchaToken, "challenge-token");
});
test("verifying email never signs the user in: it produces the next SMS challenge", async () => {
  const { api, calls } = fixture(
    success({ mobileVerificationRequired: true, otpRef: "sms-2" }),
  );
  assert.deepEqual(
    await api.verifyOtp({ ...phone, otpRef: "email-1", code: "654321" }),
    { ok: true, next: "mobile_code", otpRef: "sms-2" },
  );
  assert.deepEqual(calls[0].json, {
    mobileNumber: "+919876543210",
    otp: "654321",
    otpRef: "email-1",
  });
});
test("mobile verification returns the issued token and onboarding status from the server user", async () => {
  const { api } = fixture(success({ accessToken: "issued-token", user }));
  assert.deepEqual(
    await api.verifyOtp({ ...phone, otpRef: "sms-2", code: "654321" }),
    { ok: true, next: "signed_in", accessToken: "issued-token", user },
  );
});
test("malformed verify responses cannot create a session", async () => {
  for (const data of [null, {}, { accessToken: "token" }, { user }]) {
    const { api } = fixture(success(data));
    assert.equal(
      (await api.verifyOtp({ ...phone, otpRef: "sms-2", code: "654321" })).ok,
      false,
    );
  }
});
test("resend sends the current email and replaces the OTP reference", async () => {
  const { api, calls } = fixture(
    success({
      otpRef: "fresh",
      email: "jamie@example.test",
      emailVerificationStep: true,
    }),
  );
  const result = await api.resendOtp({ ...phone, email: "jamie@example.test" });
  assert.equal(result.otpRef, "fresh");
  assert.deepEqual(calls[0].json, {
    mobileNumber: "+919876543210",
    email: "jamie@example.test",
  });
});
test("invalid and expired codes map to recoverable form states", async () => {
  for (const [message, reason] of [
    ["Invalid OTP.", "invalid_code"],
    ["OTP has expired.", "expired"],
    ["Invalid OTP reference.", "expired"],
  ]) {
    const { api } = fixture({ message }, 400);
    assert.equal(
      (await api.verifyOtp({ ...phone, otpRef: "old", code: "654321" })).reason,
      reason,
    );
  }
});
test("both the backend 400 cooldown and HTTP 429 preserve retry deadlines", async () => {
  const a = fixture(
    { message: "Please wait 42 seconds before requesting a new OTP." },
    400,
  );
  assert.equal((await a.api.sendOtp(phone)).retryAfter, 42);
  const b = fixture({ message: "Too many requests" }, 429, {
    "retry-after": "19",
  });
  assert.equal((await b.api.resendOtp(phone)).retryAfter, 19);
});
test("only user-facing backend messages reach the form", async () => {
  const blocked = "This account has been banned. Please contact support.";
  assert.equal(
    (await fixture({ message: blocked }, 403).api.sendOtp(phone)).message,
    blocked,
  );
  assert.equal(
    (
      await fixture(
        { message: "SQL connection failed with sensitive diagnostics" },
        500,
      ).api.sendOtp(phone)
    ).message,
    undefined,
  );
});
test("authenticated 401 invalidates the token used on that request; public OTP failures do not", async () => {
  const revoked = [];
  const client = createApiClient({
    baseUrl: "https://api.example.test",
    getToken: () => "session-1",
    onUnauthorized: (token) => revoked.push(token),
    fetch: async () => Response.json({ message: "Expired" }, { status: 401 }),
  });
  await client("/auth/me");
  await client("/auth/verify-otp", { auth: false });
  assert.deepEqual(revoked, ["session-1"]);
});
test("network failures are returned without throwing", async () => {
  const client = createApiClient({
    baseUrl: "https://api.example.test",
    getToken: () => null,
    fetch: async () => {
      throw new TypeError("offline");
    },
  });
  assert.equal(
    (await client("/auth/login", { auth: false })).reason,
    "network",
  );
});
test("signing out during a pending secure save cannot resurrect that session", async () => {
  let disk = null;
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const session = createSession({
    read: async () => disk,
    write: async (token) => {
      await blocked;
      disk = token;
    },
    remove: async () => {
      disk = null;
    },
  });
  const saving = session.save("old-token");
  const rejected = assert.rejects(saving, /Session changed/);
  const clearing = session.clear();
  release();
  await Promise.all([rejected, clearing]);
  assert.equal(session.getToken(), null);
  assert.equal(disk, null);
});
test("a late 401 from an old session cannot revoke the new session", async () => {
  let disk = null;
  const session = createSession({
    read: async () => disk,
    write: async (token) => {
      disk = token;
    },
    remove: async () => {
      disk = null;
    },
  });
  await session.save("new-token");
  session.invalidate("old-token");
  assert.equal(session.getToken(), "new-token");
  assert.equal(disk, "new-token");
});
