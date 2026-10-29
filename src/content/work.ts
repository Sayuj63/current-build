/**
 * Real work only. Images are screenshots of the live storefronts, captured
 * from their public URLs. No dates are listed because none are on record.
 */
export type Project = {
  slug: string;
  name: string;
  url: string;
  tags: string[];
  type: string;
  scope: string[];
  stack: string[];
};

export const PROJECTS: Project[] = [
  {
    slug: "almost-always",
    name: "Almost Always",
    url: "https://almostalways.in/",
    tags: ["Shopify", "Frontend", "UX"],
    type: "Storefront",
    scope: ["Cross-SKU swatches", "PDP + collection"],
    stack: ["Shopify", "Liquid", "JS"],
  },
  {
    slug: "calvium",
    name: "Calvium",
    url: "https://calvium.in/",
    tags: ["Shopify", "Frontend", "Commerce"],
    type: "Storefront",
    scope: ["Variant resolver", "Lookbook"],
    stack: ["Shopify", "Liquid", "JS"],
  },
  {
    slug: "curated-collective",
    name: "The Curated Collective",
    url: "https://thecuratedcollective.in/",
    tags: ["Shopify", "Data", "Automation"],
    type: "Marketplace",
    scope: ["Brand import pipeline", "Admin API tooling"],
    stack: ["Shopify", "Python", "Node"],
  },
  {
    slug: "adore-nails",
    name: "Adore Nails",
    url: "https://adorenails.co.in/",
    tags: ["Shopify", "UI/UX", "Frontend"],
    type: "Storefront",
    scope: ["PDP size finder", "Gallery + FAQ"],
    stack: ["Shopify", "Liquid", "JS"],
  },
  {
    slug: "seba-digital",
    name: "Seba Digital",
    url: "https://www.sebadigital.co.uk/",
    tags: ["Shopify", "Automation", "Backend"],
    type: "Storefront",
    scope: ["Dawn fork", "eBay → Shopify pipeline"],
    stack: ["Shopify", "Python", "GraphQL"],
  },
  {
    slug: "aeqea",
    name: "AEQEA",
    url: "https://www.aeqeaa.com/",
    tags: ["Shopify", "Frontend", "Mobile"],
    type: "Storefront",
    scope: ["Horizon theme", "Mobile navigation"],
    stack: ["Shopify", "Liquid", "CSS"],
  },
  {
    slug: "apurvi",
    name: "Apurvi Industries",
    url: "https://apurviind.com/",
    tags: ["SEO", "Content", "Growth"],
    type: "Website",
    scope: ["International SEO", "US + UK"],
    stack: ["Web", "Search Console"],
  },
];

export const SERVICES = [
  "Shopify Theme Architecture",
  "Headless Storefronts",
  "Marketing Websites",
  "Landing Pages & Launches",
  "Web Applications",
  "E-commerce Platforms",
  "Data Pipelines & Automation",
  "Quant Research Tooling",
  "AI-Driven Interfaces",
  "Custom Motion & Animation",
  "3D & Interactive Experiences",
  "Performance & SEO",
];

/** Toolkit groups. `glyph` is what the 3D badge shows for the group. */
export const TOOLKIT: { group: string; glyph: string; items: [string, string][] }[] = [
  {
    group: "Commerce",
    glyph: "$",
    items: [
      ["Shopify theme architecture", "LIQUID"],
      ["Sections, blocks & metafields", "OS 2.0"],
      ["Variant & swatch systems", "JS"],
      ["Catalogue import pipelines", "ADMIN API"],
      ["Storefront performance", "CWV"],
    ],
  },
  {
    group: "Frontend",
    glyph: "</>",
    items: [
      ["Next.js & React", "TS"],
      ["Design systems & tokens", "CSS"],
      ["Scroll & motion choreography", "GSAP"],
      ["Accessible, responsive UI", "A11Y"],
    ],
  },
  {
    group: "3D & Motion",
    glyph: "3D",
    items: [
      ["Three.js & React Three Fiber", "WEBGL"],
      ["Custom GLSL shaders", "GLSL"],
      ["Post-processing & particles", "GPU"],
    ],
  },
  {
    group: "Data & Automation",
    glyph: "{ }",
    items: [
      ["Scrapers & ETL pipelines", "PYTHON"],
      ["REST & GraphQL integrations", "NODE"],
      ["Bulk store tooling", "CLI"],
    ],
  },
  {
    group: "AI & Quant",
    glyph: "AI",
    items: [
      ["LLM-powered features", "API"],
      ["Alpha research pipelines", "BRAIN"],
      ["Prompt & eval workflows", "LLM"],
    ],
  },
  {
    group: "Ops",
    glyph: "~",
    items: [
      ["Docker & CI/CD", "DEVOPS"],
      ["AWS & Vercel deploys", "CLOUD"],
    ],
  },
];

/** Contact details. Empty values are simply not rendered. */
export const CONTACT = {
  email: "",
  location: "India",
  social: [
    ["GitHub", "https://github.com/Sayuj63"],
    ["LinkedIn", ""],
  ] as [string, string][],
};
