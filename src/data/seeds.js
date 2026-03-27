/** Seed data: signal pool, domain metadata, and sample entities for the prototype. */

export const DOMAINS = [
  "Technology & AI",
  "Climate & Energy",
  "Health & Life Sciences",
  "Government & Policy",
  "Economy & Finance",
  "Education & Learning",
  "Media & Culture",
  "Defence & Security",
  "Custom / Other",
];

export const STEEPLED = [
  "Social",
  "Technological",
  "Economic",
  "Environmental",
  "Political",
  "Legal",
  "Ethical",
  "Demographic",
];

export const DOMAIN_META = [
  { id: "tech",    label: "Technology & AI",       icon: "◎", col: "#185FA5", bg: "#E6F1FB", border: "#B5D4F4" },
  { id: "climate", label: "Climate & Energy",       icon: "◈", col: "#3B6D11", bg: "#EAF3DE", border: "#C0DD97" },
  { id: "health",  label: "Health & Life Sciences", icon: "◉", col: "#0F766E", bg: "#E6FFFA", border: "#5EEAD4" },
  { id: "gov",     label: "Government & Policy",    icon: "◆", col: "#854F0B", bg: "#FAEEDA", border: "#FAC775" },
  { id: "econ",    label: "Economy & Finance",      icon: "◎", col: "#5B21B6", bg: "#F0EAFA", border: "#C4B5FD" },
  { id: "media",   label: "Media & Culture",        icon: "◈", col: "#791F1F", bg: "#FCEBEB", border: "#F7C1C1" },
  { id: "edu",     label: "Education & Learning",   icon: "◉", col: "#185FA5", bg: "#E6F1FB", border: "#B5D4F4" },
  { id: "defence", label: "Defence & Security",     icon: "◆", col: "#666666", bg: "#f9f9f7", border: "rgba(0,0,0,0.09)" },
];

export const SEEDED_SIGNALS_POOL = {
  tech: [
    { id: "s1", name: "EU AI Act enters full enforcement", desc: "High-risk AI systems now face mandatory conformity assessments, reshaping how global AI products are built and deployed.", steepled: ["Political", "Legal"], strength: "High", horizon: "H1", domain: "Technology & AI" },
    { id: "s2", name: "AI agents begin replacing knowledge-worker workflows", desc: "Autonomous AI agents complete multi-step tasks across enterprise systems without human oversight, forcing firms to rethink knowledge-work roles.", steepled: ["Technological", "Social"], strength: "Moderate", horizon: "H1", domain: "Technology & AI" },
    { id: "s3", name: "Chip export controls fracture global AI supply chain", desc: "Tightening semiconductor export restrictions fragment access to frontier AI compute, creating distinct performance tiers between jurisdictions.", steepled: ["Political", "Technological"], strength: "High", horizon: "H2", domain: "Technology & AI" },
  ],
  climate: [
    { id: "s4", name: "IEA confirms solar now cheapest electricity source in history", desc: "Utility-scale solar has undercut all fossil alternatives in levelised cost, accelerating the pace of the energy transition across emerging markets.", steepled: ["Environmental", "Economic"], strength: "High", horizon: "H1", domain: "Climate & Energy" },
    { id: "s5", name: "Methane super-emitter satellites go live globally", desc: "A network of monitoring satellites enables real-time attribution of methane leaks to specific facilities, creating accountability pressure on oil and gas operators.", steepled: ["Environmental", "Technological"], strength: "Moderate", horizon: "H1", domain: "Climate & Energy" },
    { id: "s6", name: "Carbon border adjustment mechanism reshapes trade flows", desc: "The EU's CBAM starts imposing carbon costs on imports from high-emission economies, incentivising export-dependent nations to accelerate decarbonisation.", steepled: ["Political", "Economic"], strength: "Moderate", horizon: "H2", domain: "Climate & Energy" },
  ],
  health: [
    { id: "s7", name: "GLP-1 drugs reshape obesity and metabolic disease treatment", desc: "Widespread adoption of GLP-1 agonists is reducing obesity rates and associated comorbidities at scale, with downstream effects on healthcare utilisation and food consumption patterns.", steepled: ["Social", "Technological"], strength: "High", horizon: "H1", domain: "Health & Life Sciences" },
    { id: "s8", name: "AI diagnostic tools outperform radiologists in early cancer detection", desc: "Multiple clinical trials confirm AI outperforms average radiologists in lung, breast, and skin cancer detection, raising questions about clinical workflow redesign.", steepled: ["Technological", "Social"], strength: "High", horizon: "H1", domain: "Health & Life Sciences" },
    { id: "s9", name: "Longevity biomarker tests reach consumer market", desc: "Direct-to-consumer biological age testing, previously confined to research, enters mass-market pricing, shifting health identity and insurance risk models.", steepled: ["Technological", "Economic"], strength: "Weak", horizon: "H2", domain: "Health & Life Sciences" },
  ],
  gov: [
    { id: "s10", name: "G20 agrees minimum AI safety standards framework", desc: "For the first time, major economies align on a baseline set of AI deployment standards, though enforcement mechanisms remain voluntary.", steepled: ["Political", "Legal"], strength: "Moderate", horizon: "H1", domain: "Government & Policy" },
    { id: "s11", name: "Digital identity frameworks adopted across 14 countries", desc: "Government-issued digital IDs with privacy-preserving credential sharing are becoming the default for public service access, financial onboarding, and voting verification.", steepled: ["Political", "Technological"], strength: "High", horizon: "H2", domain: "Government & Policy" },
    { id: "s12", name: "Sovereign wealth funds pivot to domestic infrastructure mandates", desc: "Several major SWFs are redirecting capital toward national infrastructure and strategic industries under political pressure, blurring the line between public policy and investment.", steepled: ["Political", "Economic"], strength: "Moderate", horizon: "H2", domain: "Government & Policy" },
  ],
  econ: [
    { id: "s13", name: "Remote work normalisation reshapes commercial real estate permanently", desc: "Five years of hybrid work patterns have permanently reduced commercial office demand, triggering repricing and conversion of city-centre commercial stock.", steepled: ["Economic", "Social"], strength: "High", horizon: "H1", domain: "Economy & Finance" },
    { id: "s14", name: "CBDC pilots expand to 30 countries simultaneously", desc: "Central bank digital currencies move beyond pilot status in multiple major economies, with implications for monetary policy transmission and financial inclusion.", steepled: ["Economic", "Political"], strength: "Moderate", horizon: "H2", domain: "Economy & Finance" },
    { id: "s15", name: "Private credit markets surpass traditional bank lending in mid-market", desc: "Non-bank lenders now originate more mid-market debt than traditional banks in the US and UK, representing a structural shift in credit intermediation.", steepled: ["Economic", "Legal"], strength: "High", horizon: "H1", domain: "Economy & Finance" },
  ],
  media: [
    { id: "s16", name: "Synthetic media disclosure laws take effect in EU and California", desc: "Legislation requiring clear labelling of AI-generated content applies to political advertising, news content, and entertainment, creating new compliance requirements.", steepled: ["Legal", "Political"], strength: "Moderate", horizon: "H1", domain: "Media & Culture" },
    { id: "s17", name: "AI-generated music crosses 30% of new streaming releases", desc: "The volume of AI-generated or AI-assisted tracks on major streaming platforms continues to grow, challenging revenue models for human artists and labels.", steepled: ["Technological", "Social"], strength: "Moderate", horizon: "H1", domain: "Media & Culture" },
    { id: "s18", name: "Platform-independent creator economies gain traction", desc: "Decentralised publishing and monetisation tools reduce creators' dependence on algorithmically-controlled platforms, shifting power dynamics in media production.", steepled: ["Social", "Technological"], strength: "Weak", horizon: "H2", domain: "Media & Culture" },
  ],
  edu: [
    { id: "s19", name: "AI tutors demonstrate better outcomes than average classroom instruction", desc: "Multiple large-scale RCTs show AI-powered personalised tutors produce superior learning outcomes to average human instruction in mathematics and reading.", steepled: ["Technological", "Social"], strength: "Moderate", horizon: "H2", domain: "Education & Learning" },
    { id: "s20", name: "University enrolment falls for fourth consecutive year", desc: "Declining demographic cohorts, rising costs, and growing employer acceptance of alternative credentials are driving sustained falls in undergraduate enrolment.", steepled: ["Social", "Economic"], strength: "High", horizon: "H1", domain: "Education & Learning" },
    { id: "s21", name: "Micro-credential frameworks gain employer recognition at scale", desc: "Structured short-form credentials from platforms like Coursera and LinkedIn Learning are now formally recognised in hiring criteria by Fortune 500 employers.", steepled: ["Social", "Economic"], strength: "Moderate", horizon: "H1", domain: "Education & Learning" },
  ],
  defence: [
    { id: "s22", name: "NATO adopts principles for autonomous weapons systems", desc: "The alliance agrees on a common framework governing the deployment of autonomous lethal systems, though distinctions between 'human on the loop' and 'human in the loop' remain contested.", steepled: ["Political", "Legal"], strength: "Moderate", horizon: "H1", domain: "Defence & Security" },
    { id: "s23", name: "Critical infrastructure cyberattacks double year-on-year", desc: "Attacks on energy grids, water systems, and financial infrastructure are accelerating, attributed to state-aligned actors across multiple geopolitical blocs.", steepled: ["Political", "Technological"], strength: "High", horizon: "H1", domain: "Defence & Security" },
    { id: "s24", name: "Space debris creates first commercially significant orbital congestion", desc: "Satellite operators begin voluntarily limiting new deployments in critical orbital bands as collision risk modelling shows cascade probabilities are rising.", steepled: ["Technological", "Legal"], strength: "Weak", horizon: "H2", domain: "Defence & Security" },
  ],
};

/** Default seeded signals shown in Inbox before onboarding is wired up — picks High/Moderate from tech, climate, health. */
export const DEFAULT_SEEDED_INPUTS = [
  { ...SEEDED_SIGNALS_POOL.tech[0],    id: "s1",  is_seeded: true, subtype: "signal", project_id: null, created_at: "2026-01-15", source_confidence: null, metadata: {} },
  { ...SEEDED_SIGNALS_POOL.tech[1],    id: "s2",  is_seeded: true, subtype: "signal", project_id: null, created_at: "2026-01-20", source_confidence: null, metadata: {} },
  { ...SEEDED_SIGNALS_POOL.climate[0], id: "s4",  is_seeded: true, subtype: "signal", project_id: null, created_at: "2026-02-01", source_confidence: null, metadata: {} },
  { ...SEEDED_SIGNALS_POOL.climate[1], id: "s5",  is_seeded: true, subtype: "signal", project_id: null, created_at: "2026-02-10", source_confidence: null, metadata: {} },
  { ...SEEDED_SIGNALS_POOL.health[0],  id: "s7",  is_seeded: true, subtype: "signal", project_id: null, created_at: "2026-02-14", source_confidence: null, metadata: {} },
  { ...SEEDED_SIGNALS_POOL.health[1],  id: "s8",  is_seeded: true, subtype: "signal", project_id: null, created_at: "2026-02-18", source_confidence: null, metadata: {} },
  { ...SEEDED_SIGNALS_POOL.gov[0],     id: "s10", is_seeded: true, subtype: "signal", project_id: null, created_at: "2026-03-01", source_confidence: null, metadata: {} },
];

export const SAMPLE_PROJECTS = [
  {
    id: "p1",
    name: "AI Governance & Trust",
    domain: "Technology & AI",
    question: "How might declining public trust in AI reshape governance frameworks and innovation timelines by 2035?",
    unit: "AI regulatory frameworks and public trust indicators",
    geo: "Global — US, EU, China focus",
    mode: "deep_analysis",
    h1_start: "2025", h1_end: "2028",
    h2_start: "2029", h2_end: "2033",
    h3_start: "2034", h3_end: "2040",
    assumptions: "AI capabilities continue to advance; geopolitical competition over AI persists.",
    stakeholders: "Policy makers, AI labs, civil society organisations",
    created_at: "2026-01-10",
  },
  {
    id: "p2",
    name: "Future of Remote Work",
    domain: "Economy & Finance",
    question: "How will hybrid and remote work patterns reshape organisational structures and urban economies by 2032?",
    unit: "Knowledge-work employment patterns",
    geo: "US, UK, Australia",
    mode: "quick_scan",
    h1_start: "2025", h1_end: "2027",
    h2_start: "2028", h2_end: "2030",
    h3_start: "2031", h3_end: "2035",
    assumptions: "Broadband connectivity remains widely available.",
    stakeholders: "HR leaders, commercial property investors, city planners",
    created_at: "2026-02-05",
  },
];

export const SAMPLE_CLUSTERS = [
  { id: "cl1", name: "Regulatory fragmentation", subtype: "Trend", horizon: "H2", description: "Diverging national AI governance frameworks create compliance complexity and market fragmentation across jurisdictions.", project_id: "p1", input_ids: ["s1", "s3"], likelihood: "Probable", created_at: "2026-01-20" },
  { id: "cl2", name: "Institutional trust erosion", subtype: "Trend", horizon: "H1", description: "Declining public and institutional confidence in AI systems, developers, and oversight bodies.", project_id: "p1", input_ids: ["s2"], likelihood: "Plausible", created_at: "2026-01-25" },
];

export const SAMPLE_SCENARIOS = [
  { id: "sc1", name: "The Governance Chasm", archetype: "Collapse", horizon: "H2", narrative: "Fragmented regulation and collapsing public trust create a two-speed world.", cluster_ids: ["cl1", "cl2"], project_id: "p1", created_at: "2026-02-10" },
];

export const SAMPLE_CANVAS_NODES = [
  { id: "cn1", projectId: "p1", clusterId: "cl1", x: 160, y: 130 },
  { id: "cn2", projectId: "p1", clusterId: "cl2", x: 460, y: 270 },
];

export const SAMPLE_RELATIONSHIPS = [
  {
    id: "rel1",
    projectId: "p1",
    fromClusterId: "cl1",
    toClusterId: "cl2",
    type: "Drives",
    evidence: "Regulatory complexity undermines public confidence in AI governance bodies.",
    confidence: "High",
    created_at: "2026-02-15",
  },
];
