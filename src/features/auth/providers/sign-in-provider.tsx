import { router } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { env } from "@/config/env";
import { getCountry } from "@/lib/auth/countries";
import {
  invalidPhoneMessage,
  isValidPhone,
  OTP_LENGTH,
  RESEND_SECONDS,
  sanitizePhone,
} from "@/lib/auth/phone";

import { resendOtp, sendOtp, verifyOtp } from "../services/auth-service";
import type { AuthFailure, SendOtpResult } from "../types/auth.types";
import { useAuthSession } from "./session-provider";

export interface OtpChallenge {
  channel: "sms" | "email";
  otpRef: string;
  email?: string;
  resendAvailableAt: number;
}
function failureMessage(result: AuthFailure, fallback: string) {
  return result.reason === "rate_limited"
    ? `Too many attempts. Try again in ${result.retryAfter ?? RESEND_SECONDS}s.`
    : result.message || fallback;
}

function useSignInController() {
  const { completeSignIn } = useAuthSession();
  const [countryCode, setCountryCode] = useState("in");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emailRequired, setEmailRequired] = useState(false);
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"send" | "verify" | "resend" | null>(null);
  const [resent, setResent] = useState(false);
  const [inputAttempt, setInputAttempt] = useState(0);
  const [sendBlockedUntil, setSendBlockedUntil] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);
  const country = getCountry(countryCode);
  const request = { dial: country.dial, phone, countryCode };
  function resetCaptcha() {
    setCaptchaToken(null);
    setCaptchaKey((value) => value + 1);
  }
  function begin(kind: NonNullable<typeof busy>) {
    if (pending.current) return null;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(kind);
    return controller;
  }
  function finish(controller: AbortController) {
    if (pending.current !== controller) return;
    pending.current = null;
    setBusy(null);
  }
  function receiveCode(result: Extract<SendOtpResult, { ok: true }>, replace = false) {
    if (result.channel === "email_required") {
      setEmailRequired(true);
      setChallenge(null);
      setEmailError(null);
      resetCaptcha();
      router.replace("/email");
      return;
    }
    setChallenge({
      channel: result.channel,
      otpRef: result.otpRef,
      ...(result.channel === "email" && { email: result.email }),
      resendAvailableAt: Date.now() + RESEND_SECONDS * 1000,
    });
    setCode("");
    setCodeError(null);
    setResent(false);
    if (replace) router.replace("/verify-otp");
    else router.push("/verify-otp");
  }

  async function requestCode(withEmail = false) {
    if (pending.current || Date.now() < sendBlockedUntil) return;
    if (!isValidPhone(phone, countryCode)) {
      setPhoneError(invalidPhoneMessage(countryCode));
      return;
    }
    if (withEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address.");
      return;
    }
    const setError = withEmail ? setEmailError : setPhoneError;
    if (env.turnstileSiteKey && !captchaToken) {
      setError("Complete the security verification to continue.");
      return;
    }
    setError(null);
    const controller = begin("send");
    if (!controller) return;
    const result = await sendOtp(
      {
        ...request,
        ...(withEmail && { email }),
        ...(captchaToken && { captchaToken }),
      },
      controller.signal,
    );
    finish(controller);
    if (controller.signal.aborted) return;
    resetCaptcha();
    if (result.ok) receiveCode(result);
    else {
      if (result.reason === "rate_limited")
        setSendBlockedUntil(Date.now() + (result.retryAfter ?? RESEND_SECONDS) * 1000);
      setError(failureMessage(result, "We couldn’t send the code. Please try again."));
    }
  }

  async function verify(value: string) {
    if (!challenge || !/^\d{6}$/.test(value)) return;
    const controller = begin("verify");
    if (!controller) return;
    setCodeError(null);
    const result = await verifyOtp(
      { ...request, code: value, otpRef: challenge.otpRef },
      controller.signal,
    );
    if (controller.signal.aborted) {
      finish(controller);
      return;
    }
    if (result.ok && result.next === "mobile_code") {
      setChallenge({
        channel: "sms",
        otpRef: result.otpRef,
        resendAvailableAt: Date.now() + RESEND_SECONDS * 1000,
      });
      setCode("");
      setResent(false);
    } else if (result.ok) {
      try {
        await completeSignIn(result.accessToken, result.user);
        // Root protected routes remove auth history; the index chooses setup or inbox.
        router.replace("/");
      } catch {
        setCode("");
        setInputAttempt((value) => value + 1);
        setChallenge((current) => (current ? { ...current, resendAvailableAt: 0 } : null));
        setCodeError("We couldn’t save your sign-in on this device. Please request a new code.");
      }
    } else {
      setCode("");
      setInputAttempt((value) => value + 1);
      if (result.reason === "expired") {
        setChallenge((current) => (current ? { ...current, resendAvailableAt: 0 } : null));
        setCodeError("That code has expired. Request a new one.");
      } else if (result.reason === "invalid_code") {
        setCodeError(
          challenge.channel === "email"
            ? "That code didn’t match. Check your email and try again."
            : "That code didn’t match. Check the SMS and try again.",
        );
      } else setCodeError(failureMessage(result, "We couldn’t verify the code. Please try again."));
    }
    finish(controller);
  }

  async function resend() {
    if (!challenge || Date.now() < challenge.resendAvailableAt) return;
    const controller = begin("resend");
    if (!controller) return;
    setCodeError(null);
    const result = await resendOtp(
      {
        ...request,
        ...(challenge.channel === "email" && { email: challenge.email }),
      },
      controller.signal,
    );
    finish(controller);
    if (controller.signal.aborted) return;
    if (result.ok) {
      if (result.channel === "email_required") {
        receiveCode(result, true);
        return;
      }
      setChallenge({
        channel: result.channel,
        otpRef: result.otpRef,
        ...(result.channel === "email" && { email: result.email }),
        resendAvailableAt: Date.now() + RESEND_SECONDS * 1000,
      });
      setCode("");
      setResent(true);
    } else {
      if (result.reason === "rate_limited")
        setChallenge((current) =>
          current
            ? {
                ...current,
                resendAvailableAt: Date.now() + (result.retryAfter ?? RESEND_SECONDS) * 1000,
              }
            : null,
        );
      setCodeError(failureMessage(result, "We couldn’t send the code. Please try again."));
    }
  }

  function backToPhone() {
    pending.current?.abort();
    pending.current = null;
    setBusy(null);
    setChallenge(null);
    setCode("");
    setCodeError(null);
    resetCaptcha();
    router.replace("/login");
  }
  function backFromCode() {
    if (busy) return;
    if (challenge?.channel === "email") {
      setEmailRequired(true);
      setChallenge(null);
      setCode("");
      resetCaptcha();
      router.replace("/email");
    } else backToPhone();
  }

  return {
    countryCode,
    phone,
    email,
    emailRequired,
    challenge,
    code,
    busy,
    resent,
    inputAttempt,
    phoneError,
    emailError,
    codeError,
    sendBlockedUntil,
    captchaKey,
    setCaptchaToken,
    changeCountry(next: string) {
      setCountryCode(next);
      setPhone(sanitizePhone(phone, next));
      setPhoneError(null);
      setSendBlockedUntil(0);
    },
    changePhone(raw: string) {
      setPhone(sanitizePhone(raw, countryCode));
      setPhoneError(null);
      setSendBlockedUntil(0);
    },
    changeEmail(value: string) {
      setEmail(value);
      setEmailError(null);
    },
    changeCode(value: string) {
      setCode(value.slice(0, OTP_LENGTH));
      setCodeError(null);
    },
    requestCode,
    verify,
    resend,
    backToPhone,
    backFromCode,
  };
}

const Context = createContext<ReturnType<typeof useSignInController> | null>(null);
export function SignInProvider({ children }: PropsWithChildren) {
  const controller = useSignInController();
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useSignIn() {
  const context = useContext(Context);
  if (!context) throw new Error("useSignIn requires SignInProvider.");
  return context;
}
