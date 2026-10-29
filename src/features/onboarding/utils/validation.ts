import type { AuthUser } from "../../auth/types/auth.types";
import {
  FULL_NAME_MAX,
  WORKSPACE_NAME_MAX,
  LOGO_MAX_BYTES,
  LOGO_ACCEPT,
  INDUSTRIES,
  TEAM_SIZES,
  MESSAGE_VOLUMES,
  REFERRAL_SOURCES,
  SETUP_STEPS,
  USE_CASES,
  type SetupStepId,
} from "../constants";
import type { SetupAnswers, SavedSetup, WorkspaceLogo } from "../types/onboarding.types";

export const emptyAnswers = (): SetupAnswers => ({
  workspaceName: "",
  name: "",
  email: "",
  emailVerified: false,
  industry: "",
  teamSize: "",
  useCases: [],
  volume: "",
  source: "",
});
export const stripEmailAlias = (email: string) => email.trim().replace(/\+[^@]*(?=@)/, "");
export const emailIdentity = (email: string) => stripEmailAlias(email).toLowerCase();
export const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && email.trim().length <= 150;
const known = (options: readonly { value: string }[], value: unknown) =>
  typeof value === "string" && options.some((option) => option.value === value) ? value : "";

export function prefillAnswers(user: AuthUser, saved: SavedSetup | null = null): SetupAnswers {
  const initial = {
    ...emptyAnswers(),
    name: user.name ?? "",
    email: user.email ?? "",
    industry: user.occupation ?? "",
    teamSize: user.companySize ?? "",
    volume: user.whatsappMessageVolume ?? "",
    source: user.referralSource ?? "",
  };
  const draft = saved?.version === 1 && saved.userId === user.id ? saved.answers : null;
  const answers = { ...initial };
  for (const key of [
    "workspaceName",
    "name",
    "email",
    "industry",
    "teamSize",
    "volume",
    "source",
  ] as const) {
    if (draft && typeof draft[key] === "string") answers[key] = draft[key];
  }
  answers.workspaceName = answers.workspaceName.slice(0, WORKSPACE_NAME_MAX);
  answers.name = answers.name.slice(0, FULL_NAME_MAX);
  answers.industry = known(INDUSTRIES, answers.industry);
  answers.teamSize = known(TEAM_SIZES, answers.teamSize);
  answers.volume = known(MESSAGE_VOLUMES, answers.volume);
  answers.source = known(REFERRAL_SOURCES, answers.source);
  answers.useCases = Array.isArray(draft?.useCases)
    ? [
        ...new Set(
          draft.useCases.filter((value) => USE_CASES.some((option) => option.value === value)),
        ),
      ]
    : [];
  // A cached flag is never proof of email verification; the server profile is.
  answers.emailVerified =
    !!user.email &&
    user.isEmailVerified &&
    emailIdentity(user.email) === emailIdentity(answers.email);
  return answers;
}

export function validationError(step: SetupStepId, answers: SetupAnswers): string | null {
  if (
    step === "workspace" &&
    (!answers.workspaceName.trim() || answers.workspaceName.trim().length > WORKSPACE_NAME_MAX)
  )
    return "Enter a workspace name of up to 40 characters.";
  if (step === "you") {
    if (answers.name.trim().length < 2 || answers.name.trim().length > FULL_NAME_MAX)
      return "Enter your full name (2–60 characters).";
    if (answers.email.trim() && (!isValidEmail(answers.email) || !answers.emailVerified))
      return "Verify this email, or clear it to continue.";
  }
  if (
    step === "business" &&
    ((answers.industry && !known(INDUSTRIES, answers.industry)) ||
      (answers.teamSize && !known(TEAM_SIZES, answers.teamSize)))
  )
    return "Choose a valid business option.";
  if (step === "usage" && answers.volume && !known(MESSAGE_VOLUMES, answers.volume))
    return "Choose a valid message volume.";
  if (step === "source" && answers.source && !known(REFERRAL_SOURCES, answers.source))
    return "Choose a valid referral source.";
  return null;
}

export function logoError(logo?: WorkspaceLogo | null): string | null {
  if (!logo) return null;
  if (!LOGO_ACCEPT.split(",").includes(logo.type)) return "Choose a PNG or JPG image.";
  if (!Number.isFinite(logo.size) || logo.size <= 0 || logo.size > LOGO_MAX_BYTES)
    return "Choose an image under 2 MB.";
  if (!logo.name || (logo.kind === "native" && !logo.uri)) return "Choose an image again.";
  return null;
}

export function setupSteps(includeWorkspace: boolean): SetupStepId[] {
  return SETUP_STEPS.filter((step) => includeWorkspace || step !== "workspace");
}
