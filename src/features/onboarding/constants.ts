// Answer options for workspace setup. Values are the API's enum keys
// (roklo-api prisma/schema.prisma), sent as-is to `POST /auth/onboarding`; the
// labels are ours. The design's own option lists differ from the API, and the
// decision was to show the API's values.

export interface SetupOption<T extends string = string> {
  value: T;
  label: string;
}

export const SETUP_STEPS = ["workspace", "you", "business", "usage", "source"] as const;
export type SetupStepId = (typeof SETUP_STEPS)[number];

/** Header stepper labels, one per step (the design's copy). */
export const STEP_LABELS: Record<SetupStepId, string> = {
  workspace: "Let’s set up",
  you: "Nice to meet you",
  business: "Tell us more",
  usage: "Your priorities",
  source: "You’re in",
};

export const WORKSPACE_NAME_MAX = 40;
export const FULL_NAME_MAX = 60;
/** The API's upload limit for the workspace logo. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ACCEPT = "image/png,image/jpeg";

/** Letter keys that pick an option tile (A = first). */
export const OPTION_KEYS = "ABCDEFGHI";

export const INDUSTRIES: SetupOption[] = [
  { value: "AGENCY", label: "Agency" },
  { value: "ECOMMERCE", label: "E-commerce" },
  { value: "ECOMMERCE_D2C", label: "E-commerce (D2C brand)" },
  { value: "EDUCATION", label: "Education" },
  { value: "FINTECH_BANKING", label: "Fintech and banking" },
  { value: "HEALTHCARE", label: "Healthcare" },
  { value: "HEALTHCARE_WELLNESS", label: "Health and wellness" },
  { value: "MANUFACTURING", label: "Manufacturing" },
  { value: "PRIVATE_BUSINESS_OWNER", label: "Private business owner" },
  { value: "REAL_ESTATE", label: "Real estate" },
  { value: "RETAIL", label: "Retail" },
  { value: "SAAS", label: "SaaS" },
  { value: "TOURS_AND_TRAVEL", label: "Tours and travel" },
  { value: "TRADER", label: "Trading" },
  { value: "TRAVEL_HOSPITALITY", label: "Travel and hospitality" },
  { value: "OTHER", label: "Other" },
];

/** Three starter templates per industry, shown in the business step's preview. */
export const STARTER_TEMPLATES: Record<string, string[]> = {
  AGENCY: ["Campaign approval", "Weekly report", "Invoice reminder"],
  ECOMMERCE: ["Order confirmed", "Out for delivery", "Abandoned cart"],
  ECOMMERCE_D2C: ["Order confirmed", "Back in stock", "Abandoned cart"],
  EDUCATION: ["Class reminder", "Fee due", "Results announced"],
  FINTECH_BANKING: ["Payment due", "KYC pending", "Statement ready"],
  HEALTHCARE: ["Appointment reminder", "Report ready", "Follow-up visit"],
  HEALTHCARE_WELLNESS: ["Session reminder", "Membership renewal", "Follow-up visit"],
  MANUFACTURING: ["Order dispatched", "Quote follow-up", "Payment reminder"],
  PRIVATE_BUSINESS_OWNER: ["Welcome message", "Appointment reminder", "Payment reminder"],
  REAL_ESTATE: ["Site visit confirmation", "New listing", "Payment reminder"],
  RETAIL: ["New arrivals", "Order ready for pickup", "Festive offer"],
  SAAS: ["Trial ending", "Renewal reminder", "Feature update"],
  TOURS_AND_TRAVEL: ["Booking confirmed", "Trip reminder", "Payment due"],
  TRADER: ["Price update", "Order confirmed", "Payment reminder"],
  TRAVEL_HOSPITALITY: ["Booking confirmed", "Check-in details", "Feedback request"],
  OTHER: ["Welcome message", "Appointment reminder", "Payment reminder"],
};

export const TEAM_SIZES: SetupOption[] = [
  { value: "JUST_ME", label: "Just me" },
  { value: "SIZE_2_10", label: "2–10" },
  { value: "SIZE_11_50", label: "11–50" },
  { value: "SIZE_50_200", label: "50–200" },
  { value: "SIZE_200_PLUS", label: "200+" },
];

export const MESSAGE_VOLUMES: SetupOption[] = [
  { value: "UNDER_1000", label: "Under 1,000" },
  { value: "FROM_1000_10000", label: "1,000–10,000" },
  { value: "FROM_10000_50000", label: "10,000–50,000" },
  { value: "OVER_50000", label: "50,000+" },
];

export const REFERRAL_SOURCES: SetupOption[] = [
  { value: "GOOGLE_SEARCH", label: "Google search" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "REFERRED_BY_SOMEONE", label: "Friend or colleague" },
  { value: "EVENT_WEBINAR", label: "Event or webinar" },
  { value: "ADS", label: "An ad" },
  { value: "SALES", label: "Our sales team" },
  {
    value: "ALREADY_A_CUSTOMER_ON_A_OTHER_PRODUCT",
    label: "Our other products",
  },
  { value: "OTHER", label: "Other" },
];

// TODO(api): the API has no field for these yet. They are picked in the UI and
// drive the preview, but are not sent with the setup answers.
export const USE_CASES = [
  {
    value: "inbox",
    title: "Reply to customers",
    description: "Handle every incoming chat from one shared inbox.",
  },
  {
    value: "broadcast",
    title: "Send broadcasts",
    description: "Reach whole contact lists as private 1:1 messages.",
  },
  {
    value: "reminders",
    title: "Reminders and follow-ups",
    description: "Renewals, appointments and payment nudges on schedule.",
  },
  {
    value: "team",
    title: "Work as a team",
    description: "Assign chats and leave notes for teammates.",
  },
] as const;

export type UseCaseId = (typeof USE_CASES)[number]["value"];

/** The label for an option value, or "" when it isn't one. */
export const optionLabel = (options: SetupOption[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? "";
