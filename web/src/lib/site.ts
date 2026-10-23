/** The public site: its address and how it describes itself to search engines and social networks. */
export const SITE = {
  url: "https://www.findmydentist.io", // the live address: Vercel redirects the bare domain here
  name: "FindMyDentist",
  short: "FMD",
  tagline: "Find the right dentist, guided by AI",
  description:
    "Find verified dentists and dental clinics near you, compare treatments like implants, braces, aligners, root canal and teeth whitening, and get clear answers from FMD AI - your dental-care guide from first question to follow-up.",
  // search phrases the site answers; they also seed the page titles and descriptions
  keywords: [
    "dentist near me",
    "find a dentist",
    "find my dentist",
    "best dentist",
    "dental clinic near me",
    "verified dentists",
    "book dentist appointment",
    "dental implants",
    "braces",
    "clear aligners",
    "root canal treatment",
    "teeth whitening",
    "teeth cleaning",
    "tooth pain",
    "toothache",
    "wisdom tooth removal",
    "cosmetic dentistry",
    "orthodontist",
    "pediatric dentist",
    "dental care",
    "oral health",
    "dental treatment cost",
    "AI dental assistant",
    "dentist in Bengaluru",
    "dentist in Mumbai",
    "dentist in Delhi",
    "dentist in Kolkata",
    "dentist in Hyderabad",
    "dentist in Chennai",
    "dentist in Pune",
    "FindMyDentist",
    "FMD",
  ],
  // add the profiles once they exist: search engines link them to the brand
  social: [] as string[],
  // fill in from Google Search Console / Bing Webmaster Tools ("HTML tag" verification)
  verification: { google: "", bing: "" },
};
