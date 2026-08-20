/**
 * Real material.
 *
 * The visual treatment is allowed to be surreal; the evidence is not. Every
 * string in this file refers to work that exists — real merchant stores, real
 * platform mechanics, real defects and real fixes. Nothing here is lorem, and
 * nothing here is a claim that could not be checked.
 *
 * Laws pull from this file to label their geometry, which is what stops the
 * world from being an abstract particle demo: the lattice in ASSEMBLY is
 * annotated with the actual stages of the actual process, and the production
 * line in COMMERCE carries the actual pipeline.
 *
 * SET BEFORE SHIPPING — these are the only two placeholders in the codebase.
 */
export const IDENTITY = {
  name: 'SAYUJ PILLAI',
  github: 'https://github.com/Sayuj63',
  linkedin: '', // e.g. https://www.linkedin.com/in/…
  email: '', // e.g. you@domain.com
};

/**
 * Storefront systems. Real stores, real theme architecture.
 *
 * Fill `url` in with the live storefront (or a staging/case-study link) to
 * light that entry up as a clickable link in the Projects section of the
 * accessible document. Leaving it empty falls back to plain text so a private
 * or unpublished store never breaks the render.
 */
export const COMMERCE_WORK = [
  { name: 'ISOA', note: 'PDP rebuild, pill rail, section gap system', url: '' },
  { name: 'ALMOST ALWAYS', note: 'cross-SKU colour swatches, PDP + collection', url: '' },
  { name: 'RADIANT & KEEN', note: 'theme architecture', url: '' },
  { name: 'THE CURATED COLLECTIVE', note: 'brand import pipeline, 258 rows', url: '' },
  { name: 'ADORE NAILS', note: 'PDP size finder, gallery, FAQ', url: '' },
  { name: 'CALVIUM', note: 'variant resolver, lookbook', url: '' },
  { name: 'AEQEA', note: 'Horizon subgrid, mobile nav', url: '' },
  { name: 'SEBA DIGITAL', note: 'Dawn fork, eBay → Shopify pipeline', url: '' },
  { name: 'APURVI', note: 'international SEO, US + UK', url: '' },
];

/**
 * Named non-commerce projects. Same rule as COMMERCE_WORK: set `url` to
 * publish the link; leave empty for private/in-progress systems.
 */
export const NAMED_PROJECTS = [
  { name: 'FLIQAI', note: 'onboarding, university & mentor discovery, essay build, admit chance', url: '' },
  { name: 'ON-CHAIN DOCUMENT ANCHOR', note: 'SHA-256 digest, tamper-evident audit trail', url: '' },
  { name: 'WORLDQUANT BRAIN PIPELINE', note: 'autonomous alpha generation, simulate, poll, submit', url: '' },
  { name: 'KNOWLEDGE SUBSTRATE', note: 'unstructured sources → queryable structure', url: '' },
  { name: 'HACKATHON CLUB', note: '500+ members, workshops, ship-or-die reviews', url: '' },
];

/**
 * The commerce pipeline, made physical in MOVEMENT 03. Each stage carries the
 * engineering that actually lives there rather than a generic label.
 */
export const PIPELINE = [
  { stage: 'PRODUCT', detail: 'schema + metafields' },
  { stage: 'VARIANT', detail: 'option resolver' },
  { stage: 'SELECTION', detail: 'swatch → variant id' },
  { stage: 'CART', detail: 'AJAX, optimistic' },
  { stage: 'CHECKOUT', detail: 'handoff' },
  { stage: 'DATA', detail: 'order → analytics' },
];

/**
 * A real defect and its real fix. Used verbatim in COMMERCE, because a portfolio
 * that only shows finished surfaces is not showing engineering.
 */
export const DEFECT = {
  symptom: 'PICKER UPDATED · CART DID NOT',
  cause: 'VISIBLE STATE AND SUBMITTED ID COULD DIVERGE',
  fix: 'RESOLVE VARIANT FROM OPTIONS — REMOVE THE SECOND SOURCE OF TRUTH',
};

/** The build sequence that repeats across every domain. MOVEMENT 02. */
export const PROCESS = [
  'DISCOVERY',
  'SPECIFICATION',
  'ARCHITECTURE',
  'IMPLEMENTATION',
  'DEPLOYMENT',
  'SUPPORT',
];

/** Signal laboratory. MOVEMENT 06. Real platform vocabulary. */
export const ALPHA = {
  platform: 'WORLDQUANT BRAIN',
  stages: ['GENERATE', 'SIMULATE', 'POLL', 'SCORE', 'GATE', 'SUBMIT'],
  metrics: ['SHARPE', 'FITNESS', 'TURNOVER', 'DRAWDOWN', 'IC', 'MARGIN'],
  verdicts: ['REJECT', 'REJECT', 'REJECT', 'REJECT', 'HOLD', 'ACCEPT'],
  operators: [
    'ts_rank',
    'ts_regression',
    'group_neutralize',
    'winsorize',
    'ts_delta',
    'vec_avg',
    'ts_zscore',
    'rank',
    'ts_corr',
    'trade_when',
  ],
};

/** Verification. MOVEMENT 05. */
export const TRUST_WORK = {
  title: 'ON-CHAIN DOCUMENT ANCHOR',
  steps: ['FILE', 'CHUNK', 'DIGEST', 'COMMIT', 'VERIFY'],
  claim: 'TAMPER-EVIDENT WITHOUT TRUSTING THE STORE',
  algo: 'SHA-256',
};

/** Decision systems. MOVEMENT 04. */
export const INTEL_WORK = {
  title: 'FLIQAI',
  facets: ['ONBOARDING', 'UNIVERSITY DISCOVERY', 'MENTOR MATCH', 'ESSAY BUILD', 'ADMIT CHANCE'],
  claim: 'A ROUTE THROUGH COMPLEXITY — NOT MORE COMPLEXITY',
};

/** Teaching and community. MOVEMENT 07. */
export const PEOPLE_WORK = {
  title: 'HACKATHON CLUB',
  scale: '500+ MEMBERS',
  claim: 'THE METRIC IS WHETHER THEY SHIPPED',
  roles: ['WORKSHOP', 'MENTOR', 'REVIEW', 'SHIP'],
};

/** Current state. MOVEMENT 09 / 10. */
export const CURRENT_WORK = [
  { name: 'STOREFRONT SYSTEMS', state: 'RUNNING' },
  { name: 'ALPHA PIPELINE', state: 'RUNNING' },
  { name: 'KNOWLEDGE SUBSTRATE', state: 'BUILDING' },
  { name: 'THIS PAGE', state: 'BUILDING' },
];

/**
 * Fragment material for MOVEMENT 01. Deliberately heterogeneous — geometry,
 * real code, real file paths, real diagnostics — because the point of CHAOS is
 * breadth, and breadth means the fragments should not match each other.
 */
export const FRAGMENTS = {
  code: [
    'variant = resolveVariant(options)',
    'for i in range(N): submit(alpha[i])',
    'sha256(buffer).digest()',
    '{%- render "product-card" -%}',
    'group_neutralize(rank(x), sector)',
    'cart.change({ id, quantity })',
    'await poll(simulationId)',
    'ts_regression(close, volume, 20)',
    'section.settings.color_scheme',
    'CREATE INDEX ON orders (created_at)',
    'docker compose up --build',
    'if sync < 0.4: state = "desynced"',
  ],
  paths: [
    'snippets/product-variant-picker.liquid',
    'assets/aa-colour-swatches.js',
    'src/antim_env/rewards.py',
    'sections/main-product.liquid',
    'scripts/ebay_to_shopify/build.py',
    'layout/theme.liquid',
    'research/FINAL_SCHEMA.md',
  ],
  diagnostics: [
    'LCP 1.24s',
    '258 ROWS IMPORTED',
    'SHARPE 1.31',
    '0 CLS',
    'TURNOVER 41%',
    '500+ MEMBERS',
    '34 SKU',
    'FITNESS 1.04',
    'DIGEST MATCH',
    'RATE LIMIT 429 → BACKOFF',
  ],
  domains: [
    'COMMERCE',
    'QUANT',
    'VERIFY',
    'DEVOPS',
    'GRAPH',
    'CLI',
    'CRM',
    'SEO',
    'THEME',
    'PIPELINE',
  ],
};

/** MOVEMENT 08. What actually goes wrong. Honest, not performative. */
export const FAILURES = [
  'ABANDONED MID-ARCHITECTURE',
  'SHIPPED, THEN REPLACED',
  'WRONG VARIANT IN CART',
  'RATE LIMIT UNHANDLED',
  'SCOPE WITHOUT AN OWNER',
  'UNRESOLVED',
];

/**
 * The reveal in MOVEMENT 09: the projects were never separate interests.
 * These are the shared behaviours underneath every one of them.
 */
export const CONVERGENCE = [
  'AMBIGUOUS INPUT',
  'FIND THE REAL STRUCTURE',
  'MAKE IT EXECUTABLE',
  'MAKE IT MAINTAINABLE',
];

/** Closing state sequence. MOVEMENT 10. */
export const ENDING = ['CURRENT STATE', 'UNDEFINED', 'BUILD CONTINUES'];

/**
 * One line per movement, shown on the glass as the movement opens.
 *
 * ORIGIN is deliberately absent. That movement's whole job is curiosity, and a
 * caption would answer the question it is trying to provoke — so the first
 * chapter card in the film is the one for CHAOS.
 */
export const MOVEMENT_LINES = {
  chaos: 'BREADTH FIRST. MOST OF IT WENT NOWHERE.',
  assembly: 'THE SAME SEQUENCE, EVERY TIME.',
  commerce: 'PRODUCTION ENGINEERING, NOT A PORTFOLIO SHOT.',
  intelligence: 'A ROUTE THROUGH IT — NOT MORE OF IT.',
  trust: 'DO NOT TRUST THIS PAGE. CHECK IT.',
  autonomy: 'IT KEEPS WORKING WHILE I SLEEP.',
  people: 'ONE SYSTEM BECOMES MANY.',
  failure: 'NOT EVERYTHING SURVIVED.',
  rebuild: 'IT WAS ALWAYS ONE BEHAVIOUR.',
  current: 'STILL RUNNING.',
  unknown: 'UNDEFINED ON PURPOSE.',
  terminus: 'THIS ONE IS YOURS.',
};
