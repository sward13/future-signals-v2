# Future Signals v2 — Design Principles

**Location in repo:** `docs/design-principles.md`  
**Referenced by:** `CLAUDE.md`  
**Audience:** Design and product decisions (Sam, John); implementation decisions (Claude Code)  
**Last updated:** April 2026

---

## How to use this document

This document establishes the principles that govern design and implementation decisions in Future Signals v2. When there is a tension between two possible approaches — a UX pattern, a field set, an AI behaviour, a nudge — this document provides the decision criteria.

For Claude Code: read this document before making any UX, form, or AI-output decision. If an implementation choice would violate a principle stated here, flag it rather than proceeding.

---

## The Target Condition

> A foresight practitioner uses Future Signals to think their way somewhere they wouldn't have reached on their own, and to produce work that reflects that.

This is the definition of success. Not completion rates, not DAU, not features shipped. Those are indicators. The target condition is the thing they point toward.

A practitioner has reached the target condition when:

- They arrived somewhere interesting and defensible — a framing, a pattern, an insight they couldn't have articulated before
- The tool earned return visits — not through nudges, but because returning felt worth it
- The output was satisfying to produce — the process felt generative, not administrative
- The output was worth sharing — they put their name on it
- The output enhanced their reputation — a client, colleague, or stakeholder saw the work differently as a result

**What this implies for the product:** Effectiveness is paramount. Efficiency is secondary. A practitioner who produces one genuinely sharp scenario that changes how a client approaches a strategic question will return. A practitioner who efficiently completes a 12-field form and produces a mediocre output will not.

---

## The Target Practitioner's Journey

The practitioner the product is designed for does not move linearly through the methodology. They:

- Jump between stages — from a cluster back to inputs, from a scenario back to the system map
- Drop placeholder insights at 11pm and return three days later
- Start a project "just for fun" and convert it to client work when it produces something surprising
- Need to re-enter the product gracefully after absence — to see where they were and what's new

This is not a failure mode to be corrected. It is how serious thinking actually works. The product must be as good at **re-entry** as at first entry.

**What this implies for implementation:**
- Every screen must make sense as a landing point, not just as a step in a sequence
- Dashboard and project views should surface "where you left off" and "what's new" on return
- No stage should be a gate on another stage — a practitioner can write a scenario before building a system map if that's where their thinking is

---

## Principle 1 — AI as Scaffold, Not Autopilot

The product's core design philosophy. AI surfaces patterns, generates drafts, pre-populates structure, and scores relevance. The practitioner makes judgments.

This applies everywhere:
- The scanner surfaces candidates; the practitioner decides what constitutes a signal
- Clustering suggests groupings; the practitioner decides what's meaningful
- AI drafts scenario narratives; the practitioner edits and owns them
- The system map is pre-populated with clusters; the practitioner draws the relationships

**What this means in practice:** AI outputs are always editable, always attributed as AI-generated until the practitioner acts on them, and never presented as conclusions. The practitioner's judgment is the product's output. AI is the infrastructure that makes that judgment more legible and more rigorous.

**Implementation rule:** Never auto-apply an AI output without a practitioner action. Pre-populate, suggest, and draft — but require a deliberate practitioner step (confirm, edit, promote, connect) before an AI output becomes part of the project record.

---

## Principle 2 — Progressive Disclosure

Show the minimum needed to create value now. Surface depth at the moment it becomes useful.

This is not a simplified mode. A Quick Start project with a sharp key question and a good domain is a real project. Enhanced fields make it richer — they don't make it legitimate.

### The two tiers

**Quick Start** — the minimum fields needed for the system to do something useful. Always the default. Triggers AI functionality immediately. Never requires justification to skip the rest.

**Enhanced** — fields that deepen the methodology, improve AI output quality, or scaffold thinking. Available immediately via an expand toggle. Invited at contextually appropriate moments post-creation. Never required.

### Quick Start field sets by entity

| Entity | Quick Start fields |
|---|---|
| Project | Name, Domain, Key question |
| Input | Source URL (auto-populates metadata), Input subtype |
| Cluster | Name, Cluster subtype (Trend / Driver / Tension) |
| Scenario | Title, Archetype, Narrative (free text, even a few sentences) |
| Preferred Future | Title, Vision statement |
| Strategic Option | Title, Description |

**Implementation rule:** Zero required fields on any entity. A practitioner can create any entity with only Quick Start fields and the product must treat it as valid — not flag it as incomplete, not block downstream actions. The word "incomplete" should not appear in the product.

### The Enhanced expand pattern

Enhanced fields live behind a consistently styled toggle across all creation forms:

```
+ Add more detail
```

Expanded state label for experienced practitioners (experience level set during onboarding):

```
+ Advanced setup — add methodology context
```

The toggle is always visible. It is never the default open state on first project creation. It may be offered as a prompt after a practitioner's first clustering run: "Enhance your project brief to get sharper AI outputs →"

---

## Principle 3 — Value Before Commitment

Never ask practitioners to invest effort before demonstrating what the product can do with it.

The canonical failure mode: a 12-field project brief before the practitioner has seen a single AI output. The product knows what a complete brief looks like and asks for it — but the practitioner doesn't yet know why it matters.

**The correct order:** minimal input → AI does something useful → practitioner sees the output → practitioner understands why more input would make it better → practitioner enriches the brief voluntarily.

**What this implies:**
- Project creation triggers the scanner immediately (three Quick Start fields is enough)
- Education happens through the sample project (example of a finished output), not through instruction before use
- Brief enrichment is offered *after* the first clustering run, not demanded at project creation
- Onboarding ends when the practitioner has experienced something, not when they've completed a form

---

## Principle 4 — Field Governance

Every field added to any creation form must answer:

> *Does a practitioner need this field before they can get value from this entity? Or does this field enhance value after creation?*

**"Needed before value"** → Quick Start tier. Requires explicit justification. Very few fields meet this bar.

**"Enhances value after creation"** → Enhanced tier. Default placement for all new fields.

**New fields default to Enhanced unless there is a specific, documented reason to promote them to Quick Start.** The justification must be stated at the time the field is proposed, not assumed.

This rule exists because form field accumulation is a natural product development pattern — each addition seems small, but they compound. The governance rule encodes progressive disclosure as a structural constraint, not a design preference that gets overridden.

Currently, the only fields that genuinely meet the Quick Start bar:
- Project: Name, Domain, Key question
- Input: Source URL, Subtype
- All other entities: Name / Title only (plus one defining field where applicable)

---

## Principle 5 — Graceful Re-entry

The product must make returning easy after any length of absence.

A practitioner who dropped a placeholder insight at 11pm and returns three days later needs to immediately understand:
- Where they left off
- What's changed (new scanner candidates, unfinished clusters, a scenario draft)
- What the obvious next action is

**Implementation rule:** The dashboard and project header are re-entry surfaces, not completion dashboards. They should answer "where was I and what's new?" not "here is your progress toward a finished project." Progress language implies a defined endpoint; foresight work doesn't have one.

---

## Principle 6 — Nudges Respect Practitioner Rhythm

Nudges (email, in-app) are tools for surfacing genuine value, not for driving engagement metrics.

**Rules:**
- Nudges are **preferences, not defaults**. Practitioners configure what kinds of signals they want: new scanner candidates, idle project reminders, shared project views. The default state is no nudges until the practitioner opts in.
- Every nudge has a **lifespan**. If ignored twice, the nudge type is suppressed for that practitioner for 30 days minimum. Repeated ignored nudges are not re-sent.
- Nudges surface **specific, actionable information** — "7 new signals found for [Project Name], top match: [Title]" — not generic re-engagement copy.
- A nudge should never make a practitioner feel behind. The product serves their rhythm; they don't serve the product's.

---

## Principle 7 — Output Quality Is the Retention Mechanism

The behavioral interventions (nudges, progress indicators, onboarding sequence) get a practitioner to their first meaningful output. After that, output quality is what drives return visits.

A cluster summary that articulates a pattern the practitioner felt but couldn't express will end up in a client deck. A generic one won't. The difference between "this tool is interesting" and "this tool is part of my practice" is whether the AI outputs are sharp enough to put a professional name on.

**Implementation rule:** AI output quality is never a "nice to have." Prompt engineering, model selection, and output formatting for cluster summaries, scenario narratives, and analysis drafts are first-class implementation concerns — not polish. When there is a tradeoff between shipping a feature faster with lower AI output quality and shipping it slower with higher quality, the default is higher quality.

---

## Terminology Reference

Use these terms consistently across the product, code, and documentation.

| Correct | Never use |
|---|---|
| Input | Signal (as a generic term), Item, Entry |
| Cluster | Trend (as a generic term), Group, Theme |
| Project | Brief, Brief (as a noun for the creation form is fine as UI label only) |
| Focus | Unit of Analysis |
| System Map | Relationship Canvas, Map |
| Signal quality: Emerging / Established / Confirmed | Weak / Strong / Confirmed |
| Cluster subtypes: Trend / Driver / Tension | — |
| Input subtypes: Signal / Issue / Projection / Plan / Obstacle | — |
| Scenario archetypes: Continuation / Collapse / Constraint / Transformation | — |
| Four layers: Framing / Observation / Interpretation / Exploration | — |

---

## Quick Reference: Decision Rules for Claude Code

When making any implementation decision, check against these rules:

1. **Zero required fields.** No entity creation form should block on an empty field. Every field has a sensible default or can be left blank.

2. **Quick Start is the default.** Enhanced fields are always behind a toggle. Never open by default on first project creation.

3. **New fields are Enhanced unless proven otherwise.** If adding a field to a form, place it in Enhanced. Document the justification if promoting to Quick Start.

4. **AI outputs require practitioner action before they enter the record.** Pre-populate and suggest, but never silently apply. The practitioner confirms, edits, or promotes.

5. **No gate between stages.** A practitioner can navigate to any stage of their project at any time, regardless of whether earlier stages are "complete."

6. **Nudges have lifespans.** Any nudge implementation must include suppression logic: if ignored N times, suppress for 30 days.

7. **Re-entry surfaces answer "where was I and what's new?"** Dashboard and project headers are not completion trackers.

8. **Terminology is locked.** Use the terminology table above. Don't introduce synonyms.
