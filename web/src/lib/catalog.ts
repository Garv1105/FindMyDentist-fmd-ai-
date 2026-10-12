/** Reference lists shared by the client UI and the server. Not demo data — controlled vocabularies. */
export const SPECIALTIES = [
  "General Dentist",
  "Orthodontist",
  "Implantologist",
  "Periodontist",
  "Endodontist",
  "Cosmetic Dentist",
  "Pediatric Dentist",
  "Oral Surgeon",
  "Prosthodontist",
] as const;

export const SERVICES = [
  "Consultation",
  "Teeth Cleaning",
  "Fillings",
  "Root Canal Treatment",
  "Braces",
  "Clear Aligners",
  "Dental Implants",
  "Extraction",
  "Crowns & Bridges",
  "Dentures",
  "Gum Treatment",
  "Teeth Whitening",
  "Veneers",
  "Smile Design",
  "Kids Dentistry",
] as const;

export const LANGUAGES = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Malayalam", "Marathi"] as const;

export const CITIES = ["Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune"] as const;

export const TOPICS = ["Prevention", "Orthodontics", "Implants", "Gum health", "Kids", "Cosmetic", "Root canal", "Oral surgery"] as const;

/** Report categories (Annex C1). */
export const REPORT_CATEGORIES = {
  misinformation: "Health misinformation",
  misleading_claims: "Misleading claims or guarantees",
  privacy_consent: "Privacy or patient consent",
  harassment: "Harassment or abuse",
  spam: "Spam or scam",
  copyright: "Copyright",
  inappropriate: "Inappropriate content",
} as const;
