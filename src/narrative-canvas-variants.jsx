import { useState } from "react";

// ─── design tokens ─────────────────────────────────────────────────────────────
const c = {
  bg:"#f5f4f0", white:"#ffffff", ink:"#111111",
  muted:"#4a4a48", faint:"#767670", hint:"#767670",
  border:"rgba(0,0,0,0.10)", borderMid:"rgba(0,0,0,0.20)",
  surfaceAlt:"#f9f9f7", fieldBg:"#fafaf8",
  green50:"#EAF3DE", green700:"#3B6D11", greenBorder:"#C0DD97",
  blue50:"#E6F1FB",  blue700:"#185FA5",  blueBorder:"#B5D4F4",
  amber50:"#FAEEDA", amber700:"#854F0B", amberBorder:"#FAC775",
  purple50:"#F0EBFF", purple700:"#5B2D8E", purpleBorder:"#C4AEED",
  red50:"#FCEBEB",   red800:"#791F1F",   redBorder:"#F7C1C1",
};

const ST = {
  Driver:  { bg:c.green50,  color:c.green700,  border:c.greenBorder  },
  Context: { bg:c.blue50,   color:c.blue700,   border:c.blueBorder   },
  Barrier: { bg:c.amber50,  color:c.amber700,  border:c.amberBorder  },
  Tension: { bg:c.red50,    color:c.red800,    border:c.redBorder    },
};

// ─── seeded scenario data ──────────────────────────────────────────────────────
const SCENARIO = {
  title: "AI Futures — Collapse",
  archetype: "Collapse",
  horizon: "H2 · 2029–2033",
  question: "What if the AI hype bubble bursts and exposes a trust crisis in science and the creative industries?",
  stakeholders: ["Food manufacturers", "Agricultural investors", "Policy makers"],
};

const FORCES = [
  { label:"AI Trust",                         subtype:"Driver",  signals:7 },
  { label:"Battle for AI Safety",             subtype:"Context", signals:3 },
  { label:"AI Governance uneven progress",    subtype:"Barrier", signals:9 },
  { label:"AI hype-cycle bursting",           subtype:"Driver",  signals:5 },
  { label:"Communities push back",            subtype:"Barrier", signals:4 },
];

const TENSIONS = [
  "Public accountability vs. speed of AI deployment",
  "Open-source momentum vs. regulatory closure",
];

const SIGNALS = [
  { label:"Thousands of CEOs say AI had no productivity impact", strength:"Moderate" },
  { label:"Anthropic safety researcher warns of world 'in peril'", strength:"High"     },
  { label:"Communities push back on new data centers",            strength:"Moderate" },
  { label:"OpenAI deletes 'safely' from mission",                 strength:"High"     },
];

// ─── Panel definitions ─────────────────────────────────────────────────────────
// prompt_min = shortest version; prompt_full = full directional guidance
const PANELS = [
  {
    id:"world",
    icon:"◎",
    label:"The world that emerges",
    prompt_min:"Describe this future in plain language. What does it feel like to live and work here?",
    prompt_full:"Set the scene. What does this future look, feel, and sound like for the people inside it? Write in the present tense, as if you're already there. You don't need to explain how it happened — just describe what exists.",
    seeds: null,
    placeholder:"In the wake of the AI boom, research labs and design studios sit half-empty...",
  },
  {
    id:"forces",
    icon:"◉",
    label:"The forces at work",
    prompt_min:"What dynamics are shaping this world? Draw from the trends you mapped.",
    prompt_full:"What systemic forces created this future and continue to sustain it? Focus on the trends you mapped — how do they interact here? A collapse scenario might have very different force dynamics than a transformation.",
    seeds: "forces",
    placeholder:"The collapse was driven by a compounding of institutional failures...",
  },
  {
    id:"tensions",
    icon:"◈",
    label:"The tensions that define it",
    prompt_min:"What contradictions or unresolved conflicts give this world its texture?",
    prompt_full:"Every scenario has unresolved contradictions — things that push against each other. What fault lines exist here? These tensions create the texture of lived experience. Name them clearly.",
    seeds: "tensions",
    placeholder:"Between the efficiency gains of surviving AI systems and the widespread distrust...",
  },
  {
    id:"who",
    icon:"◆",
    label:"Who it affects and how",
    prompt_min:"Who wins, who loses, who adapts? Consider your named stakeholders.",
    prompt_full:"Scenarios affect different groups very differently. Using your stakeholders as anchors, describe who benefits, who is harmed, who is caught between. Avoid false universalism — specify.",
    seeds: "stakeholders",
    placeholder:"Agricultural investors who bet on AI-optimised supply chains face the steepest losses...",
  },
  {
    id:"watch",
    icon:"◎",
    label:"What to watch for",
    prompt_min:"What early indicators would signal this future is beginning to take shape?",
    prompt_full:"If this scenario were beginning to materialise, what would you see first? Draw from your weak signals. These become the practitioner's watchlist.",
    seeds: "signals",
    placeholder:"Watch for: Increasing retraction rates in AI-assisted research publications...",
  },
  {
    id:"implication",
    icon:"◉",
    label:"The strategic implication",
    prompt_min:"Given this future, what does it demand of your stakeholders now?",
    prompt_full:"This is the so-what. Given this scenario — given the forces, tensions, and affected parties — what strategic response does it demand? What would it mean to be prepared? What would it mean to be caught off-guard?",
    seeds: null,
    placeholder:"For food manufacturers, the implication is not to accelerate AI adoption but to build the institutional capacity to evaluate AI claims independently...",
  },
];

// ─── helpers ──────────────────────────────────────────────────────────────────
function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function Chip({ label, subtype, small }) {
  const st = ST[subtype] || { bg:"#f0f0ee", color:c.muted, border:c.border };
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:4,
      padding: small ? "1px 6px" : "2px 8px",
      borderRadius:4,
      fontSize: small ? 9 : 10,
      background:st.bg, color:st.color, border:`0.5px solid ${st.border}`,
    }}>{label}</span>
  );
}

// ─── VARIANT A: Minimal — reading-mode first, edit on focus ───────────────────
function MinimalPanel({ panel, idx, content, onChange }) {
  const [open, setOpen] = useState(idx === 0);
  const [focused, setFocused] = useState(false);
  const wc = wordCount(content);
  const filled = content.trim().length > 0;

  const renderSeeds = () => {
    if (!panel.seeds) return null;
    if (panel.seeds === "forces") {
      return (
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
          {FORCES.map((f, i) => <Chip key={i} label={f.label} subtype={f.subtype} small />)}
        </div>
      );
    }
    if (panel.seeds === "tensions") {
      return (
        <div style={{ display:"flex", flexDirection:"column", gap:3, marginBottom:10 }}>
          {TENSIONS.map((t, i) => (
            <div key={i} style={{ fontSize:10, color:c.muted, fontStyle:"italic" }}>— {t}</div>
          ))}
        </div>
      );
    }
    if (panel.seeds === "stakeholders") {
      return (
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:10 }}>
          {SCENARIO.stakeholders.map((s, i) => (
            <span key={i} style={{ fontSize:10, padding:"1px 7px", borderRadius:4, background:"#f0f0ee", color:c.muted }}>{s}</span>
          ))}
        </div>
      );
    }
    if (panel.seeds === "signals") {
      return (
        <div style={{ display:"flex", flexDirection:"column", gap:3, marginBottom:10 }}>
          {SIGNALS.slice(0,2).map((s, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:c.muted }}>
              <div style={{
                width:6, height:6, borderRadius:"50%", flexShrink:0,
                background: s.strength === "High" ? c.ink : c.hint
              }}/>
              {s.label}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{
      borderBottom: `0.5px solid ${c.border}`,
      transition:"background .15s",
    }}>
      {/* panel header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:"100%", padding:"12px 20px",
          display:"flex", alignItems:"center", gap:10,
          background:"transparent", border:"none", cursor:"pointer",
          textAlign:"left", fontFamily:"inherit",
        }}
      >
        <span style={{ fontSize:10, color:c.hint, width:12 }}>{open ? "▾" : "▸"}</span>
        <span style={{
          fontSize:12, fontWeight:500, color: filled ? c.ink : c.muted,
          flex:1
        }}>{panel.label}</span>
        {filled && (
          <span style={{ fontSize:10, color:c.hint }}>{wc}w</span>
        )}
        {!filled && (
          <span style={{ fontSize:10, color:c.hint, fontStyle:"italic" }}>optional</span>
        )}
      </button>

      {/* body */}
      {open && (
        <div style={{ padding:"0 20px 16px 42px" }}>
          {/* prompt — only show when not focused and nothing written */}
          {(!focused || !content) && (
            <div style={{ fontSize:11, color:c.hint, marginBottom:8, lineHeight:1.5, fontStyle:"italic" }}>
              {panel.prompt_min}
            </div>
          )}
          {/* seeds */}
          {renderSeeds()}
          {/* writing area */}
          <textarea
            value={content}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={panel.placeholder}
            rows={focused || content ? 5 : 3}
            style={{
              width:"100%", boxSizing:"border-box",
              padding:"9px 11px",
              border: focused
                ? `0.5px solid ${c.borderMid}`
                : content
                  ? `0.5px solid ${c.border}`
                  : `0.5px dashed ${c.hint}`,
              borderRadius:7, background: content ? c.white : "transparent",
              color:c.ink, fontSize:12, fontFamily:"inherit",
              outline:"none", resize:"none", lineHeight:1.6,
              transition:"all .2s",
            }}
          />
        </div>
      )}
    </div>
  );
}

function VariantMinimal() {
  const [content, setContent] = useState(
    Object.fromEntries(PANELS.map(p => [p.id, ""]))
  );
  const [showExport, setShowExport] = useState(false);
  const set = id => v => setContent(prev => ({...prev, [id]:v}));
  const filled = Object.values(content).filter(v => v.trim()).length;

  const toMarkdown = () => {
    let out = `# ${SCENARIO.title}\n\n`;
    out += `> ${SCENARIO.question}\n\n`;
    PANELS.forEach(p => {
      const c = content[p.id];
      if (c.trim()) {
        out += `## ${p.label}\n\n${c.trim()}\n\n`;
      }
    });
    return out.trim();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:c.white }}>
      {/* header */}
      <div style={{ padding:"12px 20px", borderBottom:`0.5px solid ${c.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:13, fontWeight:500, color:c.ink }}>{SCENARIO.title}</div>
          <div style={{ fontSize:10, color:c.hint, marginTop:1 }}>{SCENARIO.horizon} · {filled}/{PANELS.length} sections</div>
        </div>
        <button
          onClick={() => setShowExport(e => !e)}
          style={{ padding:"5px 12px", borderRadius:6, background:c.ink, border:"none", color:c.white, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}
        >Export</button>
      </div>

      {/* export dropdown */}
      {showExport && (
        <div style={{ padding:"10px 20px", borderBottom:`0.5px solid ${c.border}`, background:c.surfaceAlt, display:"flex", gap:6 }}>
          <button style={{ padding:"5px 12px", borderRadius:6, border:`0.5px solid ${c.borderMid}`, background:c.white, color:c.muted, fontSize:11, cursor:"pointer" }}>
            ↓ Markdown
          </button>
          <button style={{ padding:"5px 12px", borderRadius:6, border:`0.5px solid ${c.borderMid}`, background:c.white, color:c.muted, fontSize:11, cursor:"pointer" }}>
            ↓ PDF
          </button>
          <div style={{ fontSize:10, color:c.hint, marginLeft:4, lineHeight:1.4, alignSelf:"center" }}>
            {filled === 0 ? "Write at least one section to export." : `${filled} sections will be included.`}
          </div>
        </div>
      )}

      {/* panels */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {PANELS.map((p, i) => (
          <MinimalPanel key={p.id} panel={p} idx={i} content={content[p.id]} onChange={set(p.id)} />
        ))}
        {/* trailing space */}
        <div style={{ height:40 }}/>
      </div>
    </div>
  );
}

// ─── VARIANT B: Maximal — always-on structure, rich context cards ─────────────
function ContextCard({ label, meta, subtype }) {
  return (
    <div style={{
      display:"flex", alignItems:"flex-start", gap:6,
      padding:"6px 8px", borderRadius:6,
      border:`0.5px solid ${c.border}`, background:c.white,
      marginBottom:4,
    }}>
      {subtype && (
        <div style={{
          width:6, height:6, borderRadius:"50%", flexShrink:0, marginTop:3,
          background: ST[subtype]?.color || c.hint,
        }}/>
      )}
      <div style={{ flex:1 }}>
        <div style={{ fontSize:10, color:c.ink, lineHeight:1.4 }}>{label}</div>
        {meta && <div style={{ fontSize:9, color:c.hint, marginTop:1 }}>{meta}</div>}
      </div>
    </div>
  );
}

function MaximalPanel({ panel, idx, content, onChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const wc = wordCount(content);
  const filled = content.trim().length > 0;

  const renderContextCards = () => {
    if (panel.seeds === "forces") {
      return FORCES.map((f, i) => (
        <ContextCard key={i} label={f.label} meta={`${f.subtype} · ${f.signals} signals`} subtype={f.subtype} />
      ));
    }
    if (panel.seeds === "tensions") {
      return TENSIONS.map((t, i) => <ContextCard key={i} label={t} />);
    }
    if (panel.seeds === "stakeholders") {
      return SCENARIO.stakeholders.map((s, i) => <ContextCard key={i} label={s} />);
    }
    if (panel.seeds === "signals") {
      return SIGNALS.map((s, i) => (
        <ContextCard key={i} label={s.label} meta={`${s.strength} strength`} />
      ));
    }
    return null;
  };

  return (
    <div style={{
      display:"grid",
      gridTemplateColumns: panel.seeds ? "180px 1fr" : "1fr",
      borderBottom:`0.5px solid ${c.border}`,
      minHeight: collapsed ? 0 : "auto",
    }}>
      {/* left: context cards */}
      {panel.seeds && !collapsed && (
        <div style={{
          borderRight:`0.5px solid ${c.border}`,
          padding:"14px 12px",
          background:c.surfaceAlt,
        }}>
          <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:".07em", color:c.hint, marginBottom:6 }}>
            From your scenario
          </div>
          {renderContextCards()}
        </div>
      )}

      {/* right: writing surface */}
      <div style={{ padding:"14px 16px" }}>
        <div style={{
          display:"flex", alignItems:"center", gap:8, marginBottom:8
        }}>
          <button
            onClick={() => setCollapsed(o => !o)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:0, color:c.hint, fontSize:11 }}
          >{collapsed ? "▸" : "▾"}</button>
          <span style={{ fontSize:12, fontWeight:500, color:c.ink }}>{panel.label}</span>
          {!collapsed && filled && (
            <span style={{ fontSize:10, color:c.hint, marginLeft:"auto" }}>{wc}w</span>
          )}
          {!collapsed && !filled && (
            <span style={{ fontSize:10, color:c.hint, fontStyle:"italic", marginLeft:"auto" }}>optional</span>
          )}
        </div>

        {!collapsed && (
          <>
            {/* full prompt */}
            <div style={{
              fontSize:11, color:c.hint, lineHeight:1.55, marginBottom:9,
              padding:"7px 10px", borderRadius:5,
              background:"#f5f4f0", fontStyle:"italic",
            }}>
              {panel.prompt_full}
            </div>

            {/* for "no seeds" panels, show inline context */}
            {!panel.seeds && panel.id === "world" && (
              <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:9, color:c.hint, textTransform:"uppercase", letterSpacing:".07em", marginBottom:4 }}>Central question</div>
                <div style={{ fontSize:10, color:c.muted, fontStyle:"italic", padding:"5px 8px", borderRadius:5, background:c.surfaceAlt, lineHeight:1.5 }}>
                  {SCENARIO.question}
                </div>
              </div>
            )}

            {!panel.seeds && panel.id === "implication" && (
              <div style={{ marginBottom:8, display:"flex", flexWrap:"wrap", gap:4 }}>
                {SCENARIO.stakeholders.map((s, i) => (
                  <span key={i} style={{ fontSize:10, padding:"2px 7px", borderRadius:4, background:"#f0f0ee", color:c.muted }}>{s}</span>
                ))}
              </div>
            )}

            <textarea
              value={content}
              onChange={e => onChange(e.target.value)}
              placeholder={panel.placeholder}
              rows={5}
              style={{
                width:"100%", boxSizing:"border-box",
                padding:"9px 11px",
                border:`0.5px solid ${c.borderMid}`,
                borderRadius:7, background:c.white,
                color:c.ink, fontSize:12, fontFamily:"inherit",
                outline:"none", resize:"vertical", lineHeight:1.6,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

function VariantMaximal() {
  const [content, setContent] = useState(
    Object.fromEntries(PANELS.map(p => [p.id, ""]))
  );
  const [showExport, setShowExport] = useState(false);
  const set = id => v => setContent(prev => ({...prev, [id]:v}));
  const filled = Object.values(content).filter(v => v.trim()).length;
  const totalWords = Object.values(content).reduce((sum, v) => sum + wordCount(v), 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:c.white }}>
      {/* header */}
      <div style={{ padding:"10px 16px", borderBottom:`0.5px solid ${c.border}`, background:c.surfaceAlt, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:c.ink }}>{SCENARIO.title}</div>
            <div style={{ fontSize:10, color:c.hint, marginTop:1 }}>{SCENARIO.horizon}</div>
          </div>
          <span style={{ fontSize:10, padding:"2px 7px", borderRadius:4, background:c.red50, color:c.red800, border:`0.5px solid ${c.redBorder}` }}>
            {SCENARIO.archetype}
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ fontSize:10, color:c.hint }}>{filled}/{PANELS.length} sections · {totalWords}w</div>
          <div style={{ position:"relative" }}>
            <button
              onClick={() => setShowExport(e => !e)}
              style={{ padding:"6px 12px", borderRadius:6, background:c.ink, border:"none", color:c.white, fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:5 }}
            >↓ Export</button>
            {showExport && (
              <div style={{
                position:"absolute", right:0, top:"calc(100% + 4px)", zIndex:10,
                background:c.white, border:`0.5px solid ${c.borderMid}`, borderRadius:7,
                padding:8, minWidth:140,
                boxShadow:"0 4px 16px rgba(0,0,0,.1)",
              }}>
                {[["↓  Markdown",".md"],["↓  PDF",".pdf"]].map(([label, ext]) => (
                  <div key={ext} style={{
                    padding:"7px 10px", borderRadius:5, cursor:"pointer",
                    fontSize:11, color:c.muted,
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                  }}>
                    <span>{label}</span>
                    <span style={{ color:c.hint }}>{ext}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* canvas */}
      <div style={{ flex:1, overflowY:"auto" }}>
        {PANELS.map((p, i) => (
          <MaximalPanel key={p.id} panel={p} idx={i} content={content[p.id]} onChange={set(p.id)} />
        ))}
        <div style={{ height:40 }}/>
      </div>
    </div>
  );
}

// ─── pros / cons ──────────────────────────────────────────────────────────────
const PC = {
  minimal: {
    pros: [
      "Collapsed by default: the page loads clean, reducing the 'six blank boxes' intimidation effect.",
      "Dashed writing area before focus signals optionality without a separate badge — you skip it by not opening it.",
      "Prompt appears inline above the textarea, in context, rather than in a separate instructions zone.",
      "Seeds (trends, tensions, signals) appear only when the panel is open and relevant — no visual noise from closed panels.",
    ],
    cons: [
      "Collapsed panels hide all context, so practitioners can't see the full shape of what they've written without scrolling and expanding.",
      "The seeded context cards are not easily scannable across panels — forces, tensions, and stakeholders are buried one accordion open away.",
      "Word count and completeness are only visible per-panel; no aggregate signal of how substantial the narrative is overall.",
      "No visible structure guide — a practitioner new to the framework may not know what the six panels collectively add up to.",
    ],
    note: "Lowest friction path for experienced practitioners who know where they're going. Riskier for newer practitioners who need the structure to feel coherent, not just available.",
  },
  maximal: {
    pros: [
      "Context cards are always visible in the left column — forces, stakeholders, and signals are scaffolding, not hidden inputs.",
      "Full directional prompt visible before writing begins — reduces blank-page anxiety and sets interpretive direction.",
      "Word count and section count in the header give a running sense of narrative weight and completeness.",
      "Two-column layout separates 'what you captured' from 'what you interpret' — making the practitioner's contribution distinct.",
    ],
    cons: [
      "Context cards take 180px of horizontal space for every panel — significant on narrower screens or when the user is past the seeding phase.",
      "Full prompt visible at all times may feel prescriptive to confident writers who want to work without guidance.",
      "Six always-expanded panels on load is a long scroll; collapsing them individually is management overhead.",
      "Two-column layout breaks down for panels without context seeds — the implication and world panels render as single columns and feel inconsistent.",
    ],
    note: "Strong for first-time through a scenario. As practitioners become fluent with the framework, the always-on guidance may feel like scaffolding they've outgrown. Consider making prompt detail collapsible or respecting a 'compact mode' preference.",
  },
};

function ProsConsPanel({ variant }) {
  const p = PC[variant];
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:16 }}>
      <div style={{ background:c.green50, border:`0.5px solid ${c.greenBorder}`, borderRadius:10, padding:"14px 16px" }}>
        <div style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:".07em", color:c.green700, marginBottom:8 }}>Strengths</div>
        <ul style={{ paddingLeft:16, margin:0 }}>
          {p.pros.map((t, i) => <li key={i} style={{ fontSize:12, color:c.green700, lineHeight:1.6, marginBottom:4 }}>{t}</li>)}
        </ul>
      </div>
      <div style={{ background:c.red50, border:`0.5px solid ${c.redBorder}`, borderRadius:10, padding:"14px 16px" }}>
        <div style={{ fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:".07em", color:c.red800, marginBottom:8 }}>Risks</div>
        <ul style={{ paddingLeft:16, margin:0 }}>
          {p.cons.map((t, i) => <li key={i} style={{ fontSize:12, color:c.red800, lineHeight:1.6, marginBottom:4 }}>{t}</li>)}
        </ul>
      </div>
      <div style={{ gridColumn:"1 / -1", padding:"12px 16px", borderRadius:8, border:`0.5px solid rgba(0,0,0,.20)`, background:c.bg, fontSize:12, color:c.muted, lineHeight:1.6 }}>
        <strong style={{ color:c.ink, fontWeight:500 }}>Design note — </strong>{p.note}
      </div>
    </div>
  );
}

// ─── VARIANT C: Spatial — BMC-style grid canvas ───────────────────────────────
//
// Grid template areas:
//   forces   │  world  │  who
//   tensions │  world  │  impl
//   ──────────────────────────
//   watch (full width)
//
// Left column = inputs / causes
// Centre      = the scenario itself (spans two rows — it is the narrative core)
// Right column = effects / outputs
// Bottom row  = watchlist (the forward-looking layer)

const SPATIAL_CELLS = [
  {
    id:"forces",
    area:"forces",
    icon:"◉",
    label:"Forces at work",
    seeds:"forces",
    prompt:"What systemic forces created this future?",
    placeholder:"The collapse was driven by a compounding of institutional failures...",
  },
  {
    id:"world",
    area:"world",
    icon:"◎",
    label:"The world that emerges",
    seeds:"question",
    prompt:"Set the scene. What does this future look and feel like?",
    placeholder:"In the wake of the AI boom, research labs and design studios sit half-empty...",
  },
  {
    id:"who",
    area:"who",
    icon:"◆",
    label:"Who it affects",
    seeds:"stakeholders",
    prompt:"Who wins, who loses, who adapts?",
    placeholder:"Agricultural investors who bet on AI-optimised supply chains face the steepest losses...",
  },
  {
    id:"tensions",
    area:"tensions",
    icon:"◈",
    label:"Tensions that define it",
    seeds:"tensions",
    prompt:"What contradictions give this world its texture?",
    placeholder:"Between the efficiency gains of surviving AI systems and widespread distrust...",
  },
  {
    id:"impl",
    area:"impl",
    icon:"◉",
    label:"Strategic implication",
    seeds:"stakeholders",
    prompt:"What does this future demand of your stakeholders now?",
    placeholder:"For food manufacturers, the implication is not to accelerate AI adoption but...",
  },
  {
    id:"watch",
    area:"watch",
    icon:"◎",
    label:"What to watch for",
    seeds:"signals",
    prompt:"What early indicators signal this future is beginning to take shape?",
    placeholder:"Rising retraction rates in AI-assisted research · Increasing public AI audits · Defensive policy positioning by tech majors",
  },
];

function SpatialCell({ cell, content, onChange, selected, onSelect }) {
  const isFocused = selected === cell.id;

  const renderSeeds = (compact) => {
    if (cell.seeds === "forces") return (
      <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:compact?4:6 }}>
        {FORCES.map((f, i) => {
          const st = ST[f.subtype] || {};
          return (
            <span key={i} style={{ fontSize:8, padding:"1px 5px", borderRadius:3, background:st.bg||"#f0f0ee", color:st.color||c.muted, border:`0.5px solid ${st.border||c.border}`, lineHeight:1.4 }}>
              {f.label}
            </span>
          );
        })}
      </div>
    );
    if (cell.seeds === "stakeholders") return (
      <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:compact?4:6 }}>
        {SCENARIO.stakeholders.map((s, i) => (
          <span key={i} style={{ fontSize:8, padding:"1px 5px", borderRadius:3, background:"#f0f0ee", color:c.muted, lineHeight:1.4 }}>{s}</span>
        ))}
      </div>
    );
    if (cell.seeds === "tensions") return (
      <div style={{ marginBottom:compact?4:6 }}>
        {TENSIONS.map((t, i) => (
          <div key={i} style={{ fontSize:8, color:c.muted, fontStyle:"italic", lineHeight:1.4, marginBottom:1 }}>— {t}</div>
        ))}
      </div>
    );
    if (cell.seeds === "signals") return (
      <div style={{ display:"flex", flexWrap:"wrap", gap:3, marginBottom:compact?4:6 }}>
        {SIGNALS.map((s, i) => (
          <span key={i} style={{ fontSize:8, padding:"1px 5px", borderRadius:3, background:c.surfaceAlt, color:c.muted, border:`0.5px solid ${c.border}`, lineHeight:1.4 }}>
            {s.label}
          </span>
        ))}
      </div>
    );
    if (cell.seeds === "question") return (
      <div style={{ fontSize:8, color:c.muted, fontStyle:"italic", lineHeight:1.45, marginBottom:compact?4:6 }}>
        {SCENARIO.question}
      </div>
    );
    return null;
  };

  return (
    <div
      onClick={() => onSelect(cell.id)}
      style={{
        gridArea: cell.area,
        border: `0.5px solid ${isFocused ? c.ink : c.borderMid}`,
        borderRadius: 7,
        background: c.white,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        outline: isFocused ? `2px solid ${c.ink}` : "none",
        outlineOffset: 2,
        transition: "border-color .15s, outline .15s",
        cursor: "default",
        position: "relative",
      }}
    >
      {/* cell header */}
      <div style={{
        padding: "7px 9px 5px",
        borderBottom: `0.5px solid ${c.border}`,
        background: isFocused ? c.ink : c.surfaceAlt,
        display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
        transition: "background .15s",
      }}>
        <span style={{ fontSize:9, color: isFocused ? "rgba(255,255,255,.5)" : c.hint }}>{cell.icon}</span>
        <span style={{ fontSize:10, fontWeight:500, color: isFocused ? c.white : c.ink, letterSpacing:".01em" }}>
          {cell.label}
        </span>
        {content.trim() && (
          <span style={{ marginLeft:"auto", fontSize:8, color: isFocused ? "rgba(255,255,255,.4)" : c.hint }}>
            {content.trim().split(/\s+/).length}w
          </span>
        )}
      </div>

      {/* seeds — shown when focused or no content written */}
      {(isFocused || !content.trim()) && (
        <div style={{ padding:"5px 8px 0", flexShrink:0 }}>
          {isFocused && (
            <div style={{ fontSize:8, color:c.hint, fontStyle:"italic", lineHeight:1.45, marginBottom:4 }}>
              {cell.prompt}
            </div>
          )}
          {renderSeeds(!isFocused)}
        </div>
      )}

      {/* writing area */}
      <textarea
        value={content}
        onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
        onClick={e => e.stopPropagation()}
        onFocus={() => onSelect(cell.id)}
        placeholder={cell.placeholder}
        style={{
          flex: 1,
          width: "100%",
          boxSizing: "border-box",
          padding: "5px 9px 7px",
          border: "none",
          background: "transparent",
          color: c.ink,
          fontSize: 10,
          fontFamily: "inherit",
          outline: "none",
          resize: "none",
          lineHeight: 1.6,
          cursor: "text",
        }}
      />
    </div>
  );
}

function VariantSpatial() {
  const [content, setContent] = useState(Object.fromEntries(SPATIAL_CELLS.map(p => [p.id, ""])));
  const [selected, setSelected] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const set = id => v => setContent(prev => ({...prev, [id]:v}));
  const filled = Object.values(content).filter(v => v.trim()).length;
  const totalWords = Object.values(content).reduce((sum, v) => sum + (v.trim() ? v.trim().split(/\s+/).length : 0), 0);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:c.white }}>
      {/* header */}
      <div style={{ padding:"8px 14px", borderBottom:`0.5px solid ${c.border}`, background:c.surfaceAlt, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:13, fontWeight:500, color:c.ink }}>{SCENARIO.title}</span>
          <span style={{ fontSize:10, padding:"2px 7px", borderRadius:4, background:c.red50, color:c.red800, border:`0.5px solid ${c.redBorder}` }}>{SCENARIO.archetype}</span>
          <span style={{ fontSize:10, color:c.hint }}>{SCENARIO.horizon}</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:10, color:c.hint }}>{filled}/{SPATIAL_CELLS.length} · {totalWords}w</span>
          <div style={{ position:"relative" }}>
            <button
              onClick={() => setShowExport(e => !e)}
              style={{ padding:"5px 11px", borderRadius:6, background:c.ink, border:"none", color:c.white, fontSize:11, fontWeight:500, cursor:"pointer", fontFamily:"inherit" }}
            >↓ Export</button>
            {showExport && (
              <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)", zIndex:10, background:c.white, border:`0.5px solid ${c.borderMid}`, borderRadius:7, padding:8, minWidth:130, boxShadow:"0 4px 16px rgba(0,0,0,.1)" }}>
                {[["↓  Markdown",".md"],["↓  PDF",".pdf"]].map(([label, ext]) => (
                  <div key={ext} style={{ padding:"7px 10px", borderRadius:5, cursor:"pointer", fontSize:11, color:c.muted, display:"flex", justifyContent:"space-between" }}>
                    <span>{label}</span><span style={{ color:c.hint }}>{ext}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* spatial grid */}
      <div
        onClick={() => setSelected(null)}
        style={{
          flex: 1,
          padding: "10px",
          display: "grid",
          gridTemplateAreas: `"forces world who" "tensions world impl" "watch watch watch"`,
          gridTemplateColumns: "1fr 1.5fr 1fr",
          gridTemplateRows: "1fr 1fr 88px",
          gap: "7px",
          overflow: "hidden",
        }}
      >
        {SPATIAL_CELLS.map(cell => (
          <SpatialCell
            key={cell.id}
            cell={cell}
            content={content[cell.id]}
            onChange={set(cell.id)}
            selected={selected}
            onSelect={setSelected}
          />
        ))}
      </div>

      {/* legend row */}
      <div style={{
        padding:"5px 14px",
        borderTop:`0.5px solid ${c.border}`,
        background:c.surfaceAlt,
        display:"flex", alignItems:"center", gap:14,
        fontSize:9, color:c.hint, flexShrink:0,
      }}>
        <span>← Causes</span>
        <span style={{ flex:1, textAlign:"center" }}>Core narrative</span>
        <span>Effects →</span>
      </div>
    </div>
  );
}

// ─── nav sidebar ──────────────────────────────────────────────────────────────
function NavSidebar() {
  return (
    <div style={{ padding:"20px 0", borderRight:`0.5px solid ${c.border}`, background:c.surfaceAlt }}>
      <div style={{ display:"flex", alignItems:"center", gap:7, padding:"0 16px 18px", fontSize:13, fontWeight:500, color:c.ink, borderBottom:`0.5px solid ${c.border}`, marginBottom:12 }}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:c.ink }}/>Future Signals
      </div>
      {[["⌂","Dashboard",false],["◻","Projects",false],["◈","Inbox",false]].map(([ico, lbl]) => (
        <div key={lbl} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 16px", fontSize:12, color:c.hint }}>
          <span style={{ fontSize:11, width:14, textAlign:"center" }}>{ico}</span>{lbl}
        </div>
      ))}
      <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".08em", color:c.hint, padding:"12px 16px 4px" }}>Library</div>
      {[["◎","Inputs"],["◉","Clusters"],["◆","Scenarios"]].map(([ico, lbl]) => (
        <div key={lbl} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 16px", fontSize:12, color: lbl === "Scenarios" ? c.ink : c.hint, fontWeight: lbl === "Scenarios" ? 500 : 400, background: lbl === "Scenarios" ? c.white : "transparent", borderRight: lbl === "Scenarios" ? `2px solid ${c.ink}` : "none" }}>
          <span style={{ fontSize:11, width:14, textAlign:"center" }}>{ico}</span>{lbl}
        </div>
      ))}
    </div>
  );
}

// ─── root ─────────────────────────────────────────────────────────────────────
// Add spatial to PC
PC.spatial = {
  pros: [
    "Full narrative shape is legible at a glance — practitioners see all six panels simultaneously without scrolling.",
    "Spatial topology makes causal logic visible: Forces → World → Who it affects reads left-to-right as a chain, not an arbitrary list.",
    "Mirrors workshop and whiteboard conventions — a familiar spatial metaphor for practitioners who think on canvas.",
    "The world that emerges occupying the centre and spanning both rows encodes its primacy in the structure itself.",
  ],
  cons: [
    "Fixed cell sizes constrain writing — a practitioner who writes 300+ words in any cell can't read it without scrolling within the cell.",
    "Seeds (forces, tensions, stakeholders) compete for space with the writing area in compact cells — especially tight in the left column.",
    "Spatial topology is not self-evident on first encounter — practitioners need to internalise the grid logic before it pays off.",
    "Long-form narrative work is poorly served: the BMC metaphor optimises for overview and structure, not for the actual writing act.",
  ],
  note: "Most valuable as a structuring entry point — use the spatial canvas to establish the shape of the narrative, then drop into the accordion or scaffolded view for detailed writing. Spatial and list views could coexist as display modes rather than competing approaches.",
};

const VARIANTS = [
  { id:"minimal",  label:"A — Accordion",      sub:"Panels collapsed by default. Seeds and prompt appear inside the open panel. Dashed border signals optional, unfilled state." },
  { id:"maximal",  label:"B — Scaffolded",     sub:"Always-expanded panels. Seeded context cards in a persistent left column. Full directional prompts always visible. Word count in header." },
  { id:"spatial",  label:"C — Spatial canvas", sub:"BMC-style grid. Forces and tensions on the left, the scenario world in the centre, effects and implications on the right. Causal logic is spatial." },
];

export default function App() {
  const [variant, setVariant] = useState("minimal");
  const v = VARIANTS.find(x => x.id === variant);
  const vBtnBase = { padding:"8px 16px", borderRadius:8, fontSize:13, border:`0.5px solid rgba(0,0,0,0.20)`, background:c.white, color:c.muted, cursor:"pointer", fontFamily:"inherit" };
  const vBtnOn   = { ...vBtnBase, background:c.ink, color:c.white, borderColor:c.ink };

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", background:c.bg, minHeight:"100vh", padding:"28px 20px", color:c.ink }}>
      <div style={{ maxWidth:880, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:15, fontWeight:500, color:c.ink, marginBottom:2 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:c.ink }}/>Future Signals
        </div>
        <div style={{ fontSize:11, color:c.hint, textTransform:"uppercase", letterSpacing:".08em", marginBottom:24 }}>
          Scenario Narrative Canvas — design prototype · March 2026
        </div>

        <div style={{ fontSize:11, color:c.hint, textTransform:"uppercase", letterSpacing:".07em", marginBottom:8 }}>Variant</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
          {VARIANTS.map(vv => (
            <button key={vv.id} style={variant === vv.id ? vBtnOn : vBtnBase} onClick={() => setVariant(vv.id)}>{vv.label}</button>
          ))}
        </div>
        <div style={{ fontSize:13, color:c.muted, marginBottom:20, paddingLeft:2 }}>{v.sub}</div>

        <div style={{
          display:"grid", gridTemplateColumns:"190px 1fr",
          border:`0.5px solid ${c.border}`, borderRadius:12,
          overflow:"hidden", height:540,
          boxShadow:"0 2px 20px rgba(0,0,0,.07)"
        }}>
          <NavSidebar />
          <div style={{ overflow:"hidden", height:"100%" }}>
            {variant === "minimal" && <VariantMinimal key="min" />}
            {variant === "maximal" && <VariantMaximal key="max" />}
            {variant === "spatial" && <VariantSpatial key="spa" />}
          </div>
        </div>

        <ProsConsPanel key={variant} variant={variant} />
      </div>
    </div>
  );
}
