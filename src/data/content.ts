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

export const showreel = {
  title: "Showreel",
  vimeoId: "1127965932" as string | null,
} as const;

export const trustClients = [
  "Big 12 Basketball",
  "Football",
  "Softball",
  "Tennis",
  "Rowing",
  "Volleyball",
] as const;

// Selected Work — 4 Vimeo reels shown as inline click-to-play facades.
// Drop each real Vimeo ID into vimeoId (one line each); null shows "Coming soon".
export const projects = [
  {
    id: "basketball",
    title: "Allen Fieldhouse Nights",
    category: "Basketball",
    aspect: "wide" as const,
    vimeoId: null as string | null,
  },
  {
    id: "football",
    title: "Gameday: Kansas Football",
    category: "Football",
    aspect: "tall" as const,
    vimeoId: null as string | null,
  },
  {
    id: "olympic",
    title: "Rowing at Dawn",
    category: "Olympic Sports",
    aspect: "tall" as const,
    vimeoId: null as string | null,
  },
  {
    id: "hype",
    title: "Season Hype Reel",
    category: "Hype Reel",
    aspect: "wide" as const,
    vimeoId: null as string | null,
  },
] as const;

export const services = [
  {
    num: "01",
    title: "Production",
    description:
      "End-to-end production for game-day and feature content — shot planning, multi-camera capture, and fast-turnaround delivery under tight deadlines.",
  },
  {
    num: "02",
    title: "Cinematography",
    description:
      "Cinematic capture on Sony Cinema Line cameras (FX6, FS7, a7S III), with lighting and multi-angle coverage for live sports, interviews, and features.",
  },
  {
    num: "03",
    title: "Editing & Post",
    description:
      "Story-driven editing, color grade, and sound in Adobe Premiere Pro and After Effects — highlight reels, hype videos, and social cutdowns.",
  },
  {
    num: "04",
    title: "Social Content",
    description:
      "Platform-ready content for Instagram, X, and Facebook, aligned to marketing campaigns and built to engage audiences of 60k+.",
  },
] as const;

// Followers / film counts below are placeholders — replace with real numbers.
export const channels = [
  {
    name: "Vimeo",
    films: "40+",
    followers: "1.2k",
    href: "https://vimeo.com/thomasmeiss",
  },
  {
    name: "YouTube",
    films: "25+",
    followers: "800",
    href: "https://youtube.com/",
  },
] as const;

export const stats = [
  { value: "3+", label: "Years" },
  { value: "63k", label: "Audience" },
  { value: "6", label: "Sports" },
] as const;

export const pricingTiers = [
  {
    name: "Game Day",
    price: "$750",
    description: "Single-game or event coverage with a fast-turnaround highlight edit built for social.",
    features: ["Multi-angle capture", "Same-week highlight edit", "Color & sound", "Social-ready formats"],
    featured: false,
  },
  {
    name: "Highlight Reel",
    price: "$2k",
    description: "A cinematic athlete or team reel built from multiple shoots across a season.",
    features: ["Multi-shoot production", "Story-driven edit", "Motion graphics", "Multi-platform delivery"],
    featured: true,
  },
  {
    name: "Full Season",
    price: "Custom",
    description: "Season-long content partnership — recurring game coverage, hype videos, and social cutdowns.",
    features: ["Recurring coverage", "Highlight & hype reels", "Campaign-aligned content", "Priority scheduling"],
    featured: false,
  },
] as const;

export const projectTypes = [
  "Game Coverage",
  "Highlight Reel",
  "Hype Video",
  "Social Content",
  "Other",
] as const;

export const socialLinks = [
  { label: "Vimeo", href: "https://vimeo.com/thomasmeiss" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/thomas-meiss" },
  { label: "Email", href: "mailto:thomasmeiss.21@gmail.com" },
] as const;
