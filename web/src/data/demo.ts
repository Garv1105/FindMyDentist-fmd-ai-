/**
 * PROTOTYPE DEMO DATA — NOT REAL PEOPLE OR CLINICS.
 * Names, ratings, portraits, locations and availability below are placeholders
 * for design review only. No individual or clinic here has been verified by FMD.
 */

export const IS_DEMO_DATA = true;

export type Dentist = {
  id: string;
  name: string;
  specialty: string;
  photo: string;
  rating: number;
  reviews: number;
  area: string;
  distanceKm: number;
  services: string[];
  languages: string[];
  /** null = no connected scheduling source → availability must be confirmed */
  nextSlot: string | null;
  availableToday: boolean;
  verified: boolean;
  sponsored: boolean;
  experienceYears: number;
  qualifications: string[];
  clinic: string;
  hours: string;
  fee: string;
};

export const DENTISTS: Dentist[] = [
  {
    id: "d1",
    name: "Dr. Aditi Sharma",
    specialty: "General Dentist",
    photo: "/img/dr-1.png",
    rating: 4.9,
    reviews: 320,
    area: "Koramangala",
    distanceKm: 1.2,
    services: ["Preventive Care", "Cosmetic"],
    languages: ["English", "Hindi", "Kannada"],
    nextSlot: "Today, 5:30 PM",
    availableToday: true,
    verified: true,
    sponsored: false,
    experienceYears: 11,
    qualifications: ["BDS", "MDS (Conservative Dentistry)"],
    clinic: "Demo Dental Studio, Koramangala",
    hours: "Mon–Sat · 10:00–19:30",
    fee: "₹500 consultation (demo)",
  },
  {
    id: "d2",
    name: "Dr. Rohan Mehta",
    specialty: "Orthodontist",
    photo: "/img/dr-2.png",
    rating: 4.8,
    reviews: 210,
    area: "HSR Layout",
    distanceKm: 2.4,
    services: ["Braces", "Aligners"],
    languages: ["English", "Hindi"],
    nextSlot: "Tomorrow, 10:00 AM",
    availableToday: false,
    verified: true,
    sponsored: true,
    experienceYears: 9,
    qualifications: ["BDS", "MDS (Orthodontics)"],
    clinic: "Demo Ortho Care, HSR Layout",
    hours: "Mon–Fri · 09:30–18:00",
    fee: "₹700 consultation (demo)",
  },
  {
    id: "d3",
    name: "Dr. Sneha Iyer",
    specialty: "Implantologist",
    photo: "/img/dr-3.png",
    rating: 4.9,
    reviews: 185,
    area: "Jayanagar",
    distanceKm: 3.1,
    services: ["Dental Implants", "Oral Surgery"],
    languages: ["English", "Tamil", "Kannada"],
    nextSlot: "Today, 6:00 PM",
    availableToday: true,
    verified: true,
    sponsored: false,
    experienceYears: 14,
    qualifications: ["BDS", "MDS (Prosthodontics)", "Fellowship in Implantology"],
    clinic: "Demo Implant Centre, Jayanagar",
    hours: "Tue–Sun · 10:00–20:00",
    fee: "₹800 consultation (demo)",
  },
  {
    id: "d4",
    name: "Dr. Karan Malhotra",
    specialty: "Cosmetic Dentist",
    photo: "/img/dr-4.png",
    rating: 4.7,
    reviews: 142,
    area: "Indiranagar",
    distanceKm: 2.8,
    services: ["Smile Design", "Veneers"],
    languages: ["English", "Hindi", "Telugu"],
    nextSlot: null,
    availableToday: false,
    verified: false,
    sponsored: false,
    experienceYears: 7,
    qualifications: ["BDS", "Certificate in Aesthetic Dentistry"],
    clinic: "Demo Smile Lounge, Indiranagar",
    hours: "Mon–Sat · 11:00–20:00",
    fee: "Fee confirmed by clinic",
  },
];

export const SPECIALTIES = [
  "General Dentist",
  "Orthodontist",
  "Implantologist",
  "Periodontist",
  "Endodontist",
  "Cosmetic Dentist",
  "Pediatric Dentist",
  "Oral Surgeon",
  "Teeth Cleaning",
];

export const CITIES = ["Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Chennai", "Pune"];

export const TREATMENTS = [
  { title: "Teeth Cleaning", blurb: "Keep your smile healthy", img: "/img/tx-cleaning.png", meta: "30–45 min" },
  { title: "Braces & Aligners", blurb: "Straighten your smile", img: "/img/tx-aligners.png", meta: "6–24 months" },
  { title: "Dental Implants", blurb: "Replace missing teeth", img: "/img/tx-implants.png", meta: "Staged treatment" },
  { title: "Teeth Whitening", blurb: "Brighter, confident smile", img: "/img/tx-whitening.png", meta: "1–2 visits" },
];
