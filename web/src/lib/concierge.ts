/** FMD Edge form options; shared by the config route (feeds the form) and the enquiries route (validates it). */
export const CONCIERGE = {
  serviceAreas: [] as string[],
  responseCommitment: null as string | null,
  fees: "",
  needs: [
    "Find a specialist",
    "Book an appointment",
    "Second opinion",
    "Treatment cost guidance",
    "Orthodontics (braces / aligners)",
    "Dental implants",
    "Emergency follow-up",
    "Something else",
  ],
  timings: ["Today", "This week", "Next week", "Flexible"],
  contactMethods: ["phone", "whatsapp", "email"] as ("phone" | "whatsapp" | "email")[],
};
