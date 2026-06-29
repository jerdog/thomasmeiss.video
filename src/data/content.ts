export const site = {
  name: "Thomas Meiss Video",
  domain: "https://thomasmeiss.video",
  tagline: "Freelance video producer",
} as const;

export const navLinks = [
  { label: "Work", href: "#work" },
  { label: "Services", href: "#services" },
  { label: "Channels", href: "#channels" },
  { label: "Pricing", href: "#pricing" },
] as const;

export const trustClients = [
  "Ad agencies",
  "Recording artists",
  "Startups",
  "Couples",
  "Brands",
] as const;

export const projects = [
  {
    id: "documentary",
    title: "Voices of the Valley",
    category: "Documentary",
    aspect: "wide" as const,
    href: "https://vimeo.com/",
    platform: "Vimeo",
  },
  {
    id: "wedding",
    title: "Amelia & James",
    category: "Wedding",
    aspect: "tall" as const,
    href: "https://vimeo.com/",
    platform: "Vimeo",
  },
  {
    id: "commercial",
    title: "Launch Sequence",
    category: "Commercial",
    aspect: "tall" as const,
    href: "https://youtube.com/",
    platform: "YouTube",
  },
  {
    id: "aerial",
    title: "Skyline Sessions",
    category: "Aerial",
    aspect: "wide" as const,
    href: "https://youtube.com/",
    platform: "YouTube",
  },
] as const;

export const services = [
  {
    num: "01",
    title: "Production",
    description:
      "End-to-end project leadership — creative development, scheduling, crew coordination, and on-set direction from first call to final delivery.",
  },
  {
    num: "02",
    title: "Video / Camera",
    description:
      "Cinematic capture on cinema cameras and stabilized rigs. Documentary observational work, polished interviews, and event coverage.",
  },
  {
    num: "03",
    title: "Editing & Post",
    description:
      "Story-driven editing, color grade, sound design, and finishing. Short-form cuts for social or long-form narrative assembly.",
  },
  {
    num: "04",
    title: "Aerial / Drone",
    description:
      "Licensed aerial cinematography for music videos, real estate, events, and documentary establishing sequences.",
  },
] as const;

export const channels = [
  {
    name: "Vimeo",
    films: "142",
    followers: "2.4k",
    href: "https://vimeo.com/",
  },
  {
    name: "YouTube",
    films: "118",
    followers: "8.1k",
    href: "https://youtube.com/",
  },
] as const;

export const stats = [
  { value: "12+", label: "Years" },
  { value: "260", label: "Films" },
  { value: "9", label: "Awards" },
] as const;

export const pricingTiers = [
  {
    name: "Story",
    price: "$2.5k",
    description: "Focused single-day shoot with edit and delivery for social or web.",
    features: ["Half-day shoot", "Basic edit & grade", "1 revision round", "Web-optimized delivery"],
    featured: false,
  },
  {
    name: "Feature",
    price: "$7.5k",
    description: "Full production package for brands, artists, and couples who want cinematic polish.",
    features: ["Full-day production", "Advanced edit & sound", "3 revision rounds", "Multi-format delivery"],
    featured: true,
  },
  {
    name: "Custom Documentary",
    price: "Custom",
    description: "Long-form documentary projects with research, multi-day shoots, and archival integration.",
    features: ["Custom scope", "Multi-day production", "Archival & interviews", "Festival-ready deliverables"],
    featured: false,
  },
] as const;

export const projectTypes = [
  "Documentary",
  "Wedding",
  "Commercial",
  "Aerial",
  "Other",
] as const;

export const socialLinks = [
  { label: "Vimeo", href: "https://vimeo.com/" },
  { label: "YouTube", href: "https://youtube.com/" },
  { label: "Instagram", href: "https://instagram.com/" },
] as const;
