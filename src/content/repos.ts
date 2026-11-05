/**
 * The Work page carousel. Real repositories from github.com/Sayuj63 — names,
 * dates (repo creation) and descriptions come from GitHub. `image` is a
 * screenshot of the live site; entries without one get a generated cover.
 */
export type Category = "Web" | "Commerce" | "AI" | "Tools";

export type Repo = {
  slug: string;
  name: string;
  line: string;
  category: Category;
  type: string;
  scope: string[];
  stack: string[];
  created: string;
  url: string;
  image?: string;
  lang: string;
};

const gh = (r: string) => `https://github.com/Sayuj63/${r}`;

export const REPOS: Repo[] = [
  { slug: "caramel", name: "Caramel Studio", line: "A Mumbai photography studio, shipped end to end", category: "Web", type: "Website", scope: ["UI/UX", "Frontend", "WebGL"], stack: ["Next.js", "Three.js", "GSAP"], created: "06.08.2026", url: "https://caramel-studio-azure.vercel.app", image: "/repos/caramel-studio.jpg", lang: "TypeScript" },
  { slug: "cifra", name: "Cifra", line: "Salary estimates with evidence, not guesses", category: "AI", type: "Product", scope: ["ML", "Backend", "Frontend"], stack: ["FastAPI", "scikit-learn", "Next.js"], created: "29.09.2026", url: "https://cifra-salary.vercel.app", image: "/repos/cifra.jpg", lang: "Python" },
  { slug: "handld", name: "Handld", line: "A change-request portal for Shopify clients", category: "Tools", type: "SaaS", scope: ["Product", "Auth", "Workflows"], stack: ["Next.js", "Better Auth", "Polaris"], created: "15.08.2026", url: "https://changedesk.vercel.app", image: "/repos/handld.jpg", lang: "TypeScript" },
  { slug: "metubez", name: "MeTubez", line: "India's landscape-first video platform", category: "Web", type: "Website", scope: ["UI/UX", "Frontend"], stack: ["Next.js 16", "Tailwind 4"], created: "09.09.2026", url: "https://metubez-website.vercel.app", image: "/repos/metubez.jpg", lang: "TypeScript" },
  { slug: "calvium", name: "Calvium", line: "An apparel storefront with a colourway system", category: "Commerce", type: "Storefront", scope: ["Variant picker", "Catalog pipeline"], stack: ["Shopify", "Liquid", "GraphQL"], created: "28.07.2026", url: "https://calvium.in/", image: "/work/calvium.jpg", lang: "Liquid" },
  { slug: "arrow-arch", name: "Arrow Arch", line: "Aim once. Land once. An editorial landing page", category: "Web", type: "Landing", scope: ["Storytelling", "Motion"], stack: ["Next.js", "GSAP"], created: "27.09.2026", url: "https://arrow-arch-landing.vercel.app", image: "/repos/arrow-arch.jpg", lang: "CSS" },
  { slug: "donna", name: "Donna Voice", line: "A real-time voice agent, shipped in two hours", category: "AI", type: "Agent", scope: ["Voice AI", "Edge"], stack: ["Workers", "Realtime API", "WebRTC"], created: "23.07.2026", url: gh("donna-voice-hermes"), lang: "JavaScript" },
  { slug: "sih", name: "SIH 2026 Portal", line: "Hackathon registration with airtight validation", category: "Tools", type: "Web app", scope: ["Full stack", "Validation"], stack: ["Next.js", "Prisma", "Supabase"], created: "24.08.2026", url: "https://sih-2026-portal.vercel.app", image: "/repos/sih-portal.jpg", lang: "TypeScript" },
  { slug: "seba", name: "Seba Digital", line: "200+ eBay listings migrated into Shopify", category: "Commerce", type: "Storefront", scope: ["Theme", "Scraper", "Automation"], stack: ["Shopify", "Python", "GraphQL"], created: "28.07.2026", url: "https://www.sebadigital.co.uk/", image: "/work/seba-digital.jpg", lang: "Liquid" },
  { slug: "cupid", name: "Cupid Agents", line: "Your AI agent dates other agents for you", category: "AI", type: "Experiment", scope: ["Multi-agent", "Ranking"], stack: ["Python", "LLMs"], created: "30.09.2026", url: gh("cupid-agents"), lang: "Python" },
  { slug: "kaazcha", name: "Kaazcha Trust", line: "Cultural heritage from Keralam, told in motion", category: "Web", type: "Website", scope: ["Brand", "Frontend"], stack: ["React", "Vite", "Convex"], created: "17.08.2026", url: "https://kaazchacharitabletrust-five.vercel.app", image: "/repos/kaazcha.jpg", lang: "TypeScript" },
  { slug: "isoa", name: "ISOA", line: "A live Shopify theme for a DTC wellness brand", category: "Commerce", type: "Storefront", scope: ["PDP", "Design system"], stack: ["Shopify", "Liquid", "Playwright"], created: "28.07.2026", url: gh("ISOA"), lang: "Liquid" },
  { slug: "beratech", name: "Beratech LLP", line: "Engineering consultancy, built to be trusted", category: "Web", type: "Website", scope: ["Frontend", "Content"], stack: ["Next.js", "Tailwind"], created: "16.06.2026", url: "https://beratech-llp.vercel.app", image: "/repos/beratech.jpg", lang: "TypeScript" },
  { slug: "int-store", name: "Int-store", line: "A CLI that localises Shopify stores for new markets", category: "Tools", type: "CLI", scope: ["i18n", "Automation"], stack: ["TypeScript", "Admin GraphQL"], created: "29.06.2026", url: gh("Int-store"), lang: "TypeScript" },
  { slug: "swytch", name: "Swytch", line: "A storefront redesign built for conversion", category: "Commerce", type: "Storefront", scope: ["Redesign", "SEO"], stack: ["HTML", "CSS", "JS"], created: "23.07.2026", url: "https://swytch-revamp.vercel.app", image: "/repos/swytch.jpg", lang: "HTML" },
  { slug: "sim", name: "SIM Platform", line: "Provisioning infra with CI/CD, Terraform and Grafana", category: "Tools", type: "DevOps", scope: ["Infra", "Monitoring"], stack: ["Docker", "Terraform", "Grafana"], created: "21.06.2026", url: gh("SIM-Provisioning-Automation-Platform"), lang: "Python" },
];

export const CATEGORIES: ("All" | Category)[] = ["All", "Web", "Commerce", "AI", "Tools"];

/** Rainbow stops the room cycles through — one step per card hover. */
export const RAINBOW = [12, 28, 46, 150, 190, 215, 255, 285, 320, 345];
