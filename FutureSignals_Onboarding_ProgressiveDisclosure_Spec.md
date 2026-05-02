# Future Signals v2 — Onboarding & Progressive Disclosure Spec

**Replaces:** `FutureSignals_ColdStart_Onboarding_Redesign.md`  
**Status:** Ready for Claude Code implementation scoping  
**Last updated:** April 2026

---

## Governing Principle: Progressive Disclosure

Future Signals has a rich methodology. The product should never hide that richness — but it should never demand it upfront either.

Progressive disclosure means: **show the minimum needed to create value now, and surface the rest at the moment it becomes useful.** Not as a dumbed-down mode, and not as a power-user feature. As the natural shape of how practitioners actually develop foresight projects — starting with a question, building toward structured analysis.

This principle applies everywhere in the product, but it's most critical at two moments: first sign-up, and first project creation. Those are the moments where the gap between the product's mental model ("complete this methodology framework") and the practitioner's mental model ("I have a question I want to think through") is widest.

The field erosion problem — where forms accumulate fields over time until they become 12-field briefs — is a natural product development pattern. The fix isn't to audit fields periodically. It's to encode progressive disclosure as a structural rule that new fields must respect: **every field must declare whether it belongs to Quick Start or Enhanced, and new fields default to Enhanced unless there's a specific reason to promote them.**

---

## Quick Start vs. Enhanced

The two-tier model for all entity creation in Future Signals.

**Quick Start** — the minimum fields needed for the system to do something useful. Always the default. Gets the practitioner into the product and triggers AI functionality immediately. Feels fast.

**Enhanced** — additional fields that deepen the methodology, improve AI output quality, or scaffold the practitioner's thinking. Available immediately via an expand toggle, but never required. Invited at contextually appropriate moments post-creation.

This isn't about hiding the methodology. A Quick Start project with a sharp key question and a good domain is a *real* project. Enhanced fields make it richer — they don't make it legitimate.

---

## Onboarding Sequence

### Design principles for the sequence

**Value before commitment.** Don't ask practitioners to define their project scope in full before they've seen what the product can do. The minimal project brief triggers the scanner; the scanner demonstrates value; the demonstrated value motivates the practitioner to enrich their brief.

**Education through example, not instruction.** The sample project is the methodology education step. Not a tour, not a modal, not a getting-started checklist. A finished project in the practitioner's domain, that shows what they're building toward.

**The scanner works while they learn.** Domain selection triggers ingestion; key question submission triggers scoring. By the time the practitioner has explored the sample project, their first candidates are ready. The reveal — "signals arrived while you were setting up" — is the product's first wow moment.

**Land on value, not dashboard.** Onboarding ends when the practitioner has taken their first meaningful action in their own project — reviewing scanner candidates, or running their first cluster. Not when they've completed a form.

---

### The sequence

```
SIGN UP
  ↓
PROFILE (one question only)
  ↓
PROJECT QUICK START  ← scanner fires here
  ↓
SAMPLE PROJECT        ← education; scanner running in background
  ↓
SCANNER INBOX         ← "signals arrived while you were setting up"
  ↓
FIRST CLUSTER PROMPT  ← one CTA; practitioner triggers it
  ↓
IN THE PRODUCT        ← onboarding complete; no ceremony
```

---

### Step 1 — Sign up

Email + password, or OAuth (Google). Display name pre-filled from OAuth or entered manually.

That's it. No profile fields here.

---

### Step 2 — One profile question

Single screen, single question:

> **How do you currently practice foresight?**
> - I'm new to structured foresight methods
> - I use foresight methods regularly in my work
> - I'm an experienced practitioner or consultant

This sets experience level, which controls two things: the depth of contextual prompts inside the product (beginner users see more inline explanation; experienced users see less), and the default Enhanced field visibility toggle on the project form.

Everything else that might live on a "profile" — bio, expertise areas, organisation — is deferred to post-first-session. It has no downstream function until there's a social or collaboration layer. Don't ask for it here.

---

### Step 3 — Project Quick Start

Three fields. Nothing else visible by default.

| Field | Notes |
|---|---|
| **Project name** | Plain text. Placeholder: *e.g. "Future of Urban Mobility 2035"* |
| **Domain** | Picker — only domains with sufficient candidate pools shown (≥30 candidates). Domain selection triggers background ingestion immediately. |
| **Key question** | Single text field. Label reads: *"The question this project is trying to answer — this is a starting point, not a commitment."* Placeholder: *e.g. "How will AI reshape diagnostic medicine in the next decade?"* |

**Enhanced toggle** (collapsed by default, visible always):

> `+ Add more detail` — *Time horizons, geographic scope, focus area, STEEPLED scope, stakeholders. These sharpen AI outputs but aren't required to get started.*

Expanding the toggle reveals the full project brief field set. Experienced practitioners (flagged by step 2) see this toggle slightly more prominently — not open by default, but with a label that signals it's for them: *"Advanced setup — add methodology context."*

**On submit:** Two things happen simultaneously.
1. Project is created with the three Quick Start fields.
2. `POST /api/projects/{id}/seed-onboarding` fires — embeds the key question, runs cosine similarity against domain candidates, returns top 15 scored candidates. This call is non-blocking; the practitioner advances to step 4 immediately.

---

### Step 4 — Sample project

A completed project in the practitioner's selected domain, shown as a read-only view. This is the methodology education step.

What it shows:
- A realistic set of inputs (15–20) across diverse sources
- Clusters with AI summaries and subtype labels (Trend, Driver, Tension)
- A system map with typed relationships
- A scenario and a preferred future

**Framing copy at the top:**

> *Here's a finished project to show you where things go. Your project is being set up in the background — take a minute to explore this one.*

The sample project is not a tutorial. There are no tooltips, no "step 1 of 6" overlays, no forced navigation. The practitioner explores freely. This is intentional — free exploration builds more durable mental models than guided tours.

Two affordances:

`Use this as a template →` — copies the sample project's structure (clusters, system map skeleton) into their project as a starting point. Inputs are not copied; only the structural layer. Practitioner replaces the sample's content with their own.

`Continue to my project →` — skips to step 5.

**What's happening in the background:** The `seed-onboarding` scoring call from step 3 is completing. By the time the practitioner spends 60–90 seconds with the sample project, their scanner results are ready.

---

### Step 5 — Scanner inbox: "Your first signals arrived"

The practitioner lands on their project's scanner inbox, not the dashboard.

**Header copy:**

> *While you were getting set up, we scanned [domain] sources for signals relevant to your project. Here's what we found.*

This framing does several things simultaneously: it demonstrates the scanner's always-on value, it sets the expectation that signals will continue to arrive, and it positions the practitioner's role correctly — reviewer and judge, not data-entry operator.

**Layout:** Candidate cards in a 2-column grid. Each card:
- Title (linked to source, opens new tab)
- Source name + credibility indicator
- AI summary (2 sentences)
- STEEPLED category pills
- Checkbox for selection

**Corpus progress indicator** (persistent, at top of screen):

```
Signal corpus: ████░░░░░░  4 / 10 — add 6 more to unlock AI clustering
```

Updates in real-time as the practitioner selects cards. "Unlock AI clustering" is accurate and motivating — it frames the threshold as access to the product's next capability, not an arbitrary number.

**Interaction model:** Multi-select, then batch add. Browse all 15 candidates, check the relevant ones, hit:

`Add 7 inputs to my project →` (dynamic count)

This is different from the ongoing scanner digest (which uses individual card-level promote/dismiss). The onboarding mode is selection-from-abundance, not triage.

**Skip path:** `Skip for now →` in small text below the CTA. No guilt. Inline note: *"You can review scanner results any time from the Scanner tab."*

**If the practitioner adds ≥5 inputs:** Advance to step 6. If fewer than 5 (or skipped): land on the Inputs screen with the scanner as the primary CTA in the empty state (not "Add signal manually").

---

### Step 6 — First cluster prompt

The practitioner lands on the Clusters screen. If they added ≥5 inputs, a contextual prompt appears:

```
┌────────────────────────────────────────────────────────────────┐
│  You've added 8 inputs. Ready to find the patterns?            │
│                                                                │
│  [ Run AI Clustering ]                                         │
│                                                                │
│  You can add more signals first — more inputs means richer     │
│  clusters. There's no wrong time to run it.                    │
└────────────────────────────────────────────────────────────────┘
```

One deliberate action. Not automatic — the practitioner controls the trigger. This matters for the product's identity: AI as scaffold, not AI as autopilot.

After clustering runs: the practitioner sees their first clusters. Onboarding is complete. No modal, no confetti, no "you've finished onboarding!" message. They're just in the product, looking at their own synthesised output. That's the right ending.

---

### Post-onboarding: profile completion and brief enrichment

**Profile:** An in-app prompt surfaces 48 hours after sign-up (or after second session, whichever comes first): *"Complete your profile — add your expertise areas and organisation."* Not a gate. Dismissable.

**Project brief enrichment:** After the practitioner's first clustering run, a persistent but unobtrusive prompt appears on the project header or settings panel:

> `Enhance your project brief →` — *Add time horizons, geographic scope, and STEEPLED focus to get sharper AI outputs.*

This is the moment when enrichment fields feel valuable rather than bureaucratic — the practitioner has seen AI output on a thin brief and will intuitively understand that more context produces better results. The fields are offered *because* of what they just experienced, not demanded *before* it.

---

## Progressive Disclosure: Structural Rules

These rules govern all entity creation in the product, not just onboarding.

### Project creation (ongoing, not just onboarding)

Quick Start fields (always shown, always sufficient to create):
- Name
- Domain
- Key question

Enhanced fields (behind `+ Add more detail` toggle):
- Time horizons
- Geographic scope
- Focus area (unit of analysis)
- STEEPLED scope (which categories to emphasise)
- Stakeholders
- Assumptions

**Rule:** A project created with only Quick Start fields is a valid project. The product should never visually flag it as "incomplete" — only offer "enhance."

### Input creation

Quick Start fields:
- Title / headline
- Source URL (triggers auto-populate of metadata)
- Input subtype (Signal, Issue, Projection, Plan, Obstacle)

Enhanced fields:
- Description (auto-populated from URL, editable)
- STEEPLED tags (AI-suggested, editable)
- Signal quality (Emerging / Established / Confirmed)
- Notes

The URL metadata scraper already handles most of the Enhanced fields automatically. The practitioner's Quick Start path is: paste URL → confirm subtype → done. Enhanced fields are there if they want to edit.

### Cluster creation

Quick Start fields:
- Name
- Cluster subtype (Trend, Driver, Tension)

Enhanced fields:
- Description
- AI summary (generated on demand, not automatic)
- STEEPLED tags
- Linked inputs (managed via the clustering UI, not this form)

### Futures Models (Scenarios, Preferred Futures, Strategic Options)

Quick Start fields vary by type — but the principle is the same: the minimum needed to create a meaningful entity.

**Scenario Quick Start:**
- Title
- Archetype (Continuation / Collapse / Constraint / Transformation)
- Narrative (free text — even a few sentences is valid)

**Scenario Enhanced:**
- Time horizon
- Key drivers (linked clusters)
- Uncertainties
- Implications
- Strategic relevance

**Preferred Future Quick Start:**
- Title
- Vision statement (free text)

**Preferred Future Enhanced:**
- Guiding principles
- Key changes from present
- What needs to be true
- Linked scenarios

**Strategic Options Quick Start:**
- Title
- Description (what the option is)

**Strategic Options Enhanced:**
- Linked scenario(s)
- Rationale
- Key risks
- Owner / decision context

Zero required fields on any Futures Model. A scenario with a title and two sentences of narrative is a real scenario. Don't gate creation on completeness.

---

## Field Governance Rule

To prevent future field erosion, every new field proposed for any entity creation form must answer:

> *Does a user need this field before they can get value from this entity? Or does this field enhance value after creation?*

If the answer is "enhance after creation" → Enhanced tier, collapsed by default.  
If the answer is "needed before value" → Quick Start tier, but requires justification.  

Currently, the only fields that genuinely meet the "needed before value" bar are name, domain, and key question on a project. Every other field in the existing forms is an enhancement. If that feels wrong for a specific field, the justification should be explicit — not assumed.

---

## Architecture Notes

### On-demand seeding endpoint

`POST /api/projects/{id}/seed-onboarding`

Fires synchronously on project creation during onboarding. Reuses Layer 3 scoring logic:
1. Embed project key question (OpenAI `text-embedding-3-small`)
2. Cosine similarity against `candidates` table for project domain, status ≠ expired, embeddings populated
3. Apply source credibility weighting + recency decay
4. Diversity check (no single-source or single-STEEPLED dominance)
5. Return top 15 candidates ranked by score

Does not write to `project_candidates`. Does not count against AI caps. Idempotent — can re-fire if key question is updated.

**Pre-condition:** Domain picker only shows domains with ≥30 candidates in the `candidates` table. This must be verified before each Alpha invite is sent.

### Corpus threshold indicator

Appears on: Scanner inbox (onboarding), Inputs screen (post-onboarding), Clusters screen (post-onboarding).  
Disappears: permanently, once the project crosses 10 inputs.  
Behaviour: real-time count update; "unlock AI clustering" label until threshold crossed.

### Experience level flag

Stored on user record. Controls:
- Depth of inline contextual copy across the product (beginners see more; experienced users see less)
- Enhanced toggle visibility on project creation form (experienced users see it slightly more prominently)
- Does not gate any functionality

---

## Alpha Validation

Watch for these signals in Alpha sessions to validate or challenge this sequence:

| Signal | What it means |
|---|---|
| Practitioner completes onboarding and runs first cluster in same session | Activation sequence is working |
| Practitioner freezes on key question field | "Draft" framing insufficient, or need domain-specific examples |
| Skip rate on scanner inbox >50% | Candidate quality is low, or the step feels like obligation |
| Practitioner expands Enhanced toggle during first project creation | They're engaged — consider whether Enhanced defaults are right for experienced users |
| Practitioner backtracks from sample project immediately | Sample project domain match is wrong, or the framing is off |
| Practitioner uses "Use as template" on sample project | This is a strong positive signal — it means the sample project is doing its job |
| First clustering run happens days after onboarding | Activation moment failed; re-examine scanner inbox step |

---

*Spec covers: onboarding sequence, progressive disclosure principle, Quick Start / Enhanced field tiers for all major entities, on-demand seeding architecture, field governance rule.*
