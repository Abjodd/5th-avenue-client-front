/* Long-form copy for each service's own page (/services/<slug>).
   One entry per service in services.ts, keyed by slug. Used by the page
   component AND by the build-time prerender in src/seo/site.js, so search
   engines get the full text without running JavaScript.

   House rules for this file: no invented numbers, client names, prices or
   guarantees. Claims stay to what the agency and its dashboard actually do. */

export interface ServicePageCopy {
  /** <title>: lead with the search phrase, under ~60 characters */
  seoTitle: string;
  /** meta description, ~140–160 characters */
  description: string;
  /** the page's h1 — the phrase people search for */
  h1: string;
  /** one-sentence lede under the h1 */
  lede: string;
  /** 2 short paragraphs: what it is and why it matters now */
  overview: string[];
  included: { title: string; body: string }[];
  process: { title: string; body: string }[];
  why: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  /** slugs of related services */
  related: string[];
}

/* Shared "why us" points, reused where they're the honest answer. */
const WHY = {
  dashboard: {
    title: "One live dashboard",
    body: "Every campaign sits on the same client dashboard as the rest of your marketing — status, reach, engagement and spend in live numbers, not a monthly deck.",
  },
  oneTeam: {
    title: "One accountable team",
    body: "Influencer, search, paid and content work are run by one team toward one goal, so nothing gets lost between agencies or reported in isolation.",
  },
  regional: {
    title: "A regional creator network",
    body: "Creators in every Indian state across 30+ languages, matched by region, niche and audience — so campaigns can speak the language your market actually speaks.",
  },
  goals: {
    title: "Tied to a business goal",
    body: "Every piece of work is tagged to a goal you set, so you can see what each service contributes instead of judging it on its own vanity metrics.",
  },
  approvals: {
    title: "Approvals in the open",
    body: "Briefs, creator shortlists and deliverables are signed off on the dashboard, with a clear record of who approved what and when.",
  },
};

export const SERVICE_PAGES: Record<string, ServicePageCopy> = {
  /* ── Growth ─────────────────────────────────────────────────────────── */
  "influencer-marketing": {
    seoTitle: "Influencer Marketing Agency in India | Fifth Avenue",
    description:
      "Influencer marketing in India, from nano creators to celebrities — matched to your audience, briefed, approved and tracked live on one dashboard by Fifth Avenue.",
    h1: "Influencer marketing agency in India",
    lede: "Creator campaigns matched to your audience — from nano to celebrity — briefed, approved and tracked in one place.",
    overview: [
      "Influencer marketing works when the right creator says the right thing to the right audience, and you can see what it returned. Most brands get the first part from an agency and the second from a spreadsheet weeks later.",
      "Fifth Avenue runs influencer campaigns end to end: strategy, creator matching, briefs, negotiation, content approvals, publishing and reporting. Every step lives on your client dashboard, so you see shortlists, sign off content and watch reach and engagement as they happen.",
    ],
    included: [
      { title: "Creator matching", body: "Shortlists built around your audience, not follower counts — by niche, size, region, language and past engagement. You approve every creator before anything is locked." },
      { title: "Briefs and content approvals", body: "A clear brief per creator, with drafts reviewed and approved on the dashboard before they go live. No approvals lost in WhatsApp threads." },
      { title: "Negotiation, contracts and payouts", body: "Fees, deliverables, usage rights and timelines agreed up front, and creator payments handled for you with itemised invoices." },
      { title: "Live tracking and reporting", body: "Views, likes, comments and engagement rate pulled from every post, rolled up by creator, niche and region, with insights on what to scale or pause." },
    ],
    process: [
      { title: "Brief", body: "We agree the goal, audience, budget and the message that has to land." },
      { title: "Shortlist", body: "You get a creator shortlist with profiles and reasoning, and approve or pass on each one." },
      { title: "Produce", body: "Creators make the content to the brief; you approve drafts before they publish." },
      { title: "Go live and report", body: "Posts go live on schedule and performance reports itself on the dashboard." },
    ],
    why: [WHY.regional, WHY.approvals, WHY.dashboard],
    faqs: [
      { q: "What does an influencer marketing agency do?", a: "It plans the campaign, finds and vets creators, writes the briefs, negotiates fees and usage rights, manages content approvals and publishing, pays creators and reports results. Fifth Avenue does all of this and puts each step on a live client dashboard." },
      { q: "How much does influencer marketing cost in India?", a: "It depends on the creators' size and niche, the number and type of deliverables, and how long you want to use the content. We scope every campaign from your goal and budget and show the plan before anything is committed." },
      { q: "Do you work with micro and nano influencers?", a: "Yes. Smaller creators often have the most engaged and most local audiences, which is why our network includes creators of every size across every Indian state." },
      { q: "Can we approve creators and content before they go live?", a: "Always. You approve the creator shortlist and each piece of content on the dashboard before anything is published." },
      { q: "How do you measure influencer campaign results?", a: "Reach, views, engagement and cost are tracked per post and rolled up by creator, niche and region, alongside the business goal the campaign was set up to move." },
    ],
    related: ["creator-campaign-management", "content-creation", "social-media-management"],
  },

  "performance-marketing": {
    seoTitle: "Performance Marketing Agency in India | Fifth Avenue",
    description:
      "Performance marketing that answers to revenue: Meta, Google and programmatic campaigns planned to a cost-per-acquisition goal and reported on one live dashboard.",
    h1: "Performance marketing agency in India",
    lede: "Paid media that answers to revenue, not impressions — Meta, Google and programmatic under one ledger.",
    overview: [
      "Performance marketing is paid advertising judged by what it brings back: leads, sales, installs, sign-ups. It only works if budget moves quickly toward what is working and away from what isn't.",
      "Fifth Avenue plans and runs paid campaigns across Meta, Google and programmatic channels against a clear cost-per-acquisition goal. Spend and results sit on the same dashboard as your influencer and content work, so you can see how paid and organic push each other.",
    ],
    included: [
      { title: "Channel and audience planning", body: "Where to spend first and why — channel mix, audiences and budgets set from your goal and your margins." },
      { title: "Campaign build and creative testing", body: "Structured campaigns with creative variants tested deliberately, so winners are found on evidence rather than guesswork." },
      { title: "Tracking and attribution", body: "Conversion tracking set up and checked before launch, so every rupee can be traced to an outcome." },
      { title: "Optimisation and reporting", body: "Bids, budgets and creative adjusted continuously, with spend, cost per result and return reported live." },
    ],
    process: [
      { title: "Audit", body: "We review your current accounts, tracking and what has worked before." },
      { title: "Plan", body: "Channel mix, audiences, creative and a cost-per-acquisition target." },
      { title: "Launch and test", body: "Campaigns go live with structured tests on audiences and creative." },
      { title: "Scale", body: "Budget shifts to what performs; weekly learnings on the dashboard." },
    ],
    why: [WHY.goals, WHY.dashboard, WHY.oneTeam],
    faqs: [
      { q: "What is performance marketing?", a: "Paid advertising measured by actions — sales, leads, installs — rather than impressions. You pay for media and judge it by the cost of each result." },
      { q: "Which channels do you run?", a: "Meta (Facebook and Instagram), Google (Search, YouTube, Performance Max and Display) and programmatic display, chosen by where your customers are." },
      { q: "Can you use influencer content in ads?", a: "Yes, where usage rights allow. Creator content often makes strong ad creative, and because both run through us the rights are agreed up front." },
      { q: "How quickly will we see results?", a: "Campaigns produce data from the first days; the first weeks are about learning which audiences and creatives convert, then budget is concentrated on them." },
    ],
    related: ["analytics-reporting", "marketing-strategy", "website-design-development"],
  },

  seo: {
    seoTitle: "SEO Services in India — Technical & Content SEO | Fifth Avenue",
    description:
      "SEO services that compound: technical audits, site architecture, content and authority building, with rankings and organic traffic tracked on one live dashboard.",
    h1: "SEO services in India",
    lede: "Technical and editorial search work that compounds — architecture, content and authority.",
    overview: [
      "Search engine optimisation is how people find you when they are already looking. Unlike paid media, the work keeps paying back after it is done — which is why it rewards doing it properly from the start.",
      "Fifth Avenue's SEO covers the technical foundation (how search engines crawl and understand your site), the content that answers what your customers search for, and the authority signals that earn rankings. Progress is tracked on your dashboard next to the rest of your marketing.",
    ],
    included: [
      { title: "Technical audit and fixes", body: "Crawlability, indexing, page speed, site structure, structured data and the errors that quietly hold rankings back." },
      { title: "Keyword and content strategy", body: "The searches that matter for your business, mapped to pages that should exist — and briefs for the ones that don't yet." },
      { title: "Content operations", body: "Pages and articles written, edited and published on a steady cadence, built to answer the query better than what currently ranks." },
      { title: "Authority building", body: "Earning mentions and links from relevant sites, directories and partners — the signals that tell search engines you can be trusted." },
    ],
    process: [
      { title: "Audit", body: "A full technical and content review, with fixes ranked by impact." },
      { title: "Foundations", body: "Technical fixes shipped and the keyword map agreed." },
      { title: "Publish", body: "New and improved pages go out on a regular cadence." },
      { title: "Compound", body: "Rankings, traffic and leads reviewed monthly; what works is extended." },
    ],
    why: [WHY.goals, WHY.dashboard, { title: "Search and AI answers together", body: "The same work that helps you rank also helps AI assistants cite you, so SEO and AI search optimisation are planned as one." }],
    faqs: [
      { q: "How long does SEO take to work?", a: "Technical fixes can show results within weeks; content and authority usually take a few months to build momentum. Newer domains take longer than established ones." },
      { q: "Do you do technical SEO?", a: "Yes — audits, crawl and indexing issues, site speed, structured data, sitemaps and site architecture, and we can implement fixes directly when we also build the site." },
      { q: "Can you guarantee a first-page ranking?", a: "No honest agency can; search engines decide rankings. What we commit to is the work that earns them and clear reporting on its effect." },
      { q: "Do you write the content?", a: "Yes. We plan, write and publish content in your brand voice, or brief your in-house writers if you prefer." },
    ],
    related: ["ai-search-optimization", "website-design-development", "content-creation"],
  },

  "ai-search-optimization": {
    seoTitle: "AI Search Optimization (AEO) Agency in India | Fifth Avenue",
    description:
      "AI search optimization (AEO): help ChatGPT, Perplexity and Google's AI answers find, understand and cite your brand — with schema, entity coverage and answer-ready content.",
    h1: "AI search optimization (AEO)",
    lede: "Be the answer when AI engines respond — AEO for Google AI, Perplexity and ChatGPT surfaces.",
    overview: [
      "More and more people ask an AI assistant instead of scrolling through search results. The assistant answers in a few sentences and cites a handful of sources. If your brand isn't one of them, you aren't in the conversation.",
      "Answer engine optimisation (AEO) is the work of making your brand easy for these systems to find, understand and quote: clear facts about who you are, structured data, content that answers real questions directly, and consistent mentions across the web. Fifth Avenue runs AEO alongside SEO, because the two reinforce each other.",
    ],
    included: [
      { title: "AI visibility audit", body: "How AI assistants currently describe your brand and category, which sources they cite, and where you are missing." },
      { title: "Entity and schema work", body: "Structured data and consistent facts about your organisation, products and people, so machines can identify you without guessing." },
      { title: "Answer-ready content", body: "Pages that answer the questions your customers actually ask, in the direct, well-structured form AI systems prefer to quote." },
      { title: "Mentions and citations", body: "Building presence on the third-party sources AI assistants trust and cite in your category." },
    ],
    process: [
      { title: "Benchmark", body: "We test the questions your customers ask across major AI assistants and record who gets cited." },
      { title: "Fix the facts", body: "Schema, entity data and on-site facts made complete and consistent." },
      { title: "Publish answers", body: "Content built around the questions that matter, structured to be quoted." },
      { title: "Re-test", body: "The same questions re-run regularly to track how your presence changes." },
    ],
    why: [{ title: "Planned with SEO", body: "AEO and SEO share foundations — crawlable pages, structured data, authority — so we plan them together instead of paying twice." }, WHY.goals, WHY.dashboard],
    faqs: [
      { q: "What is AEO?", a: "Answer engine optimisation: making your brand easy for AI assistants and AI search features to find, understand and cite when they answer a question." },
      { q: "How is AEO different from SEO?", a: "SEO aims to rank pages in a list of results; AEO aims to be the source an AI answer is built from. They share foundations, but AEO puts more weight on clear facts, structured data and directly answerable content." },
      { q: "Which AI platforms does this cover?", a: "Google's AI Overviews and AI Mode, ChatGPT, Perplexity, Gemini and similar assistants that answer with citations." },
      { q: "Can you guarantee our brand will be cited?", a: "No — each platform decides what to cite. We improve the signals they rely on and measure your presence before and after." },
    ],
    related: ["seo", "content-creation", "analytics-reporting"],
  },

  /* ── Brand & Content ────────────────────────────────────────────────── */
  branding: {
    seoTitle: "Branding Agency in India — Identity & Positioning | Fifth Avenue",
    description:
      "Branding built to last: positioning, brand strategy, voice and visual identity systems with clear guidelines your team and partners can use every day.",
    h1: "Branding agency in India",
    lede: "Identity systems built to survive a decade — strategy, voice and visual language.",
    overview: [
      "A brand is the set of things people reliably think and feel about you. Good branding makes that deliberate: a clear position, a recognisable voice and a visual system that holds together everywhere you show up.",
      "Fifth Avenue builds brands from strategy outward — who you are for, what you stand for and how you sound — then the identity that expresses it, and the guidelines that keep every campaign, creator post and ad consistent afterwards.",
    ],
    included: [
      { title: "Brand strategy and positioning", body: "Audience, category, competitors and the specific place your brand should own, written down so decisions can be made against it." },
      { title: "Verbal identity", body: "Name support, tagline, tone of voice and messaging hierarchy, so everything you say sounds like the same brand." },
      { title: "Visual identity", body: "Logo, typography, colour, imagery and layout principles, designed as a flexible system rather than a single mark." },
      { title: "Guidelines and rollout", body: "Practical guidelines and templates for your team, agencies and creators, plus the first applications across your key touchpoints." },
    ],
    process: [
      { title: "Discover", body: "Workshops, research and an audit of where your brand shows up today." },
      { title: "Define", body: "Positioning and voice agreed before any design starts." },
      { title: "Design", body: "Identity routes explored, refined and tested in real applications." },
      { title: "Roll out", body: "Guidelines, templates and launch assets delivered." },
    ],
    why: [WHY.oneTeam, { title: "Built to be used", body: "Because we also run your campaigns and content, the identity is designed for reels, ads and creator posts — not just a logo on a white page." }, WHY.approvals],
    faqs: [
      { q: "What does a branding agency deliver?", a: "Typically a brand strategy and positioning, verbal identity, a visual identity system and the guidelines and templates to apply them consistently." },
      { q: "Can you refresh an existing brand rather than start over?", a: "Yes. Many brands need an evolution — sharper positioning and a more flexible system — rather than a full rebrand." },
      { q: "How long does a branding project take?", a: "It depends on scope; a focused identity refresh is shorter than a full strategy, naming and identity programme. We agree the timeline at the brief." },
      { q: "Will the brand work on social media?", a: "Yes — we design and test the identity in social, video and creator contexts, since that's where most people will meet it." },
    ],
    related: ["creative-design", "content-creation", "website-design-development"],
  },

  "content-creation": {
    seoTitle: "Content Creation Agency in India — Reels & Social | Fifth Avenue",
    description:
      "An always-on content engine: reels, carousels, stories and long-form produced on a steady cadence, in your brand voice, with approvals and performance on one dashboard.",
    h1: "Content creation agency in India",
    lede: "An always-on content engine: reels, carousels, stories and long-form, produced on cadence.",
    overview: [
      "Audiences expect brands to show up consistently, in formats native to each platform. That takes a steady supply of good content — which is hard to keep up alongside everything else a marketing team does.",
      "Fifth Avenue produces content on a fixed cadence: planned in a calendar, made in your brand voice, approved before it publishes and measured afterwards so the next month's plan is built on what worked.",
    ],
    included: [
      { title: "Content planning", body: "Monthly themes and calendars built around your launches, seasons and what your audience responds to." },
      { title: "Short-form video", body: "Reels and shorts scripted, shot and edited for each platform's format and pace." },
      { title: "Static and carousel content", body: "Carousels, posts and stories designed to your brand system." },
      { title: "Long-form and editorial", body: "Articles, guides and long-form video that also feed your SEO and AI search presence." },
    ],
    process: [
      { title: "Plan", body: "A monthly calendar agreed with you in advance." },
      { title: "Produce", body: "Scripts, shoots, design and edits by our team and creators." },
      { title: "Approve", body: "Drafts reviewed and signed off on the dashboard." },
      { title: "Learn", body: "Performance reviewed monthly and fed into the next plan." },
    ],
    why: [WHY.approvals, WHY.dashboard, WHY.regional],
    faqs: [
      { q: "What kind of content do you create?", a: "Reels and shorts, carousels, static posts, stories, long-form video and written content such as articles and guides." },
      { q: "Can you create content in regional languages?", a: "Yes. Through our regional network we work with creators and writers across Indian languages." },
      { q: "How many posts do we get each month?", a: "That's set by the plan we agree — volume and mix are scoped to your goals and budget." },
      { q: "Do we approve content before it's published?", a: "Yes, every piece is reviewed and approved by you on the dashboard first." },
    ],
    related: ["social-media-management", "video-production", "influencer-marketing"],
  },

  "creative-design": {
    seoTitle: "Creative Design Agency — Campaign & Ad Creatives | Fifth Avenue",
    description:
      "Campaign creative design: key visuals, ad creatives, campaign kits and platform-native design for social, performance and packaging moments, built to your brand system.",
    h1: "Creative design for campaigns",
    lede: "Campaign craft — key visuals, packaging moments and platform-native design.",
    overview: [
      "Great campaigns need a strong central idea and the craft to carry it across every format — a hero visual, ads in a dozen sizes, social posts, retail and packaging touches.",
      "Fifth Avenue's design team turns a campaign idea into a complete, consistent kit, designed natively for each platform rather than resized from a single poster. Because the same team runs your performance and social, creative is made with testing and real placements in mind.",
    ],
    included: [
      { title: "Key visuals", body: "The central campaign image or system that every other asset is built from." },
      { title: "Campaign kits", body: "Ads, social posts, stories, banners and print assets in every size you need, consistent across the set." },
      { title: "Performance creative", body: "Ad variants designed to be tested — different hooks, formats and messages — so performance campaigns have options to learn from." },
      { title: "Packaging and retail moments", body: "Limited editions, in-store and launch materials that extend the campaign offline." },
    ],
    process: [
      { title: "Brief", body: "The idea, audience, placements and deadlines agreed." },
      { title: "Concept", body: "Creative routes presented and one chosen." },
      { title: "Craft", body: "The full kit designed and adapted per platform." },
      { title: "Deliver", body: "Files delivered and approved on the dashboard, ready to run." },
    ],
    why: [WHY.oneTeam, WHY.approvals, { title: "Made for real placements", body: "Creative is designed alongside the media plan, so every asset fits where it will actually run." }],
    faqs: [
      { q: "What is a campaign kit?", a: "The full set of assets a campaign needs — key visual, ads, social posts, stories and banners in every required size — designed as one consistent system." },
      { q: "Do you design performance ad creatives?", a: "Yes, including multiple variants for testing on Meta, Google and other channels." },
      { q: "Can you work within our existing brand guidelines?", a: "Yes. We design to your guidelines, or help extend them where a campaign needs more range." },
    ],
    related: ["branding", "performance-marketing", "video-production"],
  },

  "video-production": {
    seoTitle: "Video Production Agency in India — Brand & Product Films | Fifth Avenue",
    description:
      "Video production from concept to colour grade: product films, brand films, creator collaborations and performance cuts, made for the platforms they'll run on.",
    h1: "Video production agency in India",
    lede: "Concept to colour grade — product films, creator collabs and performance cuts.",
    overview: [
      "Video is the format most people choose to watch and the hardest to do well on a deadline. The same shoot often needs to become a hero film, a set of ads and a run of social cuts.",
      "Fifth Avenue handles video end to end — concept, scripting, production, editing and finishing — and plans the edit for every placement from the start, so one shoot delivers the full set of versions you need.",
    ],
    included: [
      { title: "Concept and scripting", body: "The idea, script and storyboard, written for the platform and the attention span of its audience." },
      { title: "Production", body: "Crew, casting, locations and shoot management, or creator-led shoots where authenticity matters more than polish." },
      { title: "Post-production", body: "Editing, motion graphics, sound and colour grading." },
      { title: "Platform cuts", body: "Vertical, square and horizontal versions and short ad cuts, planned before the shoot so nothing is cropped as an afterthought." },
    ],
    process: [
      { title: "Concept", body: "Idea, script and the full list of deliverables agreed." },
      { title: "Pre-production", body: "Casting, locations, schedule and shot list." },
      { title: "Shoot", body: "Production days run to the plan." },
      { title: "Edit and deliver", body: "Cuts reviewed and approved, then delivered in every format." },
    ],
    why: [WHY.oneTeam, { title: "Creator-ready", body: "We can pair produced films with creator collaborations, using our network so both feel part of one campaign." }, WHY.approvals],
    faqs: [
      { q: "What types of video do you produce?", a: "Product films, brand films, explainers, creator collaborations, social content and short performance ads." },
      { q: "Do you deliver vertical versions for reels and shorts?", a: "Yes — every project is planned with vertical, square and horizontal versions in mind." },
      { q: "Can creators be part of the production?", a: "Yes. Creator-led video often outperforms polished ads on social, and we can combine both in one campaign." },
    ],
    related: ["content-creation", "creative-design", "influencer-marketing"],
  },

  /* ── Creators & Community ───────────────────────────────────────────── */
  "creator-campaign-management": {
    seoTitle: "Creator Campaign Management in India | Fifth Avenue",
    description:
      "End-to-end creator campaign management: shortlisting, negotiation, briefs, usage rights, content approvals and creator payouts — handled for you and tracked live.",
    h1: "Creator campaign management",
    lede: "Shortlists, negotiations, briefs, usage rights and payments — managed end to end.",
    overview: [
      "Running creator campaigns in-house means dozens of conversations, contracts, drafts and invoices at once. Most of the effort goes into coordination rather than the campaign itself.",
      "Fifth Avenue takes the operational side off your plate. We manage every creator from shortlist to payout, with each stage visible on your dashboard and every approval recorded — whether the strategy is ours or your own team's.",
    ],
    included: [
      { title: "Shortlisting and vetting", body: "Creators checked for audience fit, engagement quality and brand safety before they reach you." },
      { title: "Negotiation and contracts", body: "Fees, deliverables, timelines, exclusivity and usage rights agreed in writing." },
      { title: "Brief and approval workflow", body: "Creator briefs issued and drafts reviewed against them, with your sign-off before anything goes live." },
      { title: "Payouts and paperwork", body: "Creator payments, invoices and tax paperwork handled, with itemised billing to you." },
    ],
    process: [
      { title: "Shortlist", body: "Vetted creators proposed for you to approve." },
      { title: "Lock", body: "Terms agreed and confirmed on both sides." },
      { title: "Deliver", body: "Content produced, approved and published on schedule." },
      { title: "Settle", body: "Creators paid and results reported." },
    ],
    why: [WHY.approvals, WHY.regional, { title: "Billing that explains itself", body: "Every invoice arrives itemised, with payment history on the dashboard, so you always know what was paid and what it bought." }],
    faqs: [
      { q: "Can you manage creators we've already chosen?", a: "Yes. We can run the operations for creators you've picked, or build the shortlist for you." },
      { q: "Who handles usage rights?", a: "We do — rights for organic and paid use are agreed in each creator's contract before content is made." },
      { q: "How are creators paid?", a: "We handle creator payments and bill you through itemised invoices, so you have one payee instead of many." },
    ],
    related: ["influencer-marketing", "community-building", "analytics-reporting"],
  },

  "community-building": {
    seoTitle: "Community Building & Brand Ambassador Programmes | Fifth Avenue",
    description:
      "Community building for brands: ambassador programmes, owned groups and advocacy loops that turn customers and creators into a lasting audience you own.",
    h1: "Community building for brands",
    lede: "Owned audiences that outlast algorithms — groups, ambassadors and advocacy loops.",
    overview: [
      "Platforms change their algorithms; communities you own don't. A loyal group of customers, fans and creators gives you reach, feedback and advocacy that doesn't depend on the next ad budget.",
      "Fifth Avenue designs and runs community programmes — ambassador networks, private groups and advocacy loops — and measures them like any other channel, so the value is visible rather than assumed.",
    ],
    included: [
      { title: "Ambassador programmes", body: "Recruiting, onboarding and rewarding customers and creators who genuinely use and recommend your brand." },
      { title: "Owned community spaces", body: "Groups and channels set up, moderated and kept active with a regular rhythm of content and conversation." },
      { title: "Advocacy loops", body: "Simple mechanics — referrals, user-generated content, early access — that turn satisfied customers into new ones." },
      { title: "Community insight", body: "What members say, ask and share, summarised into insight your product and marketing teams can use." },
    ],
    process: [
      { title: "Design", body: "Who the community is for and what they get from it." },
      { title: "Seed", body: "Founding members recruited and the space launched." },
      { title: "Grow", body: "A steady programme of activity, rewards and recruitment." },
      { title: "Measure", body: "Retention, participation and advocacy reported on the dashboard." },
    ],
    why: [WHY.regional, WHY.goals, WHY.oneTeam],
    faqs: [
      { q: "What is a brand ambassador programme?", a: "A structured group of customers or creators who represent and recommend your brand regularly, in exchange for rewards, access or recognition." },
      { q: "Where should our community live?", a: "Wherever your audience already spends time — WhatsApp, Instagram broadcast channels, Discord, Telegram or your own platform. We recommend based on your audience." },
      { q: "How do you measure community value?", a: "Membership growth, participation, retention, referrals and the content members create, tied to your business goal." },
    ],
    related: ["social-media-management", "creator-campaign-management", "custom-marketing-solutions"],
  },

  "social-media-management": {
    seoTitle: "Social Media Management Agency in India | Fifth Avenue",
    description:
      "Social media management run like a product: content calendars, publishing, community response and monthly reporting across Instagram, YouTube, LinkedIn and more.",
    h1: "Social media management agency in India",
    lede: "Channels run like products: calendars, community response and monthly learning loops.",
    overview: [
      "Keeping social channels active, on-brand and responsive every day is a job in itself — and without a learning loop it turns into posting for the sake of posting.",
      "Fifth Avenue runs your social channels end to end: planning, production, publishing, replying to your community and reviewing what worked each month. Your calendar, approvals and results all sit on the client dashboard.",
    ],
    included: [
      { title: "Strategy and calendars", body: "Channel roles, content pillars and a monthly calendar agreed with you in advance." },
      { title: "Publishing", body: "Content produced and scheduled for the best times on each platform." },
      { title: "Community management", body: "Comments and messages answered in your brand voice, with anything sensitive escalated to you." },
      { title: "Monthly reporting", body: "Reach, engagement and follower growth reviewed every month, with clear changes for the next plan." },
    ],
    process: [
      { title: "Audit", body: "A review of your channels, audience and competitors." },
      { title: "Plan", body: "Pillars, formats and the first month's calendar." },
      { title: "Run", body: "Daily publishing and community response." },
      { title: "Review", body: "A monthly report and an updated plan." },
    ],
    why: [WHY.dashboard, WHY.approvals, WHY.oneTeam],
    faqs: [
      { q: "Which platforms do you manage?", a: "Instagram, YouTube, LinkedIn, Facebook and X, plus emerging platforms where your audience is active." },
      { q: "Do you reply to comments and messages?", a: "Yes. Community management is part of the service, with clear rules for what gets escalated to you." },
      { q: "Can social media management include influencer work?", a: "Yes — because both run through us, creator collaborations can be planned into your calendar." },
    ],
    related: ["content-creation", "community-building", "influencer-marketing"],
  },

  "custom-marketing-solutions": {
    seoTitle: "Regional & Custom Marketing Campaigns in India | Fifth Avenue",
    description:
      "Custom marketing solutions built to your brief: regional launches, offline activations and category experiments across India, run and reported on one dashboard.",
    h1: "Regional and custom marketing campaigns",
    lede: "Regional launches, offline activations and category experiments — built to your brief.",
    overview: [
      "Some briefs don't fit a standard service: launching in a new state, activating a city, testing a new category or combining online and on-ground work into one push.",
      "Fifth Avenue builds these campaigns to order, drawing on the same team, creator network and dashboard as everything else — so even a one-off experiment is planned against a goal and measured properly.",
    ],
    included: [
      { title: "Regional launches", body: "Entering a new state or city with local creators, local language content and channels that work in that market." },
      { title: "Offline activations", body: "Events, sampling, retail and on-ground moments, connected to digital so they reach beyond the people in the room." },
      { title: "Category experiments", body: "Small, fast tests of a new audience, product or channel before committing a full budget." },
      { title: "Integrated campaigns", body: "Creators, paid media, content and on-ground work combined into a single campaign with one plan." },
    ],
    process: [
      { title: "Brief", body: "The goal, the market and what success looks like." },
      { title: "Design", body: "A campaign built from the services the brief actually needs." },
      { title: "Execute", body: "Run by one team across every channel involved." },
      { title: "Report", body: "Results by region and channel on the dashboard." },
    ],
    why: [WHY.regional, { title: "Regional clarity", body: "A live map of India shows performance state by state — campaigns, creators, reach and budget per region." }, WHY.goals],
    faqs: [
      { q: "Can you run a campaign in one specific state or city?", a: "Yes. Our network covers every Indian state, and the dashboard reports performance region by region." },
      { q: "Do you do offline activations?", a: "Yes, and we connect them to digital — creators, content and paid media — so they reach further than the event itself." },
      { q: "What if our brief doesn't match any of your services?", a: "That's what this service is for. Tell us the goal and we'll design the campaign around it." },
    ],
    related: ["influencer-marketing", "community-building", "marketing-strategy"],
  },

  /* ── Intelligence & Ops ─────────────────────────────────────────────── */
  "analytics-reporting": {
    seoTitle: "Marketing Analytics & Reporting Dashboard | Fifth Avenue",
    description:
      "Marketing analytics and reporting on one live dashboard: reach, engagement, spend and ROI across influencer, paid, search and content, with auto-insights on what to scale.",
    h1: "Marketing analytics and reporting",
    lede: "One dashboard for every wing — reach, engagement, spend and ROI in live numbers.",
    overview: [
      "Most marketing is reported channel by channel, by different people, in different formats, weeks after the fact. It is almost impossible to see what the whole budget achieved.",
      "Fifth Avenue's client dashboard brings it together: every campaign, whatever the service, reports into one view with live numbers you can slice by niche, size, region and language. Auto-insights flag what to scale, investigate or pause before the monthly review does.",
    ],
    included: [
      { title: "Unified dashboard", body: "Influencer, paid, search, social and content results in one place, updated continuously." },
      { title: "Goal tracking", body: "Campaigns tagged to the business goals you set, so you can see each service's contribution." },
      { title: "Regional performance", body: "A state-by-state view of campaigns, creators, reach and budget across India." },
      { title: "Insights and reviews", body: "Automatic flags on what's working and what isn't, plus regular reviews with our strategists." },
    ],
    process: [
      { title: "Connect", body: "Campaign data flows into your dashboard from day one." },
      { title: "Define", body: "Goals and the metrics that matter for each agreed." },
      { title: "Monitor", body: "Live numbers and auto-insights as campaigns run." },
      { title: "Review", body: "Regular reviews that turn the data into next steps." },
    ],
    why: [WHY.dashboard, WHY.goals, WHY.oneTeam],
    faqs: [
      { q: "What does the client dashboard show?", a: "Campaign status, deliverables and approvals; reach, engagement and spend; performance by creator, niche, region and language; goal progress; and itemised billing." },
      { q: "Is the data live?", a: "Yes. Campaign metrics update as posts and ads run, rather than arriving in a monthly report." },
      { q: "Can we see performance by region?", a: "Yes — a map of India shows campaigns, creators, reach and budget state by state." },
    ],
    related: ["marketing-strategy", "performance-marketing", "influencer-marketing"],
  },

  "marketing-strategy": {
    seoTitle: "Marketing Strategy Consulting in India | Fifth Avenue",
    description:
      "Goal-based marketing strategy: where to spend the next rupee and why — channel mix, budgets, priorities and quarterly plans built from your business goals.",
    h1: "Marketing strategy consulting",
    lede: "Goal-based planning across services — where to spend the next rupee and why.",
    overview: [
      "Marketing budgets are usually split by habit: last year's channels, last year's agencies, last year's ratios. Strategy is the discipline of deciding from the goal backwards instead.",
      "Fifth Avenue's strategists start from what the business needs — growth in a region, a launch, a new audience — and build the plan across services: what to do, in what order, with what budget, and how each piece will be measured.",
    ],
    included: [
      { title: "Goal setting", body: "Business goals translated into marketing goals with clear, measurable targets." },
      { title: "Audience and market analysis", body: "Who you're winning, who you're missing, and where — including region-level opportunities." },
      { title: "Channel mix and budgets", body: "How to split budget across influencer, paid, search, content and other services, with reasoning you can defend." },
      { title: "Quarterly plans", body: "A plan for the quarter ahead, reviewed against results and adjusted every quarter." },
    ],
    process: [
      { title: "Understand", body: "Your goals, numbers, customers and constraints." },
      { title: "Analyse", body: "Audience, market and past performance." },
      { title: "Plan", body: "The mix, budget and roadmap for the quarter." },
      { title: "Adjust", body: "Results reviewed and the next quarter re-planned." },
    ],
    why: [WHY.goals, WHY.oneTeam, WHY.dashboard],
    faqs: [
      { q: "Do we have to use Fifth Avenue to execute the strategy?", a: "No, though most clients do — strategy and execution under one team means the plan is measured against what actually happens." },
      { q: "How often is the strategy updated?", a: "Plans are set quarterly and reviewed against live results throughout the quarter." },
      { q: "Can you help us plan expansion into new regions of India?", a: "Yes. Regional performance data and our creator network across every state make this a particular strength." },
    ],
    related: ["analytics-reporting", "custom-marketing-solutions", "performance-marketing"],
  },

  "marketing-automation": {
    seoTitle: "Marketing Automation Services — CRM & Journeys | Fifth Avenue",
    description:
      "Marketing automation that follows up while you sleep: customer journeys, CRM flows, email and WhatsApp triggers and lead nurturing, set up and optimised for you.",
    h1: "Marketing automation services",
    lede: "Journeys, triggers and CRM flows that follow up while you sleep.",
    overview: [
      "Most leads and customers drift away not because they weren't interested, but because nobody followed up at the right moment. Automation fixes that by responding to what people do, instantly and consistently.",
      "Fifth Avenue designs and builds automated journeys in your CRM and messaging tools — welcome flows, lead nurturing, abandoned carts, re-engagement — and measures them so they keep improving.",
    ],
    included: [
      { title: "Journey design", body: "The key moments in your customer lifecycle mapped, with the right message for each." },
      { title: "CRM setup and flows", body: "Segments, triggers and workflows built in the tools you use, or help choosing them." },
      { title: "Email and WhatsApp messaging", body: "Copy and design for each step, written to be useful rather than noisy." },
      { title: "Testing and optimisation", body: "Open, click and conversion rates tracked, with steps tested and improved over time." },
    ],
    process: [
      { title: "Map", body: "Your customer journey and current gaps." },
      { title: "Build", body: "Segments, triggers and messages set up." },
      { title: "Launch", body: "Flows switched on and monitored." },
      { title: "Improve", body: "Results reviewed and steps refined." },
    ],
    why: [WHY.oneTeam, WHY.goals, { title: "Connected to acquisition", body: "Leads from influencer, paid and search campaigns flow straight into journeys we've designed, so nothing is dropped between teams." }],
    faqs: [
      { q: "Which tools do you work with?", a: "Common CRM, email and WhatsApp Business platforms. If you don't have one yet, we help choose a fit for your size and budget." },
      { q: "What should we automate first?", a: "Usually the welcome flow and lead follow-up, because they affect the most people at the moment they're most interested." },
      { q: "Can automation work with WhatsApp?", a: "Yes, through the WhatsApp Business Platform, within its messaging and consent rules." },
    ],
    related: ["website-design-development", "performance-marketing", "analytics-reporting"],
  },

  "website-design-development": {
    seoTitle: "Website Design & Development Company in India | Fifth Avenue",
    description:
      "Website design and development: fast, well-designed sites engineered for search and conversion — landing pages, marketing sites and dashboards, built not templated.",
    h1: "Website design and development",
    lede: "Fast, handsome, conversion-honest sites — engineered, not templated.",
    overview: [
      "Every campaign eventually sends people to a website. If it is slow, confusing or invisible to search engines, the rest of the marketing budget leaks away at the last step.",
      "Fifth Avenue designs and builds websites and landing pages that load fast, read clearly and are built for search and AI discovery from day one — then measures how they convert and keeps improving them.",
    ],
    included: [
      { title: "Design", body: "Structure, copy and visual design built around what visitors need to do, in your brand system." },
      { title: "Engineering", body: "Modern, fast sites with clean code, responsive layouts and accessibility in mind." },
      { title: "SEO built in", body: "Crawlable pages, structured data, sitemaps and metadata as part of the build, not an afterthought." },
      { title: "Conversion optimisation", body: "Analytics set up, funnels measured and pages tested to turn more visitors into leads and customers." },
    ],
    process: [
      { title: "Scope", body: "Goals, audiences, pages and integrations agreed." },
      { title: "Design", body: "Structure and designs reviewed with you." },
      { title: "Build", body: "Development, content and testing." },
      { title: "Launch and improve", body: "Go live, then measure and optimise." },
    ],
    why: [{ title: "Engineered in-house", body: "The same team builds our own client dashboard, so your site is held to the same engineering bar." }, WHY.oneTeam, WHY.goals],
    faqs: [
      { q: "Do you build landing pages for campaigns?", a: "Yes — standalone landing pages for paid and influencer campaigns as well as full websites." },
      { q: "Will the website be SEO-friendly?", a: "Yes. Technical SEO — fast loading, crawlable pages, structured data, sitemaps and metadata — is part of every build." },
      { q: "Can you redesign our existing site?", a: "Yes. We can redesign and rebuild, or improve an existing site's speed, structure and conversion." },
    ],
    related: ["seo", "branding", "marketing-automation"],
  },
};

/* The /services hub page. */
export const SERVICES_HUB = {
  seoTitle: "Marketing Services in India | Fifth Avenue",
  description:
    "Sixteen marketing services under one accountable team: influencer, performance, SEO and AI search, branding, content, video, social, analytics and more — on one live dashboard.",
  h1: "Marketing services",
  lede: "Sixteen capabilities under one accountable team — influencer, performance, search, brand, content and the data that ties them together.",
};
