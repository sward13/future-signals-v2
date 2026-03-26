import { useState, useEffect } from "react";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const c = {
  bg:"#f5f4f0", white:"#ffffff", ink:"#111111",
  muted:"#666666", faint:"#aaaaaa", hint:"#c4c3bc",
  border:"rgba(0,0,0,0.09)", borderMid:"rgba(0,0,0,0.18)",
  surfaceAlt:"#f9f9f7", fieldBg:"#fafaf8", canvas:"#f7f6f2",
  green50:"#EAF3DE", green700:"#3B6D11", greenBorder:"#C0DD97",
  blue50:"#E6F1FB",  blue700:"#185FA5",  blueBorder:"#B5D4F4",
  amber50:"#FAEEDA", amber700:"#854F0B", amberBorder:"#FAC775",
  violet50:"#F0EAFA",violet700:"#5B21B6",violetBorder:"#C4B5FD",
  cyan50:"#E0F9F9",  cyan700:"#0E7490",  cyanBorder:"#A5F3FC",
  red50:"#FCEBEB",   red800:"#791F1F",   redBorder:"#F7C1C1",
  teal50:"#E6FFFA",  teal700:"#0F766E",  tealBorder:"#5EEAD4",
};

// ─── Shared style primitives ────────────────────────────────────────────────────
const inp  = { width:"100%", padding:"9px 11px", border:`1px solid ${c.borderMid}`, borderRadius:8, background:c.white, color:c.ink, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" };
const ta   = { ...inp, resize:"none", lineHeight:1.55 };
const sel  = { ...inp, appearance:"none" };
const btnP = { padding:"10px 22px", borderRadius:8, background:c.ink, color:c.white, border:"none", fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"inherit" };
const btnSm= { padding:"7px 16px", borderRadius:7, background:c.ink, color:c.white, border:"none", fontSize:12, fontWeight:500, cursor:"pointer", fontFamily:"inherit" };
const btnSec={ padding:"9px 18px", borderRadius:8, background:"transparent", color:c.muted, border:`1px solid ${c.borderMid}`, fontSize:13, cursor:"pointer", fontFamily:"inherit" };
const btnG = { padding:"7px 12px", borderRadius:7, background:"transparent", color:c.muted, border:"none", fontSize:12, cursor:"pointer", fontFamily:"inherit" };
const fl   = { fontSize:12, fontWeight:500, color:c.ink, marginBottom:5, display:"flex", alignItems:"center", gap:6 };
const fh   = { fontSize:11, color:c.hint, marginBottom:6, fontStyle:"italic", lineHeight:1.45 };
const badg = { fontSize:10, padding:"1px 6px", borderRadius:4, background:"#f0f0ee", color:c.faint };

// ─── Sample data ────────────────────────────────────────────────────────────────
const PROJ = {
  name:"AI Governance & Trust",
  domain:"Technology & AI",
  question:"How might declining public trust in AI reshape governance frameworks and innovation timelines by 2035?",
  unit:"AI regulatory frameworks and public trust indicators",
  geo:"Global — US, EU, China focus",
  h1a:"2025",h1b:"2028",h2a:"2029",h2b:"2033",h3a:"2034",h3b:"2040",
  assumptions:"AI capabilities continue to advance; geopolitical competition over AI persists.",
  stakeholders:"Policy makers, AI labs, civil society organisations",
};

const INPUTS = [
  { id:1, name:"EU AI Act enters full enforcement phase", desc:"The EU AI Act's high-risk provisions are now fully enforceable, creating compliance pressure for global AI deployers and reshaping product development timelines.", url:"https://ec.europa.eu/ai-act", cats:["Political","Legal"], str:"High", h:"H1" },
  { id:2, name:"Anthropic removes 'safely' from mission", desc:"An AI safety lab removes explicit safety language from public mission, signalling shifting priorities across commercial AI development.", url:"https://anthropic.com", cats:["Technological","Social"], str:"Weak", h:"H1" },
  { id:3, name:"China mandates AI-generated content labelling", desc:"New regulation requires all AI-generated media to carry visible labels, advancing transparency norms in the world's largest AI deployment market.", url:"https://reuters.com", cats:["Political","Technological"], str:"Moderate", h:"H1" },
  { id:4, name:"Public trust in AI drops 18 points globally", desc:"Edelman Trust Barometer finds major drop in AI institutional confidence across 27 countries, particularly among 25–34 age group.", url:"https://edelman.com", cats:["Social"], str:"Moderate", h:"H2" },
];

const CLUSTERS = [
  { id:1, name:"Regulatory fragmentation", sub:"Trend", h:"H2", iids:[1,3], desc:"Diverging national AI governance frameworks create compliance complexity and market fragmentation across jurisdictions." },
  { id:2, name:"Institutional trust erosion", sub:"Trend", h:"H1", iids:[2,4], desc:"Declining public and institutional confidence in AI systems, developers, and oversight bodies." },
  { id:3, name:"Geopolitical AI competition", sub:"Driver", h:"H3", iids:[], desc:"State-level competition for AI dominance shapes standards, access norms, and deployment constraints globally." },
];

const SCENARIOS = [
  { id:1, name:"The Governance Chasm", arch:"Collapse", h:"H2", cids:[1,2], x:12, y:52, tag:"Divergence · 2029–2033", narrative:"Fragmented regulation and collapsing public trust create a two-speed world. A tightly governed EU AI zone imposes stringent compliance requirements while a deregulated fringe sees innovation racing ahead without guardrails. Multinational firms face impossible compliance matrices, driving them to restructure around jurisdictional arbitrage rather than genuine safety investment. Public confidence continues to erode as high-profile failures accumulate." },
  { id:2, name:"Coordinated Restraint",  arch:"Discipline", h:"H3", cids:[1,3], x:55, y:20, tag:"Alignment · 2034–2040", narrative:"A series of high-stakes AI incidents finally catalyse international treaty frameworks, trading innovation speed for alignment on safety and access standards. A 'Digital Geneva Convention' emerges, with major powers agreeing on minimum safety standards, liability frameworks, and access provisions for lower-income nations. Compliance regimes become deeply embedded in institutional practice." },
  { id:3, name:"Platform Capture",       arch:"Growth",    h:"H2", cids:[3],   x:60, y:65, tag:"Consolidation · 2029–2033", narrative:"Two or three dominant AI platform providers effectively capture governance, setting technical standards that nations eventually adopt wholesale. Private power substitutes for public policy as speed and scale advantages compound. Regulatory capture is near-total; meaningful oversight exists only within the platforms' own interest." },
  { id:4, name:"Fractured Commons",      arch:"Transformation", h:"H3", cids:[2,3], x:14, y:16, tag:"Pluralism · 2034–2040", narrative:"AI development fractures along cultural and political lines with no single standard prevailing. Multiple coexisting AI ecosystems emerge with incompatible norms, data regimes, and safety assumptions. Cross-system communication requires translation layers. Some regions develop genuinely distinct value-aligned AI; others see regulatory voids exploited." },
];

const DOMAINS = ["Technology & AI","Climate & Energy","Health & Life Sciences","Government & Policy","Economy & Finance","Education & Learning","Media & Culture","Defence & Security","Custom / Other"];
const STEEPLED = ["Social","Technological","Economic","Environmental","Political","Legal","Ethical","Demographic"];

// ─── Shared sub-components ──────────────────────────────────────────────────────
function Tag({ label, color, bg, border }) {
  return <span style={{ fontSize:10, padding:"2px 7px", borderRadius:10, background:bg, color, border:`1px solid ${border}`, display:"inline-flex", alignItems:"center", whiteSpace:"nowrap" }}>{label}</span>;
}

function StrengthDot({ str }) {
  const map = { High:[c.green700,c.green50,c.greenBorder], Moderate:[c.amber700,c.amber50,c.amberBorder], Weak:[c.red800,c.red50,c.redBorder] };
  const [col, bg, brd] = map[str] || [c.hint,"transparent",c.border];
  return <Tag label={str} color={col} bg={bg} border={brd}/>;
}

function HorizTag({ h }) {
  const map = { H1:[c.green700,c.green50,c.greenBorder], H2:[c.blue700,c.blue50,c.blueBorder], H3:[c.amber700,c.amber50,c.amberBorder] };
  const [col, bg, brd] = map[h] || [c.hint,"transparent",c.border];
  return <Tag label={h} color={col} bg={bg} border={brd}/>;
}

function ArchTag({ arch }) {
  const map = { Collapse:[c.red800,c.red50,c.redBorder], Discipline:[c.blue700,c.blue50,c.blueBorder], Growth:[c.green700,c.green50,c.greenBorder], Transformation:[c.amber700,c.amber50,c.amberBorder] };
  const [col, bg, brd] = map[arch] || [c.hint,"transparent",c.border];
  return <Tag label={arch} color={col} bg={bg} border={brd}/>;
}

function SubtypeTag({ sub }) {
  const map = { Trend:[c.violet700,c.violet50,c.violetBorder], Driver:[c.cyan700,c.cyan50,c.cyanBorder], Tension:[c.amber700,c.amber50,c.amberBorder] };
  const [col, bg, brd] = map[sub] || [c.hint,"transparent",c.border];
  return <Tag label={sub} color={col} bg={bg} border={brd}/>;
}

function HBlock({ label, col, a, b, pa, pb }) {
  return (
    <div style={{ border:`1px solid ${c.border}`, borderRadius:8, padding:"10px 12px", background:c.fieldBg }}>
      <div style={{ fontSize:10, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.07em", color:col, marginBottom:6 }}>{label}</div>
      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
        <input style={{ width:50, padding:"5px 7px", border:`1px solid rgba(0,0,0,.18)`, borderRadius:6, fontSize:12, textAlign:"center", background:c.white, color:c.ink, fontFamily:"inherit", outline:"none" }} type="text" defaultValue={a} placeholder={pa}/>
        <span style={{ fontSize:11, color:c.hint }}>–</span>
        <input style={{ width:50, padding:"5px 7px", border:`1px solid rgba(0,0,0,.18)`, borderRadius:6, fontSize:12, textAlign:"center", background:c.white, color:c.ink, fontFamily:"inherit", outline:"none" }} type="text" defaultValue={b} placeholder={pb}/>
      </div>
    </div>
  );
}

// ─── App sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ active }) {
  const nav = [["⌂","Dashboard",3],["◎","Inbox",null],["◻","Projects",3]];
  const lib = [["◉","Inputs",5],["◈","Clusters",6],["◆","Scenarios",7]];
  return (
    <div style={{ width:188, flexShrink:0, background:c.surfaceAlt, borderRight:`1px solid ${c.border}`, display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"16px", borderBottom:`1px solid ${c.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, fontWeight:600, color:c.ink }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:c.ink }}/>Future Signals
        </div>
        <div style={{ fontSize:10, color:c.hint, marginTop:2, paddingLeft:14 }}>AI Governance & Trust</div>
      </div>
      <div style={{ flex:1, padding:"8px 0" }}>
        {nav.map(([ico,lbl,scr])=>(
          <div key={lbl} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", fontSize:12, color:scr===active?c.ink:c.hint, fontWeight:scr===active?500:400, background:scr===active?"rgba(0,0,0,0.04)":"transparent", borderRight:scr===active?`2px solid ${c.ink}`:"none" }}>
            <span style={{ fontSize:10, width:13 }}>{ico}</span>{lbl}
          </div>
        ))}
        <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:c.hint, padding:"12px 16px 4px" }}>Library</div>
        {lib.map(([ico,lbl,scr])=>(
          <div key={lbl} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", fontSize:12, color:scr===active?c.ink:c.hint }}>
            <span style={{ fontSize:10, width:13 }}>{ico}</span>{lbl}
          </div>
        ))}
      </div>
      <div style={{ padding:"10px 16px", borderTop:`1px solid ${c.border}` }}>
        <div style={{ fontSize:11, color:c.faint }}>sam@aldermanandward.com</div>
        <div style={{ fontSize:10, color:c.hint, marginTop:1 }}>Advanced · Pro plan</div>
      </div>
    </div>
  );
}

function AppShell({ active, scroll=true, children }) {
  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      <Sidebar active={active}/>
      <div style={{ flex:1, overflowY:scroll?"auto":"hidden", overflowX:"hidden" }}>
        {children}
      </div>
    </div>
  );
}

// ─── SCREEN 1: Login ────────────────────────────────────────────────────────────
function Screen1({ populated }) {
  return (
    <div style={{ height:"100%", background:c.bg, display:"flex", alignItems:"center", justifyContent:"center", overflowY:"auto" }}>
      <div style={{ width:"100%", maxWidth:400, padding:24 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, fontSize:15, fontWeight:600, color:c.ink, marginBottom:6 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:c.ink }}/>Future Signals
          </div>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.1em", color:c.hint }}>Strategic Foresight Platform</div>
        </div>
        <div style={{ background:c.white, border:`1px solid ${c.border}`, borderRadius:14, padding:"32px 28px", boxShadow:"0 4px 28px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize:17, fontWeight:500, color:c.ink, marginBottom:3 }}>Sign in</div>
          <div style={{ fontSize:13, color:c.muted, marginBottom:24, lineHeight:1.6 }}>Access your workspace and projects.</div>
          <div style={{ marginBottom:14 }}>
            <div style={fl}>Email address</div>
            <input style={inp} type="email" placeholder="you@example.com" defaultValue={populated?"sam@aldermanandward.com":""}/>
          </div>
          <div style={{ marginBottom:22 }}>
            <div style={{ ...fl, justifyContent:"space-between" }}>
              <span>Password</span>
              <span style={{ fontSize:11, color:c.blue700, cursor:"pointer" }}>Forgot password?</span>
            </div>
            <input style={inp} type="password" placeholder="••••••••" defaultValue={populated?"••••••••":""}/>
          </div>
          <button style={{ ...btnP, width:"100%", opacity:populated?1:0.3 }}>Sign in</button>
          <div style={{ textAlign:"center", marginTop:18, fontSize:12, color:c.muted }}>
            Don't have an account? <span style={{ color:c.ink, fontWeight:500, cursor:"pointer" }}>Sign up</span>
          </div>
        </div>
        {populated && (
          <div style={{ marginTop:14, padding:"10px 14px", background:c.green50, border:`1px solid ${c.greenBorder}`, borderRadius:8, fontSize:12, color:c.green700, textAlign:"center" }}>
            ✓ Redirecting to workspace…
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Education tour illustrations ──────────────────────────────────────────────
function IllustBox({ children, minH=180 }) {
  return <div style={{ margin:"14px 0", padding:"18px 16px", background:c.surfaceAlt, borderRadius:10, border:`1px solid ${c.border}`, minHeight:minH, width:"100%", boxSizing:"border-box", overflow:"hidden" }}>{children}</div>;
}
function IllustWorkflow() {
  const steps=[{icon:"◎",label:"Collect Inputs",sub:["Observations that","point to change"],col:c.green700,bg:c.green50,border:c.greenBorder},{icon:"◈",label:"Build Clusters",sub:["Patterns built","from inputs"],col:c.blue700,bg:c.blue50,border:c.blueBorder},{icon:"◆",label:"Craft Scenarios",sub:["Stories of","possible futures"],col:c.amber700,bg:c.amber50,border:c.amberBorder}];
  const cW=118,cH=94,gap=18,svgW=cW*3+gap*2+20;
  return <svg viewBox={`0 0 ${svgW} ${cH+20}`} xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"auto",display:"block"}}>{steps.map((step,i)=>{const x=10+i*(cW+gap);return(<g key={i}><rect x={x} y="10" width={cW} height={cH} rx="9" fill={step.bg} stroke={step.border} strokeWidth="0.8"/><text x={x+cW/2} y="42" textAnchor="middle" fontSize="22" fill={step.col} fontFamily="inherit">{step.icon}</text><text x={x+cW/2} y="62" textAnchor="middle" fontSize="10" fontWeight="600" fill={step.col} fontFamily="inherit">{step.label}</text>{step.sub.map((line,li)=><text key={li} x={x+cW/2} y={76+li*13} textAnchor="middle" fontSize="9" fill={step.col} fontFamily="inherit" fillOpacity="0.75">{line}</text>)}{i<steps.length-1&&<><line x1={x+cW+2} y1={10+cH/2} x2={x+cW+gap-4} y2={10+cH/2} stroke={c.hint} strokeWidth="1.2"/><polygon points={`${x+cW+gap-6},${10+cH/2-4} ${x+cW+gap},${10+cH/2} ${x+cW+gap-6},${10+cH/2+4}`} fill={c.hint}/></>}</g>);})}</svg>;
}
function IllustSignal() {
  return <svg viewBox="0 0 440 170" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"auto",display:"block"}}>{[{x:20,label:"Article"},{x:170,label:"Research"},{x:320,label:"Observation"}].map(({x,label})=><g key={label}><rect x={x} y="12" width="120" height="72" rx="7" fill={c.white} stroke={c.borderMid} strokeWidth="0.8"/><rect x={x+12} y="24" width="70" height="6" rx="3" fill={c.hint}/><rect x={x+12} y="36" width="96" height="4" rx="2" fill={c.border}/><rect x={x+12} y="45" width="84" height="4" rx="2" fill={c.border}/><rect x={x+12} y="54" width="64" height="4" rx="2" fill={c.border}/><rect x={x+12} y="63" width="76" height="4" rx="2" fill={c.border}/><text x={x+60} y="102" textAnchor="middle" fontSize="11" fill={c.muted} fontFamily="inherit">{label}</text></g>)}<line x1="80" y1="108" x2="80" y2="124" stroke={c.hint} strokeWidth="1"/><line x1="230" y1="108" x2="230" y2="124" stroke={c.hint} strokeWidth="1"/><line x1="380" y1="108" x2="380" y2="124" stroke={c.hint} strokeWidth="1"/><line x1="80" y1="124" x2="380" y2="124" stroke={c.hint} strokeWidth="1"/><line x1="230" y1="124" x2="230" y2="138" stroke={c.hint} strokeWidth="1"/><rect x="168" y="140" width="124" height="26" rx="13" fill={c.ink}/><text x="230" y="157" textAnchor="middle" fontSize="11" fill={c.white} fontFamily="inherit" fontWeight="500">Input</text></svg>;
}
function IllustTrend() {
  const pts=[[24,128],[60,116],[96,100],[132,90],[168,74],[204,63],[240,50],[276,38],[312,26],[380,10]];
  const lp=pts.map((p,i)=>`${i===0?"M":"L"}${p[0]},${p[1]}`).join(" ");
  return <svg viewBox="0 0 420 162" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"auto",display:"block"}}><line x1="20" y1="140" x2="400" y2="140" stroke={c.border} strokeWidth="1"/><line x1="20" y1="8" x2="20" y2="140" stroke={c.border} strokeWidth="1"/><path d={`${lp} L380,140 L24,140 Z`} fill={c.ink} fillOpacity="0.05"/><path d={lp} fill="none" stroke={c.ink} strokeWidth="2" strokeLinejoin="round"/>{pts.filter((_,i)=>i%2===0).map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r="4.5" fill={c.white} stroke={c.ink} strokeWidth="1.5"/>)}<line x1="153" y1="8" x2="153" y2="140" stroke={c.border} strokeWidth="0.8" strokeDasharray="4,3"/><line x1="286" y1="8" x2="286" y2="140" stroke={c.border} strokeWidth="0.8" strokeDasharray="4,3"/><text x="86" y="156" textAnchor="middle" fontSize="10" fill={c.muted} fontFamily="inherit">H1</text><text x="219" y="156" textAnchor="middle" fontSize="10" fill={c.muted} fontFamily="inherit">H2</text><text x="343" y="156" textAnchor="middle" fontSize="10" fill={c.muted} fontFamily="inherit">H3</text></svg>;
}
function IllustScenario() {
  const branches=[{y:14,label:"Growth",color:c.green700,bg:c.green50,border:c.greenBorder,dash:false},{y:52,label:"Discipline",color:c.blue700,bg:c.blue50,border:c.blueBorder,dash:false},{y:90,label:"Transformation",color:c.amber700,bg:c.amber50,border:c.amberBorder,dash:true},{y:128,label:"Collapse",color:c.red800,bg:c.red50,border:c.redBorder,dash:true}];
  return <svg viewBox="0 0 380 172" xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"auto",display:"block"}}><circle cx="36" cy="88" r="7" fill={c.ink}/><text x="36" y="106" textAnchor="middle" fontSize="9" fill={c.muted} fontFamily="inherit">Today</text>{branches.map((b,i)=><g key={i}><line x1="43" y1="88" x2="218" y2={b.y+11} stroke={b.color} strokeWidth="1.4" strokeOpacity="0.55" strokeDasharray={b.dash?"5,4":"none"}/><rect x="220" y={b.y} width="80" height="22" rx="6" fill={b.bg} stroke={b.border} strokeWidth="0.8"/><text x="260" y={b.y+14} textAnchor="middle" fontSize="9.5" fill={b.color} fontFamily="inherit" fontWeight="500">{b.label}</text></g>)}</svg>;
}
function IllustSTEEPLED() {
  const items=[{l:"S",n:"Social",col:c.green700,bg:c.green50,b:c.greenBorder},{l:"T",n:"Technological",col:c.blue700,bg:c.blue50,b:c.blueBorder},{l:"E",n:"Economic",col:c.amber700,bg:c.amber50,b:c.amberBorder},{l:"E",n:"Environmental",col:c.green700,bg:c.green50,b:c.greenBorder},{l:"P",n:"Political",col:c.blue700,bg:c.blue50,b:c.blueBorder},{l:"L",n:"Legal",col:c.amber700,bg:c.amber50,b:c.amberBorder},{l:"E",n:"Ethical",col:c.violet700,bg:c.violet50,b:c.violetBorder},{l:"D",n:"Demographic",col:c.red800,bg:c.red50,b:c.redBorder}];
  return <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>{items.map(item=><div key={item.n} style={{display:"flex",alignItems:"center",gap:7,padding:"9px 10px",borderRadius:8,background:item.bg,border:`1px solid ${item.b}`,minWidth:0}}><span style={{fontSize:15,fontWeight:700,color:item.col,lineHeight:1,flexShrink:0}}>{item.l}</span><span style={{fontSize:10,color:item.col,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.n}</span></div>)}</div>;
}
function IllustHorizons() {
  const widths=[100,140,164],gap=10;let xC=20;const tW=widths.reduce((a,b)=>a+b,0)+gap*2+40;
  const hs=[{label:"H1",sub:"Near-term",years:"0–3 yrs",col:c.green700,bg:c.green50,border:c.greenBorder},{label:"H2",sub:"Transition",years:"3–7 yrs",col:c.blue700,bg:c.blue50,border:c.blueBorder},{label:"H3",sub:"Emerging",years:"7–15 yrs",col:c.amber700,bg:c.amber50,border:c.amberBorder}];
  return <svg viewBox={`0 0 ${tW} 142`} xmlns="http://www.w3.org/2000/svg" style={{width:"100%",height:"auto",display:"block"}}><line x1="20" y1="103" x2={tW-20} y2="103" stroke={c.border} strokeWidth="1.2"/><polygon points={`${tW-22},99 ${tW-14},103 ${tW-22},107`} fill={c.hint}/>{hs.map((h,i)=>{const x=xC,w=widths[i];xC+=w+gap;return(<g key={h.label}><rect x={x} y="18" width={w} height="82" rx="7" fill={h.bg} stroke={h.border} strokeWidth="0.8"/><text x={x+w/2} y="54" textAnchor="middle" fontSize="24" fontWeight="700" fill={h.col} fontFamily="inherit">{h.label}</text><text x={x+w/2} y="74" textAnchor="middle" fontSize="11" fill={h.col} fontFamily="inherit">{h.sub}</text><text x={x+w/2} y="117" textAnchor="middle" fontSize="10" fill={c.muted} fontFamily="inherit">{h.years}</text><line x1={x} y1="100" x2={x} y2="106" stroke={h.border} strokeWidth="2"/></g>);})}<text x="20" y="134" fontSize="9" fill={c.hint} fontFamily="inherit">Now</text></svg>;
}

// ─── Education slides data ──────────────────────────────────────────────────────
const SLIDES = [
  { id:"welcome", badge:null, title:"Welcome to Future Signals", body:"Future Signals is a structured workspace for futures thinking — helping you move from raw observations to strategic foresight in a consistent, repeatable way.", bodySub:"This quick tour introduces the key ideas so you can start with confidence.", illustration:null, cta:"Show me the basics" },
  { id:"method", badge:"The method", title:"Inputs → Clusters → Scenarios", body:"Everything in Future Signals follows one core logic: you collect weak signals as inputs, group them into clusters (trends, drivers, or tensions), then use those clusters to construct possible future scenarios.", bodySub:"This three-step flow keeps your thinking grounded and systematic rather than speculative.", illustration:<IllustWorkflow/>, cta:"Tell me about inputs" },
  { id:"inputs", badge:"Step 1", badgeColor:{bg:c.green50,col:c.green700,border:c.greenBorder}, title:"Inputs — observations that point to change", body:"An input is a specific, real-world observation that suggests something might be shifting — an article, a data point, a policy announcement, a product launch, a behaviour change.", bodySub:"Inputs don't prove a trend. They hint at one. Their value is in accumulation and pattern-spotting over time.", illustration:<IllustSignal/>, cta:"What about clusters?" },
  { id:"clusters", badge:"Step 2", badgeColor:{bg:c.blue50,col:c.blue700,border:c.blueBorder}, title:"Clusters — patterns built from inputs", body:"A cluster groups inputs that share a common direction. Clusters come in three subtypes: Trends (directional patterns), Drivers (forces accelerating change), and Tensions (unresolved conflicts).", bodySub:"Where inputs are data points, clusters are the lines you draw through them. AI helps surface candidates — you decide what's real.", illustration:<IllustTrend/>, cta:"And scenarios?" },
  { id:"scenarios", badge:"Step 3", badgeColor:{bg:c.amber50,col:c.amber700,border:c.amberBorder}, title:"Scenarios — stories of possible futures", body:"A scenario is a coherent, plausible narrative about how the future might unfold — combining your clusters with assumptions, archetypes, and strategic questions.", bodySub:"Scenarios aren't predictions. They're tools for preparing thinking across multiple possible outcomes.", illustration:<IllustScenario/>, cta:"How do you classify inputs?" },
  { id:"steepled", badge:"Classification", badgeColor:{bg:c.violet50,col:c.violet700,border:c.violetBorder}, title:"STEEPLED — a lens for every input", body:"Every input you collect gets tagged with a STEEPLED category — the domain of change it represents. This keeps your collection balanced and helps you spot gaps.", bodySub:"Don't worry about getting it perfect. AI will suggest a category when you add an input — you just confirm or adjust.", illustration:<IllustSTEEPLED/>, cta:"What's a time horizon?" },
  { id:"horizons", badge:"Time framing", badgeColor:{bg:c.blue50,col:c.blue700,border:c.blueBorder}, title:"Three Horizons — near, transition, emerging", body:"Foresight thinking is organised across three time horizons. H1 is the present and near-term; H2 is transition territory; H3 is the emerging, more speculative future.", bodySub:"When you create a Project, you set the year ranges for each horizon. Inputs and clusters are placed within this shared temporal frame.", illustration:<IllustHorizons/>, cta:"Got it — go to my workspace" },
];

// ─── Tour components ────────────────────────────────────────────────────────────
function TourPips({ total, current }) {
  return (
    <div style={{ display:"flex", gap:5, alignItems:"center" }}>
      {Array.from({length:total}).map((_,i)=>(
        <div key={i} style={{ height:4, borderRadius:2, background:i<=current?c.ink:"rgba(0,0,0,.1)", width:i===current?20:6, transition:"all .25s ease" }}/>
      ))}
    </div>
  );
}

function TourSlide({ slide, stepIdx, total, onNext, onBack, onSkip, isLast }) {
  const [vis, setVis] = useState(false);
  useEffect(()=>{ setVis(false); const t=setTimeout(()=>setVis(true),40); return ()=>clearTimeout(t); },[slide.id]);
  const fade = { opacity:vis?1:0, transform:vis?"translateY(0)":"translateY(8px)", transition:"opacity .3s ease, transform .3s ease" };
  return (
    <div style={{ padding:"22px 26px 26px", height:"100%", overflowY:"auto", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <TourPips total={total} current={stepIdx}/>
        <button onClick={onSkip} style={{ fontSize:12, color:c.hint, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>Skip tour →</button>
      </div>
      <div style={fade}>
        {slide.badge && (
          <div style={{ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:12, fontSize:11, marginBottom:12, ...(slide.badgeColor?{background:slide.badgeColor.bg,color:slide.badgeColor.col,border:`1px solid ${slide.badgeColor.border}`}:{background:c.surfaceAlt,color:c.muted,border:`1px solid ${c.border}`}) }}>
            {slide.badge}
          </div>
        )}
        <div style={{ fontSize:18, fontWeight:500, color:c.ink, lineHeight:1.3, marginBottom:8 }}>{slide.title}</div>
        {slide.id==="welcome" && (
          <IllustBox minH={110}>
            <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap", marginBottom:10 }}>
              {[[c.green700,c.green50,c.greenBorder,"◎","Inputs"],[c.blue700,c.blue50,c.blueBorder,"◈","Clusters"],[c.amber700,c.amber50,c.amberBorder,"◆","Scenarios"]].map(([col,bg,border,ico,lbl])=>(
                <div key={lbl} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:7, padding:"14px 20px", borderRadius:9, background:bg, border:`1px solid ${border}` }}>
                  <span style={{ fontSize:22, color:col }}>{ico}</span>
                  <span style={{ fontSize:11, fontWeight:500, color:col }}>{lbl}</span>
                </div>
              ))}
            </div>
            <div style={{ textAlign:"center", fontSize:11, color:c.hint, fontStyle:"italic" }}>The three building blocks of futures thinking</div>
          </IllustBox>
        )}
        {slide.illustration && slide.id!=="welcome" && (
          <IllustBox minH={slide.id==="steepled"?0:150}>{slide.illustration}</IllustBox>
        )}
        <div style={{ fontSize:13, color:c.ink, lineHeight:1.7, marginBottom:7 }}>{slide.body}</div>
        <div style={{ fontSize:12, color:c.muted, lineHeight:1.65, marginBottom:20 }}>{slide.bodySub}</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:14, borderTop:`1px solid ${c.border}` }}>
          <div>{stepIdx>0&&<button onClick={onBack} style={{ fontSize:12, color:c.muted, background:"none", border:`1px solid ${c.borderMid}`, cursor:"pointer", fontFamily:"inherit", padding:"7px 14px", borderRadius:7 }}>← Back</button>}</div>
          <button onClick={onNext} style={btnP}>{isLast?"Go to my workspace →":(slide.cta||"Continue →")}</button>
        </div>
      </div>
    </div>
  );
}

function TourDone({ onReset }) {
  return (
    <div style={{ padding:"52px 28px", textAlign:"center" }}>
      <div style={{ width:44, height:44, borderRadius:"50%", background:c.ink, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 18px", color:c.white, fontSize:17 }}>✓</div>
      <div style={{ fontSize:18, fontWeight:500, color:c.ink, marginBottom:6 }}>You're ready to start</div>
      <div style={{ fontSize:13, color:c.muted, lineHeight:1.7, maxWidth:340, margin:"0 auto 24px" }}>Head to your Inbox to explore inputs, or create your first Project. Revisit this tour any time from account settings.</div>
      <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
        <button style={btnP}>Go to workspace →</button>
        <button style={btnSec}>Create a Project</button>
      </div>
      <button onClick={onReset} style={{ marginTop:22, fontSize:12, color:c.hint, background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>↩ Replay tour</button>
    </div>
  );
}

// ─── Tour sidebar shell ─────────────────────────────────────────────────────────
function TourShell({ level, children }) {
  const pillMap = { beginner:{bg:c.green50,col:c.green700,border:c.greenBorder,dot:"○",label:"Beginner"}, intermediate:{bg:c.blue50,col:c.blue700,border:c.blueBorder,dot:"◑",label:"Intermediate"} };
  const p = level ? pillMap[level] : null;
  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      <div style={{ width:188, flexShrink:0, background:c.surfaceAlt, borderRight:`1px solid ${c.border}`, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"16px", borderBottom:`1px solid ${c.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, fontWeight:600, color:c.ink }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:c.ink }}/>Future Signals
          </div>
        </div>
        <div style={{ flex:1, padding:"8px 0" }}>
          {[["⌂","Dashboard"],["◻","Projects"],["◈","Inbox"]].map(([ico,lbl])=>(
            <div key={lbl} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", fontSize:12, color:c.hint }}>
              <span style={{ fontSize:10, width:13 }}>{ico}</span>{lbl}
            </div>
          ))}
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:c.hint, padding:"12px 16px 4px" }}>Library</div>
          {[["◎","Inputs"],["◈","Clusters"],["◆","Scenarios"]].map(([ico,lbl])=>(
            <div key={lbl} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", fontSize:12, color:c.hint }}>
              <span style={{ fontSize:10, width:13 }}>{ico}</span>{lbl}
            </div>
          ))}
          <div style={{ margin:"14px 12px 0", padding:"12px", borderRadius:8, background:c.white, border:`1px solid ${c.border}` }}>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.07em", color:c.hint, marginBottom:5 }}>Getting started</div>
            <div style={{ fontSize:11, color:c.muted, lineHeight:1.5 }}>Complete the foresight basics tour.</div>
          </div>
        </div>
        {p && <div style={{ padding:"10px 14px", borderTop:`1px solid ${c.border}` }}><span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:p.bg, color:p.col, border:`1px solid ${p.border}` }}>{p.dot} {p.label}</span></div>}
      </div>
      <div style={{ flex:1, background:c.white, overflowY:"auto" }}>{children}</div>
    </div>
  );
}


// ─── Domain meta (for onboarding tiles) ────────────────────────────────────────
const DOMAIN_META = [
  { id:"tech",    label:"Technology & AI",       icon:"◎", col:c.blue700,   bg:c.blue50,   border:c.blueBorder   },
  { id:"climate", label:"Climate & Energy",       icon:"◈", col:c.green700,  bg:c.green50,  border:c.greenBorder  },
  { id:"health",  label:"Health & Life Sciences", icon:"◉", col:c.teal700,   bg:c.teal50,   border:c.tealBorder   },
  { id:"gov",     label:"Government & Policy",    icon:"◆", col:c.amber700,  bg:c.amber50,  border:c.amberBorder  },
  { id:"econ",    label:"Economy & Finance",      icon:"◎", col:c.violet700, bg:c.violet50, border:c.violetBorder },
  { id:"media",   label:"Media & Culture",        icon:"◈", col:c.red800,    bg:c.red50,    border:c.redBorder    },
  { id:"edu",     label:"Education & Learning",   icon:"◉", col:c.blue700,   bg:c.blue50,   border:c.blueBorder   },
  { id:"defence", label:"Defence & Security",     icon:"◆", col:c.muted,     bg:c.surfaceAlt,border:c.border      },
];

const PURPOSE_OPTIONS = [
  { id:"strategy",    label:"Internal strategy team",   sub:"Building organisational foresight capacity" },
  { id:"consulting",  label:"Strategy consulting",      sub:"Client-facing foresight and scenario work"  },
  { id:"research",    label:"Academic or policy research", sub:"Structured inquiry with publication in mind" },
  { id:"personal",    label:"Personal learning",        sub:"Exploring futures thinking for myself"      },
];

// ─── Seeded signals pool (2–3 per domain) ──────────────────────────────────────
const SEEDED_SIGNALS_POOL = {
  tech: [
    { id:"s1", name:"EU AI Act enters full enforcement", desc:"High-risk AI systems now face mandatory conformity assessments, reshaping how global AI products are built and deployed.", cats:["Political","Legal"], str:"High", h:"H1", domain:"Technology & AI" },
    { id:"s2", name:"AI agents begin replacing knowledge-worker workflows", desc:"Autonomous AI agents complete multi-step tasks across enterprise systems without human oversight, forcing firms to rethink knowledge-work roles.", cats:["Technological","Social"], str:"Moderate", h:"H1", domain:"Technology & AI" },
    { id:"s3", name:"Chip export controls fracture global AI supply chain", desc:"Tightening semiconductor export restrictions fragment access to frontier AI compute, creating distinct performance tiers between jurisdictions.", cats:["Political","Technological"], str:"High", h:"H2", domain:"Technology & AI" },
  ],
  climate: [
    { id:"s4", name:"IEA confirms solar now cheapest electricity source in history", desc:"Utility-scale solar has undercut all fossil alternatives in levelised cost, accelerating the pace of the energy transition across emerging markets.", cats:["Environmental","Economic"], str:"High", h:"H1", domain:"Climate & Energy" },
    { id:"s5", name:"Methane super-emitter satellites go live globally", desc:"A network of monitoring satellites enables real-time attribution of methane leaks to specific facilities, creating accountability pressure on oil and gas operators.", cats:["Environmental","Technological"], str:"Moderate", h:"H1", domain:"Climate & Energy" },
    { id:"s6", name:"Carbon border adjustment mechanism reshapes trade flows", desc:"The EU's CBAM starts imposing carbon costs on imports from high-emission economies, incentivising export-dependent nations to accelerate decarbonisation.", cats:["Political","Economic"], str:"Moderate", h:"H2", domain:"Climate & Energy" },
  ],
  health: [
    { id:"s7", name:"GLP-1 drugs reshape obesity and metabolic disease treatment", desc:"Widespread adoption of GLP-1 agonists is reducing obesity rates and associated comorbidities at scale, with downstream effects on healthcare utilisation and food consumption patterns.", cats:["Social","Technological"], str:"High", h:"H1", domain:"Health & Life Sciences" },
    { id:"s8", name:"AI diagnostic tools outperform radiologists in early cancer detection", desc:"Multiple clinical trials confirm AI outperforms average radiologists in lung, breast, and skin cancer detection, raising questions about clinical workflow redesign.", cats:["Technological","Social"], str:"High", h:"H1", domain:"Health & Life Sciences" },
    { id:"s9", name:"Longevity biomarker tests reach consumer market", desc:"Direct-to-consumer biological age testing, previously confined to research, enters mass-market pricing, shifting health identity and insurance risk models.", cats:["Technological","Economic"], str:"Weak", h:"H2", domain:"Health & Life Sciences" },
  ],
  gov: [
    { id:"s10", name:"G20 agrees minimum AI safety standards framework", desc:"For the first time, major economies align on a baseline set of AI deployment standards, though enforcement mechanisms remain voluntary.", cats:["Political","Legal"], str:"Moderate", h:"H1", domain:"Government & Policy" },
    { id:"s11", name:"Digital identity frameworks adopted across 14 countries", desc:"Government-issued digital IDs with privacy-preserving credential sharing are becoming the default for public service access, financial onboarding, and voting verification.", cats:["Political","Technological"], str:"High", h:"H2", domain:"Government & Policy" },
    { id:"s12", name:"Sovereign wealth funds pivot to domestic infrastructure mandates", desc:"Several major SWFs are redirecting capital toward national infrastructure and strategic industries under political pressure, blurring the line between public policy and investment.", cats:["Political","Economic"], str:"Moderate", h:"H2", domain:"Government & Policy" },
  ],
  econ: [
    { id:"s13", name:"Remote work normalisation reshapes commercial real estate permanently", desc:"Five years of hybrid work patterns have permanently reduced commercial office demand, triggering repricing and conversion of city-centre commercial stock.", cats:["Economic","Social"], str:"High", h:"H1", domain:"Economy & Finance" },
    { id:"s14", name:"CBDC pilots expand to 30 countries simultaneously", desc:"Central bank digital currencies move beyond pilot status in multiple major economies, with implications for monetary policy transmission and financial inclusion.", cats:["Economic","Political"], str:"Moderate", h:"H2", domain:"Economy & Finance" },
    { id:"s15", name:"Private credit markets surpass traditional bank lending in mid-market", desc:"Non-bank lenders now originate more mid-market debt than traditional banks in the US and UK, representing a structural shift in credit intermediation.", cats:["Economic","Legal"], str:"High", h:"H1", domain:"Economy & Finance" },
  ],
  media: [
    { id:"s16", name:"Synthetic media disclosure laws take effect in EU and California", desc:"Legislation requiring clear labelling of AI-generated content applies to political advertising, news content, and entertainment, creating new compliance requirements.", cats:["Legal","Political"], str:"Moderate", h:"H1", domain:"Media & Culture" },
    { id:"s17", name:"AI-generated music crosses 30% of new streaming releases", desc:"The volume of AI-generated or AI-assisted tracks on major streaming platforms continues to grow, challenging revenue models for human artists and labels.", cats:["Technological","Social"], str:"Moderate", h:"H1", domain:"Media & Culture" },
    { id:"s18", name:"Platform-independent creator economies gain traction", desc:"Decentralised publishing and monetisation tools reduce creators' dependence on algorithmically-controlled platforms, shifting power dynamics in media production.", cats:["Social","Technological"], str:"Weak", h:"H2", domain:"Media & Culture" },
  ],
  edu: [
    { id:"s19", name:"AI tutors demonstrate better outcomes than average classroom instruction", desc:"Multiple large-scale RCTs show AI-powered personalised tutors produce superior learning outcomes to average human instruction in mathematics and reading.", cats:["Technological","Social"], str:"Moderate", h:"H2", domain:"Education & Learning" },
    { id:"s20", name:"University enrolment falls for fourth consecutive year", desc:"Declining demographic cohorts, rising costs, and growing employer acceptance of alternative credentials are driving sustained falls in undergraduate enrolment.", cats:["Social","Economic"], str:"High", h:"H1", domain:"Education & Learning" },
    { id:"s21", name:"Micro-credential frameworks gain employer recognition at scale", desc:"Structured short-form credentials from platforms like Coursera and LinkedIn Learning are now formally recognised in hiring criteria by Fortune 500 employers.", cats:["Social","Economic"], str:"Moderate", h:"H1", domain:"Education & Learning" },
  ],
  defence: [
    { id:"s22", name:"NATO adopts principles for autonomous weapons systems", desc:"The alliance agrees on a common framework governing the deployment of autonomous lethal systems, though distinctions between 'human on the loop' and 'human in the loop' remain contested.", cats:["Political","Legal"], str:"Moderate", h:"H1", domain:"Defence & Security" },
    { id:"s23", name:"Critical infrastructure cyberattacks double year-on-year", desc:"Attacks on energy grids, water systems, and financial infrastructure are accelerating, attributed to state-aligned actors across multiple geopolitical blocs.", cats:["Political","Technological"], str:"High", h:"H1", domain:"Defence & Security" },
    { id:"s24", name:"Space debris creates first commercially significant orbital congestion", desc:"Satellite operators begin voluntarily limiting new deployments in critical orbital bands as collision risk modelling shows cascade probabilities are rising.", cats:["Technological","Legal"], str:"Weak", h:"H2", domain:"Defence & Security" },
  ],
};


// ─── SCREEN 2: Onboarding (4-step setup + optional edu tour) ───────────────────
const OB_LEVELS = [
  { id:"beginner",     label:"New to foresight",        desc:"I'm learning futures thinking and want guidance through the process.", dot:"○" },
  { id:"intermediate", label:"Some experience",          desc:"I've done foresight work before and understand the core concepts.",  dot:"◑" },
  { id:"advanced",     label:"Experienced practitioner", desc:"I use structured foresight methods regularly in my work.",           dot:"●" },
];

function DomainTile({ meta, selected, onToggle }) {
  return (
    <div onClick={onToggle} style={{ padding:"12px 14px", borderRadius:10, border:`1px solid ${selected?c.ink:c.border}`, background:selected?"rgba(0,0,0,0.03)":c.white, cursor:"pointer", display:"flex", alignItems:"center", gap:10, transition:"border-color .12s" }}>
      <span style={{ fontSize:16, color:selected?c.ink:c.faint }}>{meta.icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:12, fontWeight:selected?500:400, color:c.ink, lineHeight:1.3 }}>{meta.label}</div>
      </div>
      {selected && <span style={{ fontSize:12, color:c.ink, flexShrink:0 }}>✓</span>}
    </div>
  );
}

function Screen2({ populated, onComplete }) {
  const [setupStep, setSetupStep]     = useState(populated ? 2 : 0);
  const [name, setName]               = useState(populated ? "Sam" : "");
  const [selectedLevel, setLevel]     = useState(populated ? "intermediate" : null);
  const [selectedDomains, setDomains] = useState(populated ? ["health","gov","tech","climate"] : []);
  const [purpose, setPurpose]         = useState(populated ? "strategy" : null);
  const [phase, setPhase]             = useState("setup"); // "setup" | "tour" | "done"
  const [tourStep, setTourStep]       = useState(0);

  const toggleDomain = id => setDomains(prev => prev.includes(id) ? prev.filter(d=>d!==id) : [...prev, id]);

  const finishSetup = () => {
    const data = { name: name||"there", level:selectedLevel, domains:selectedDomains, purpose };
    if (selectedLevel === "advanced") { onComplete(data); setPhase("done"); }
    else { setPhase("tour"); setTourStep(0); }
  };

  const TOTAL_STEPS = 4; // 0:name 1:level 2:domains 3:purpose

  // ── Setup ────────────────────────────────────────────────────────────────────
  if (phase === "setup") {
    const canAdvance = [
      name.trim().length > 1,                     // step 0
      !!selectedLevel,                            // step 1
      selectedDomains.length > 0,                 // step 2
      true,                                       // step 3 (purpose optional)
    ][setupStep];

    return (
      <div style={{ height:"100%", background:c.bg, display:"flex", alignItems:"center", justifyContent:"center", overflowY:"auto" }}>
        <div style={{ width:"100%", maxWidth:560, padding:24 }}>
          {/* Logo */}
          <div style={{ textAlign:"center", marginBottom:24 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, fontSize:14, fontWeight:600, color:c.ink }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:c.ink }}/>Future Signals
            </div>
          </div>
          {/* Step pips */}
          <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:24 }}>
            {Array.from({length:TOTAL_STEPS}).map((_,i)=>(
              <div key={i} style={{ height:5, borderRadius:3, background:i<setupStep?c.ink:i===setupStep?c.ink:"rgba(0,0,0,0.1)", width:i===setupStep?24:8, transition:"all .25s", opacity:i<setupStep?0.35:1 }}/>
            ))}
          </div>

          <div style={{ background:c.white, border:`1px solid ${c.border}`, borderRadius:14, padding:"34px 32px", boxShadow:"0 4px 28px rgba(0,0,0,0.07)" }}>

            {/* ── Step 0: Name ─────────────────────────────────────────────── */}
            {setupStep === 0 && (
              <div>
                <div style={{ fontSize:22, fontWeight:500, color:c.ink, lineHeight:1.2, marginBottom:6 }}>Welcome to Future Signals</div>
                <div style={{ fontSize:13, color:c.muted, lineHeight:1.6, marginBottom:26 }}>A structured workspace for strategic foresight. Let's set things up — what should we call you?</div>
                <div style={{ marginBottom:24 }}>
                  <div style={fl}>Your name</div>
                  <input style={inp} type="text" placeholder="e.g. Sam Ward" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
                </div>
                <button style={{ ...btnP, opacity:canAdvance?1:0.28 }} onClick={()=>canAdvance&&setSetupStep(1)}>Continue →</button>
              </div>
            )}

            {/* ── Step 1: Experience level ──────────────────────────────────── */}
            {setupStep === 1 && (
              <div>
                <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:c.hint, marginBottom:3 }}>Welcome, {name} ·</div>
                <div style={{ fontSize:20, fontWeight:500, color:c.ink, lineHeight:1.2, marginBottom:6 }}>What's your foresight experience?</div>
                <div style={{ fontSize:13, color:c.muted, lineHeight:1.6, marginBottom:20 }}>This shapes which fields and features you'll see by default. You can always change it.</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
                  {OB_LEVELS.map(lvl=>{
                    const on = selectedLevel===lvl.id;
                    return (
                      <div key={lvl.id} onClick={()=>setLevel(lvl.id)} style={{ padding:"13px 16px", borderRadius:10, border:`1px solid ${on?c.ink:c.border}`, background:on?"rgba(0,0,0,0.02)":c.white, cursor:"pointer", display:"flex", gap:12, alignItems:"flex-start", transition:"border-color .12s" }}>
                        <span style={{ fontSize:14, marginTop:1, color:on?c.ink:c.hint }}>{lvl.dot}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:c.ink, marginBottom:2 }}>{lvl.label}</div>
                          <div style={{ fontSize:12, color:c.muted }}>{lvl.desc}</div>
                        </div>
                        {on && <span style={{ fontSize:12, color:c.ink, marginTop:2 }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <button style={btnSec} onClick={()=>setSetupStep(0)}>← Back</button>
                  <button style={{ ...btnP, opacity:canAdvance?1:0.28 }} onClick={()=>canAdvance&&setSetupStep(2)}>Continue →</button>
                </div>
              </div>
            )}

            {/* ── Step 2: Domain interests ──────────────────────────────────── */}
            {setupStep === 2 && (
              <div>
                <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:c.hint, marginBottom:3 }}>Personalise your workspace ·</div>
                <div style={{ fontSize:20, fontWeight:500, color:c.ink, lineHeight:1.2, marginBottom:6 }}>Which domains interest you most?</div>
                <div style={{ fontSize:13, color:c.muted, lineHeight:1.6, marginBottom:20 }}>We'll curate a starter set of signals from these areas so your workspace isn't empty on day one. Select all that apply.</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:22 }}>
                  {DOMAIN_META.map(meta=>(
                    <DomainTile key={meta.id} meta={meta} selected={selectedDomains.includes(meta.id)} onToggle={()=>toggleDomain(meta.id)}/>
                  ))}
                </div>
                {selectedDomains.length > 0 && (
                  <div style={{ marginBottom:18, fontSize:12, color:c.green700, background:c.green50, border:`1px solid ${c.greenBorder}`, borderRadius:7, padding:"7px 12px" }}>
                    {selectedDomains.length} domain{selectedDomains.length>1?"s":""} selected — we'll seed your Inbox with relevant signals.
                  </div>
                )}
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <button style={btnSec} onClick={()=>setSetupStep(1)}>← Back</button>
                  <button style={{ ...btnP, opacity:canAdvance?1:0.28 }} onClick={()=>canAdvance&&setSetupStep(3)}>Continue →</button>
                </div>
              </div>
            )}

            {/* ── Step 3: Purpose ───────────────────────────────────────────── */}
            {setupStep === 3 && (
              <div>
                <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:"0.08em", color:c.hint, marginBottom:3 }}>Almost there ·</div>
                <div style={{ fontSize:20, fontWeight:500, color:c.ink, lineHeight:1.2, marginBottom:6 }}>What brings you to foresight?</div>
                <div style={{ fontSize:13, color:c.muted, lineHeight:1.6, marginBottom:20 }}>This helps us set useful defaults. You can skip this — it won't affect your access to any features.</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
                  {PURPOSE_OPTIONS.map(opt=>{
                    const on = purpose===opt.id;
                    return (
                      <div key={opt.id} onClick={()=>setPurpose(opt.id)} style={{ padding:"12px 16px", borderRadius:9, border:`1px solid ${on?c.ink:c.border}`, background:on?"rgba(0,0,0,0.02)":c.white, cursor:"pointer", display:"flex", gap:12, alignItems:"center", transition:"border-color .12s" }}>
                        <div style={{ width:14, height:14, borderRadius:"50%", border:`1.5px solid ${on?c.ink:c.hint}`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {on && <div style={{ width:7, height:7, borderRadius:"50%", background:c.ink }}/>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:on?500:400, color:c.ink, marginBottom:1 }}>{opt.label}</div>
                          <div style={{ fontSize:11, color:c.muted }}>{opt.sub}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <button style={btnSec} onClick={()=>setSetupStep(2)}>← Back</button>
                  <button style={btnP} onClick={finishSetup}>
                    {selectedLevel!=="advanced" ? "Continue to tour →" : "Go to workspace →"}
                  </button>
                  <button style={btnG} onClick={finishSetup}>Skip</button>
                </div>
              </div>
            )}
          </div>

          {/* Level context hint */}
          {setupStep===1 && selectedLevel && selectedLevel!=="advanced" && (
            <div style={{ marginTop:12, padding:"9px 12px", background:c.green50, border:`1px solid ${c.greenBorder}`, borderRadius:8, fontSize:12, color:c.green700, textAlign:"center" }}>
              We'll show you a short tour of foresight basics before you start.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Tour ─────────────────────────────────────────────────────────────────────
  if (phase === "tour") {
    const slide  = SLIDES[tourStep];
    const isLast = tourStep === SLIDES.length - 1;
    const data   = { name: name||"there", level:selectedLevel, domains:selectedDomains, purpose };
    return (
      <TourShell level={selectedLevel}>
        <TourSlide
          slide={slide} stepIdx={tourStep} total={SLIDES.length}
          onNext={()=>{ if(isLast){ onComplete(data); setPhase("done"); } else setTourStep(s=>s+1); }}
          onBack={()=>setTourStep(s=>Math.max(0,s-1))}
          onSkip={()=>{ onComplete(data); setPhase("done"); }}
          isLast={isLast}
        />
      </TourShell>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  return (
    <TourShell level={selectedLevel}>
      <TourDone onReset={()=>{ setPhase("tour"); setTourStep(0); }}/>
    </TourShell>
  );
}


// ─── SCREEN 3: Dashboard ────────────────────────────────────────────────────────
function SeededSignalCard({ sig, onSave, onDismiss, saved }) {
  const domainKey = Object.entries(SEEDED_SIGNALS_POOL).find(([k,arr])=>arr.some(s=>s.id===sig.id))?.[0];
  const domainMeta = DOMAIN_META.find(m=>m.id===domainKey);
  return (
    <div style={{ background:c.white, border:`1px solid ${saved?c.greenBorder:c.border}`, borderRadius:10, padding:"14px 16px", transition:"border-color .2s" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
        <span style={{ fontSize:10, color:c.hint }}>Curated from</span>
        {domainMeta && <span style={{ fontSize:10, padding:"1px 7px", borderRadius:10, background:domainMeta.bg||c.surfaceAlt, color:domainMeta.col||c.muted, border:`1px solid ${domainMeta.border||c.border}` }}>{domainMeta.label}</span>}
        <span style={{ marginLeft:"auto" }}><StrengthDot str={sig.str}/></span>
      </div>
      <div style={{ fontSize:13, fontWeight:500, color:c.ink, lineHeight:1.35, marginBottom:5 }}>{sig.name}</div>
      <div style={{ fontSize:11, color:c.muted, lineHeight:1.6, marginBottom:10 }}>{sig.desc}</div>
      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
        {sig.cats.map(cat=><span key={cat} style={{ fontSize:10, padding:"1px 6px", borderRadius:4, background:"#f0f0ee", color:c.muted }}>{cat}</span>)}
        <HorizTag h={sig.h}/>
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          {saved ? (
            <span style={{ fontSize:11, color:c.green700, background:c.green50, border:`1px solid ${c.greenBorder}`, borderRadius:6, padding:"3px 9px" }}>✓ Saved to Inbox</span>
          ) : (
            <>
              <button onClick={onSave} style={{ ...btnSm, fontSize:11, padding:"4px 12px" }}>Save to Inbox</button>
              <button onClick={onDismiss} style={{ ...btnG, fontSize:11, padding:"4px 8px", color:c.hint }}>Dismiss</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Screen3({ populated, onboardingData }) {
  const [expanded, setExpanded] = useState(0);
  const [savedSigs, setSavedSigs] = useState({});
  const [dismissedSigs, setDismissedSigs] = useState({});

  // Compute seeded signals from onboarding domains
  const seededSignals = (() => {
    if (populated || !onboardingData) return [];
    const domains = onboardingData.domains || [];
    const pool = domains.flatMap(d => SEEDED_SIGNALS_POOL[d] || []);
    // Deduplicate, take up to 5, prefer High/Moderate strength first
    const prioritised = [...pool].sort((a,b)=>{ const rank={High:0,Moderate:1,Weak:2}; return (rank[a.str]||2)-(rank[b.str]||2); });
    return prioritised.slice(0,5);
  })();

  const visibleSeeded = seededSignals.filter(s=>!dismissedSigs[s.id]);

  const projects = populated ? [
    { name:"AI Governance & Trust", domain:"Technology & AI", mode:"Deep Analysis", inputs:4, clusters:3, scenarios:2, updated:"Today", horizons:"H1–H3" },
    { name:"Future of Remote Work", domain:"Economy & Finance", mode:"Quick Scan", inputs:7, clusters:2, scenarios:0, updated:"3 days ago", horizons:"H1–H2" },
  ] : [];

  return (
    <AppShell active={3}>
      <div style={{ padding:"28px 32px" }}>

        {/* ── First-visit welcome banner ──────────────────────────────────── */}
        {!populated && onboardingData && (
          <div style={{ background:c.ink, borderRadius:12, padding:"20px 24px", marginBottom:24, display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:500, color:c.white, marginBottom:4 }}>
                Welcome, {onboardingData.name} — your workspace is ready.
              </div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.55)", lineHeight:1.6 }}>
                We've curated {visibleSeeded.length} signal{visibleSeeded.length!==1?"s":""} from your chosen domains to get you started.
                {onboardingData.domains.length > 0 && <> Covering: {onboardingData.domains.map(d=>DOMAIN_META.find(m=>m.id===d)?.label).filter(Boolean).join(", ")}.</>}
              </div>
            </div>
            <button style={{ ...btnSm, background:"rgba(255,255,255,0.12)", color:c.white, border:"1px solid rgba(255,255,255,0.18)", flexShrink:0 }}>+ New project</button>
          </div>
        )}

        {/* ── Standard header (populated / no onboarding) ──────────────── */}
        {(populated || !onboardingData) && (
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:28 }}>
            <div>
              <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:c.hint, marginBottom:3 }}>Workspace</div>
              <div style={{ fontSize:22, fontWeight:500, color:c.ink }}>Dashboard</div>
            </div>
            <button style={btnP}>+ New project</button>
          </div>
        )}

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:28 }}>
          {[["Projects",populated?2:0,"active"],["Inputs",populated?11:(Object.keys(savedSigs).length||0),"collected"],["Clusters",populated?5:0,"created"],["Scenarios",populated?2:0,"built"]].map(([label,val,sub])=>(
            <div key={label} style={{ background:c.white, border:`1px solid ${c.border}`, borderRadius:10, padding:"16px 18px" }}>
              <div style={{ fontSize:24, fontWeight:500, color:c.ink, lineHeight:1, marginBottom:4 }}>{val}</div>
              <div style={{ fontSize:11, color:c.muted }}>{label}</div>
              <div style={{ fontSize:10, color:c.hint }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Seeded signals section (first-visit only) ─────────────────── */}
        {!populated && onboardingData && visibleSeeded.length > 0 && (
          <div style={{ marginBottom:28 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:c.ink }}>Curated for you</div>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:c.amber50, color:c.amber700, border:`1px solid ${c.amberBorder}` }}>New · {visibleSeeded.length} signal{visibleSeeded.length!==1?"s":""}</span>
                </div>
                <div style={{ fontSize:11, color:c.muted }}>
                  Drawn from your chosen domains. Save what looks relevant — saved signals appear in your Inbox.
                </div>
              </div>
              <button style={{ ...btnG, fontSize:11, color:c.hint, marginLeft:14, flexShrink:0 }}>View all →</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {visibleSeeded.map(sig=>(
                <SeededSignalCard
                  key={sig.id} sig={sig}
                  saved={!!savedSigs[sig.id]}
                  onSave={()=>setSavedSigs(p=>({...p,[sig.id]:true}))}
                  onDismiss={()=>setDismissedSigs(p=>({...p,[sig.id]:true}))}
                />
              ))}
            </div>
            {visibleSeeded.length > 0 && (
              <div style={{ marginTop:12, padding:"10px 14px", background:c.surfaceAlt, border:`1px solid ${c.border}`, borderRadius:8, fontSize:12, color:c.muted, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ flex:1 }}>Ready to go deeper? Create a project to organise these signals into a structured inquiry.</span>
                <button style={{ ...btnSm, flexShrink:0 }}>+ Create project</button>
              </div>
            )}
          </div>
        )}

        {/* ── Projects section ──────────────────────────────────────────── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:500, color:c.ink }}>Projects</div>
          {populated && <div style={{ fontSize:11, color:c.hint }}>2 active</div>}
        </div>

        {!populated && (
          <div style={{ background:c.white, border:`1px dashed ${c.border}`, borderRadius:12, padding:"40px 24px", textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:10, opacity:0.15 }}>◻</div>
            <div style={{ fontSize:14, fontWeight:500, color:c.muted, marginBottom:5 }}>No projects yet</div>
            <div style={{ fontSize:12, color:c.hint, marginBottom:20, maxWidth:320, margin:"0 auto 20px" }}>
              {onboardingData ? "Create a project to give your inquiry a structured home — then assign the signals you've saved." : "Create your first project to start collecting signals and building scenarios."}
            </div>
            <button style={btnP}>+ New project</button>
          </div>
        )}

        {populated && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {projects.map((p, i)=>(
              <div key={p.name} style={{ background:c.white, border:`1px solid ${expanded===i?c.borderMid:c.border}`, borderRadius:10, overflow:"hidden", transition:"border-color .15s" }}>
                <div onClick={()=>setExpanded(expanded===i?null:i)} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", cursor:"pointer" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:c.ink }}>{p.name}</div>
                    <div style={{ display:"flex", gap:5, marginTop:3 }}>
                      <span style={{ fontSize:11, color:c.muted }}>{p.domain}</span>
                      <span style={{ fontSize:11, color:c.hint }}>·</span>
                      <span style={{ fontSize:11, color:c.muted }}>{p.mode}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:14, fontSize:11, color:c.hint }}>
                    <span>{p.inputs} inputs</span><span>{p.clusters} clusters</span><span>{p.scenarios} scenarios</span>
                  </div>
                  <div style={{ fontSize:10, color:c.hint, minWidth:64, textAlign:"right" }}>{p.updated}</div>
                  <span style={{ fontSize:11, color:c.hint, marginLeft:4, display:"inline-block", transform:expanded===i?"rotate(180deg)":"none", transition:"transform .2s" }}>▾</span>
                </div>
                {expanded===i && (
                  <div style={{ borderTop:`1px solid ${c.border}`, padding:"16px 18px", background:c.surfaceAlt }}>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
                      {[["Inputs",p.inputs],["Clusters",p.clusters],["Scenarios",p.scenarios]].map(([lbl,n])=>(
                        <div key={lbl} style={{ background:c.white, border:`1px solid ${c.border}`, borderRadius:8, padding:"10px 14px" }}>
                          <div style={{ fontSize:20, fontWeight:500, color:c.ink }}>{n}</div>
                          <div style={{ fontSize:11, color:c.muted }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:11, color:c.muted, marginBottom:12 }}>Horizons: {p.horizons} · Last updated {p.updated}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button style={btnSm}>Open project →</button>
                      <button style={btnG}>Settings</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recent inputs feed (populated only) */}
        {populated && (
          <div style={{ marginTop:28 }}>
            <div style={{ fontSize:12, fontWeight:500, color:c.ink, marginBottom:12 }}>Recent inputs</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {INPUTS.slice(0,2).map(i=>(
                <div key={i.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:c.white, border:`1px solid ${c.border}`, borderRadius:8 }}>
                  <StrengthDot str={i.str}/>
                  <div style={{ fontSize:12, color:c.ink, flex:1 }}>{i.name}</div>
                  <div style={{ display:"flex", gap:4 }}>{i.cats.map(cat=><span key={cat} style={{ fontSize:10, padding:"1px 6px", borderRadius:4, background:"#f0f0ee", color:c.muted }}>{cat}</span>)}</div>
                  <HorizTag h={i.h}/>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}


// ─── SCREEN 4: Project Creation ─────────────────────────────────────────────────
function Screen4({ populated }) {
  const [open, setOpen] = useState(populated);
  const p = populated ? PROJ : {};
  return (
    <AppShell active={3}>
      <div style={{ padding:"28px 32px" }}>
        {/* Dimmed dashboard bg */}
        <div style={{ opacity:0.25, marginBottom:20 }}>
          <div style={{ fontSize:22, fontWeight:500, color:c.ink, marginBottom:16 }}>Dashboard</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
            {["Projects","Inputs","Clusters","Scenarios"].map(l=><div key={l} style={{ background:c.white, border:`1px solid ${c.border}`, borderRadius:10, padding:"16px 18px" }}><div style={{ fontSize:22, fontWeight:500 }}>—</div><div style={{ fontSize:11, color:c.muted }}>{l}</div></div>)}
          </div>
        </div>
        {/* Modal */}
        <div style={{ maxWidth:660, background:c.white, border:`1px solid ${c.border}`, borderRadius:14, overflow:"hidden", boxShadow:"0 10px 48px rgba(0,0,0,0.12)" }}>
          <div style={{ padding:"28px 30px 24px" }}>
            <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:c.hint, marginBottom:3 }}>New project</div>
            <div style={{ fontSize:20, fontWeight:500, color:c.ink, marginBottom:4 }}>What are you investigating?</div>
            <div style={{ fontSize:13, color:c.muted, marginBottom:18, lineHeight:1.6 }}>Start with the essentials — add context any time from project settings.</div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:12, fontSize:11, marginBottom:22, background:c.amber50, color:c.amber700, border:`1px solid ${c.amberBorder}` }}>
              ● Advanced — methodology fields available below
            </div>
            {/* Fields */}
            <div style={{ marginBottom:14 }}>
              <div style={fl}>Project name <span style={badg}>required</span></div>
              <input style={inp} type="text" defaultValue={p.name||""} placeholder="e.g. Future of Alternative Proteins"/>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={fl}>Domain <span style={badg}>required</span></div>
              <select style={sel} defaultValue={p.domain||""}>
                <option value="">Select a domain…</option>
                {DOMAINS.map(d=><option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={fl}>Key question <span style={badg}>optional</span></div>
              <div style={fh}>The central question this project seeks to explore.</div>
              <textarea style={ta} rows={3} defaultValue={p.question||""} placeholder="e.g. How might alternative proteins reshape global food supply chains by 2040?"/>
            </div>
            {/* Methodology toggle */}
            <button onClick={()=>setOpen(o=>!o)} style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 14px", margin:"0 0 16px", borderRadius:8, border:open?`1px solid ${c.borderMid}`:`1px dashed ${c.borderMid}`, cursor:"pointer", background:open?c.surfaceAlt:"transparent", width:"100%", fontFamily:"inherit", textAlign:"left" }}>
              <span style={{ fontSize:10, color:c.hint, display:"inline-block", transform:open?"rotate(90deg)":"none", transition:"transform .2s" }}>›</span>
              <span style={{ fontSize:12, color:c.muted }}>{open?"Hide methodology fields":"Show methodology fields"}</span>
              <span style={{ marginLeft:"auto", fontSize:11, color:c.hint }}>{populated?"5 filled":"unit of analysis · time horizons · geographic scope · more"}</span>
            </button>
            {open && (
              <div style={{ marginBottom:4 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:c.hint, margin:"0 0 16px" }}>
                  Methodology fields <div style={{ flex:1, height:"0.5px", background:c.border }}/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                  <div><div style={fl}>Unit of analysis</div><div style={fh}>The specific thing being examined.</div><input style={inp} type="text" defaultValue={p.unit||""} placeholder="e.g. Global supply chains"/></div>
                  <div><div style={fl}>Geographic scope</div><input style={inp} type="text" defaultValue={p.geo||""} placeholder="e.g. North America, Global"/></div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={fl}>Time horizons</div>
                  <div style={fh}>Sets the H1/H2/H3 temporal frame for this project.</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                    <HBlock label="H1 — Near" col={c.green700} a={p.h1a} b={p.h1b} pa="2026" pb="2028"/>
                    <HBlock label="H2 — Transition" col={c.blue700} a={p.h2a} b={p.h2b} pa="2029" pb="2033"/>
                    <HBlock label="H3 — Emerging" col={c.amber700} a={p.h3a} b={p.h3b} pa="2034" pb="2040"/>
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={fl}>Assumptions</div>
                  <textarea style={ta} rows={2} defaultValue={p.assumptions||""} placeholder="Conditions assumed true for this project."/>
                </div>
                <div style={{ marginBottom:4 }}>
                  <div style={fl}>Stakeholders & audience</div>
                  <div style={fh}>Who this work aims to inform.</div>
                  <input style={inp} type="text" defaultValue={p.stakeholders||""} placeholder="e.g. Policy makers, researchers"/>
                </div>
              </div>
            )}
          </div>
          {/* Footer */}
          <div style={{ padding:"14px 30px 22px", borderTop:`1px solid ${c.border}`, display:"flex", alignItems:"center" }}>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:10, marginRight:16 }}>
              <div style={{ flex:1, height:3, borderRadius:2, background:"rgba(0,0,0,.08)", overflow:"hidden" }}>
                <div style={{ height:"100%", borderRadius:2, background:c.ink, width:populated?"88%":"0%", transition:"width .4s ease" }}/>
              </div>
              <div style={{ fontSize:11, color:c.hint, whiteSpace:"nowrap" }}>{populated?"88% complete":"0% complete"}</div>
            </div>
            <button style={btnG}>Cancel</button>
            <button style={{ ...btnP, opacity:populated?1:0.28, marginLeft:8 }}>Create project</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─── SCREEN 5: Input Creation ────────────────────────────────────────────────────
function Screen5({ populated }) {
  const p = populated ? INPUTS[0] : { name:"", desc:"", url:"", cats:[], str:null, h:null };
  const strMap = { High:[c.green700,c.green50,c.greenBorder], Moderate:[c.amber700,c.amber50,c.amberBorder], Weak:[c.red800,c.red50,c.redBorder] };
  return (
    <AppShell active={5}>
      <div style={{ maxWidth:660, padding:"28px 32px" }}>
        <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", color:c.hint, marginBottom:3 }}>New input</div>
        <div style={{ fontSize:20, fontWeight:500, color:c.ink, marginBottom:4 }}>Add a signal</div>
        <div style={{ fontSize:13, color:c.muted, marginBottom:24, lineHeight:1.6 }}>Capture something you've noticed that might matter. Keep it brief — AI will enrich it.</div>
        <div style={{ marginBottom:14 }}>
          <div style={fl}>Signal name <span style={badg}>required</span></div>
          <input style={inp} type="text" defaultValue={p.name} placeholder="What would you call this signal?"/>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={fl}>Description</div>
          <div style={fh}>What makes this signal interesting or relevant to the futures you're tracking?</div>
          <textarea style={ta} rows={4} defaultValue={p.desc} placeholder="Describe what you've noticed and why it might matter…"/>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={fl}>Source URL</div>
          <input style={inp} type="url" defaultValue={p.url} placeholder="https://…"/>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={fl}>STEEPLED category</div>
          <div style={fh}>Select all that apply.</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {STEEPLED.map(cat=>{
              const on = p.cats.includes(cat);
              return <div key={cat} style={{ padding:"5px 12px", borderRadius:16, fontSize:12, border:`1px solid ${on?c.ink:c.border}`, background:on?"rgba(0,0,0,0.05)":c.white, color:on?c.ink:c.muted, cursor:"pointer" }}>{cat}</div>;
            })}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={fl}>Signal strength</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            {["Weak","Moderate","High"].map(s=>{
              const on = p.str===s;
              const [col,bg,brd] = strMap[s];
              return (
                <div key={s} style={{ padding:"12px 14px", borderRadius:8, border:`1px solid ${on?c.ink:c.border}`, background:on?"rgba(0,0,0,0.02)":c.white, cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                    <span style={{ width:8, height:8, borderRadius:"50%", background:on?col:c.hint, display:"inline-block" }}/>
                    <div style={{ fontSize:12, fontWeight:on?500:400, color:c.ink }}>{s}</div>
                    {on && <span style={{ fontSize:11, marginLeft:"auto" }}>✓</span>}
                  </div>
                  <div style={{ fontSize:10, color:c.muted, lineHeight:1.4 }}>{s==="Weak"?"Single source, edge case":s==="Moderate"?"Multiple sources, visible pattern":"Widespread, data-backed"}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={fl}>Horizon</div>
          <div style={{ display:"flex", gap:8 }}>
            {["H1","H2","H3"].map(h=>(
              <div key={h} style={{ padding:"7px 18px", borderRadius:7, fontSize:12, border:`1px solid ${p.h===h?c.ink:c.border}`, background:p.h===h?"rgba(0,0,0,0.04)":c.white, color:p.h===h?c.ink:c.muted, cursor:"pointer", fontWeight:p.h===h?500:400 }}>{h} {p.h===h&&"✓"}</div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:22 }}>
          <div style={fl}>Assign to project</div>
          <select style={sel} defaultValue={populated?"AI Governance & Trust":""}>
            <option value="">Select project…</option>
            <option>AI Governance & Trust</option>
            <option>Future of Remote Work</option>
          </select>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", paddingTop:18, borderTop:`1px solid ${c.border}` }}>
          <button style={{ ...btnP, opacity:populated?1:0.28 }}>Save signal</button>
          <button style={btnG}>Cancel</button>
          {populated && <div style={{ marginLeft:"auto", fontSize:11, color:c.green700, background:c.green50, border:`1px solid ${c.greenBorder}`, borderRadius:6, padding:"3px 9px" }}>◉ AI enrichment runs on save</div>}
        </div>
      </div>
    </AppShell>
  );
}

// ─── SCREEN 6: Clustering ─────────────────────────────────────────────────────────
function Screen6({ populated }) {
  const [tab, setTab] = useState("inputs");
  const tabBtnStyle = (t) => ({
    padding:"8px 14px", fontSize:12, fontWeight:tab===t?500:400, color:tab===t?c.ink:c.muted,
    borderBottom:`2px solid ${tab===t?c.ink:"transparent"}`, cursor:"pointer", background:"transparent",
    border:"none", borderBottom:`2px solid ${tab===t?c.ink:"transparent"}`,
    fontFamily:"inherit", marginBottom:-1,
  });
  return (
    <AppShell active={6}>
      <div style={{ padding:"28px 32px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:6 }}>
          <div>
            <div style={{ fontSize:11, color:c.hint, marginBottom:2 }}>AI Governance & Trust →</div>
            <div style={{ fontSize:20, fontWeight:500, color:c.ink }}>Clustering</div>
          </div>
          <button style={btnSm}>+ New cluster</button>
        </div>
        <div style={{ fontSize:13, color:c.muted, marginBottom:20 }}>{populated?"4 inputs · 2 AI suggestions · 3 clusters":"No inputs yet — add signals to this project first."}</div>
        {/* Tabs */}
        <div style={{ borderBottom:`1px solid ${c.border}`, marginBottom:22, display:"flex", gap:2 }}>
          {[["inputs","Inputs","4"],["suggestions","AI Suggestions","2"],["clusters","Clusters","3"]].map(([id,lbl,count])=>(
            <button key={id} onClick={()=>setTab(id)} style={{ ...tabBtnStyle(id), display:"flex", alignItems:"center", gap:5 }}>
              {lbl}
              {populated && <span style={{ fontSize:10, padding:"0 5px", borderRadius:8, background:tab===id?"rgba(0,0,0,0.07)":"rgba(0,0,0,0.04)", color:tab===id?c.ink:c.hint, lineHeight:"18px" }}>{count}</span>}
            </button>
          ))}
        </div>
        {/* Inputs */}
        {tab==="inputs" && !populated && <div style={{ background:c.white, border:`1px dashed ${c.border}`, borderRadius:10, padding:"52px 24px", textAlign:"center" }}><div style={{ fontSize:32, opacity:0.15, marginBottom:12 }}>◉</div><div style={{ fontSize:13, fontWeight:500, color:c.muted, marginBottom:6 }}>No inputs yet</div><div style={{ fontSize:12, color:c.hint }}>Add signals to your project to start clustering.</div></div>}
        {tab==="inputs" && populated && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {INPUTS.map(inp=>(
              <div key={inp.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"13px 16px", background:c.white, border:`1px solid ${c.border}`, borderRadius:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:500, color:c.ink, marginBottom:3 }}>{inp.name}</div>
                  <div style={{ fontSize:11, color:c.muted, lineHeight:1.45, marginBottom:7 }}>{inp.desc.slice(0,90)}…</div>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {inp.cats.map(cat=><span key={cat} style={{ fontSize:10, padding:"1px 6px", borderRadius:4, background:"#f0f0ee", color:c.muted }}>{cat}</span>)}
                    <StrengthDot str={inp.str}/>
                    <HorizTag h={inp.h}/>
                  </div>
                </div>
                <button style={{ ...btnG, fontSize:11, flexShrink:0, marginTop:2 }}>Assign →</button>
              </div>
            ))}
          </div>
        )}
        {/* AI Suggestions */}
        {tab==="suggestions" && !populated && <div style={{ background:c.white, border:`1px dashed ${c.border}`, borderRadius:10, padding:"52px 24px", textAlign:"center" }}><div style={{ fontSize:13, fontWeight:500, color:c.muted, marginBottom:6 }}>No suggestions yet</div><div style={{ fontSize:12, color:c.hint }}>Add more inputs to unlock AI pattern detection.</div></div>}
        {tab==="suggestions" && populated && (
          <div>
            <div style={{ padding:"10px 14px", background:c.amber50, border:`1px solid ${c.amberBorder}`, borderRadius:8, marginBottom:16, fontSize:12, color:c.amber700, display:"flex", alignItems:"center", gap:8 }}>
              ◉ AI has identified 2 patterns across your inputs
            </div>
            {[
              { name:"Governance divergence", iids:[0,2], why:"Inputs 1 and 3 both relate to distinct national regulatory approaches to AI, pointing to growing fragmentation in global AI governance.", conf:0.87 },
              { name:"Trust & credibility signals", iids:[1,3], why:"Inputs 2 and 4 both indicate weakening confidence in AI institutions — one a behavioural signal from a lab, one public perception data.", conf:0.74 },
            ].map((sug, i)=>(
              <div key={i} style={{ background:c.white, border:`1px solid ${c.border}`, borderRadius:10, padding:"16px 18px", marginBottom:10 }}>
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:c.ink }}>{sug.name}</div>
                  <span style={{ fontSize:11, color:c.green700, background:c.green50, border:`1px solid ${c.greenBorder}`, borderRadius:6, padding:"2px 8px", flexShrink:0 }}>{Math.round(sug.conf*100)}% match</span>
                </div>
                <div style={{ fontSize:11, color:c.muted, lineHeight:1.55, marginBottom:10 }}>{sug.why}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                  {sug.iids.map(idx=><span key={idx} style={{ fontSize:11, padding:"3px 8px", borderRadius:5, background:"#f0f0ee", color:c.muted }}>{INPUTS[idx].name.slice(0,40)}…</span>)}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button style={btnSm}>Accept as cluster</button>
                  <button style={btnG}>Edit name</button>
                  <button style={{ ...btnG, color:c.red800 }}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Clusters */}
        {tab==="clusters" && !populated && <div style={{ background:c.white, border:`1px dashed ${c.border}`, borderRadius:10, padding:"52px 24px", textAlign:"center" }}><div style={{ fontSize:13, fontWeight:500, color:c.muted, marginBottom:6 }}>No clusters yet</div><div style={{ fontSize:12, color:c.hint }}>Accept AI suggestions or create clusters manually.</div></div>}
        {tab==="clusters" && populated && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {CLUSTERS.map(cl=>(
              <div key={cl.id} style={{ background:c.white, border:`1px solid ${c.border}`, borderRadius:10, padding:"14px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:c.ink }}>{cl.name}</div>
                  <SubtypeTag sub={cl.sub}/>
                  <HorizTag h={cl.h}/>
                </div>
                <div style={{ fontSize:11, color:c.muted, lineHeight:1.5, marginBottom:8 }}>{cl.desc}</div>
                <div style={{ fontSize:11, color:c.hint }}>{cl.iids.length} inputs linked · {cl.iids.length===0?"Add inputs":"View inputs →"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ─── SCREEN 7: Scenario Mapping ──────────────────────────────────────────────────
const NP = { 1:{x:80,y:80}, 2:{x:80,y:200}, 3:{x:80,y:320}, s1:{x:400,y:110}, s2:{x:400,y:280} };

function Screen7({ populated }) {
  const [sel, setSel] = useState(populated?"s1":null);
  return (
    <AppShell active={7} scroll={false}>
      <div style={{ display:"flex", height:"100%" }}>
        {/* Left panel */}
        <div style={{ width:210, borderRight:`1px solid ${c.border}`, padding:"16px 12px", overflowY:"auto", background:c.surfaceAlt, flexShrink:0 }}>
          <div style={{ fontSize:11, fontWeight:500, color:c.ink, marginBottom:12 }}>Cluster library</div>
          {!populated && <div style={{ fontSize:11, color:c.hint, fontStyle:"italic", lineHeight:1.5 }}>No clusters yet. Create clusters first to map scenarios.</div>}
          {populated && CLUSTERS.map(cl=>(
            <div key={cl.id} style={{ background:c.white, border:`1px solid ${c.border}`, borderRadius:8, padding:"10px 12px", marginBottom:7, cursor:"grab" }}>
              <div style={{ fontSize:11, fontWeight:500, color:c.ink, marginBottom:5 }}>{cl.name}</div>
              <div style={{ display:"flex", gap:4 }}>
                <SubtypeTag sub={cl.sub}/>
                <HorizTag h={cl.h}/>
              </div>
            </div>
          ))}
          {populated && (
            <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${c.border}` }}>
              <div style={{ fontSize:11, fontWeight:500, color:c.ink, marginBottom:10 }}>Scenarios</div>
              {SCENARIOS.slice(0,2).map(sc=>(
                <div key={sc.id} style={{ background:c.ink, borderRadius:8, padding:"8px 12px", marginBottom:6, cursor:"pointer" }}>
                  <div style={{ fontSize:11, fontWeight:500, color:c.white, marginBottom:2 }}>{sc.name}</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{sc.arch}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Canvas */}
        <div style={{ flex:1, position:"relative", background:c.canvas, backgroundImage:"radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)", backgroundSize:"22px 22px", overflow:"hidden" }}>
          {!populated && (
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center" }}>
              <div style={{ fontSize:28, opacity:0.1, marginBottom:12 }}>◆</div>
              <div style={{ fontSize:13, fontWeight:500, color:c.muted, marginBottom:6 }}>Empty canvas</div>
              <div style={{ fontSize:11, color:c.hint }}>Drag clusters from the library to start mapping scenarios.</div>
            </div>
          )}
          {populated && (
            <>
              {/* Connection lines */}
              <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
                {SCENARIOS.slice(0,2).map(sc=>sc.cids.map(cId=>{
                  const cp=NP[cId], sp=NP[`s${sc.id}`];
                  if(!cp||!sp) return null;
                  return <line key={`${cId}-s${sc.id}`} x1={cp.x+145} y1={cp.y+18} x2={sp.x} y2={sp.y+18} stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" strokeDasharray={sc.id===2?"5,5":"none"}/>;
                }))}
              </svg>
              {/* Cluster nodes */}
              {CLUSTERS.map(cl=>(
                <div key={cl.id} onClick={()=>setSel(String(cl.id))} style={{ position:"absolute", left:NP[cl.id].x, top:NP[cl.id].y, background:c.white, border:`1.5px solid ${sel===String(cl.id)?c.ink:c.border}`, borderRadius:9, padding:"9px 13px", width:145, cursor:"pointer", boxShadow:sel===String(cl.id)?"0 3px 14px rgba(0,0,0,0.14)":"0 1px 4px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontSize:11, fontWeight:500, color:c.ink, marginBottom:5, lineHeight:1.3 }}>{cl.name}</div>
                  <SubtypeTag sub={cl.sub}/>
                </div>
              ))}
              {/* Scenario nodes */}
              {SCENARIOS.slice(0,2).map(sc=>(
                <div key={sc.id} onClick={()=>setSel(`s${sc.id}`)} style={{ position:"absolute", left:NP[`s${sc.id}`].x, top:NP[`s${sc.id}`].y, background:c.ink, borderRadius:9, padding:"10px 14px", width:190, cursor:"pointer", boxShadow:sel===`s${sc.id}`?"0 4px 18px rgba(0,0,0,0.28)":"0 1px 6px rgba(0,0,0,0.18)" }}>
                  <div style={{ fontSize:11, fontWeight:500, color:c.white, marginBottom:3, lineHeight:1.3 }}>{sc.name}</div>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{sc.arch} · {sc.h}</div>
                </div>
              ))}
              {/* Horizon bands */}
              {[{label:"H1",x:80,col:c.green700},{label:"H2",x:280,col:c.blue700},{label:"H3",x:460,col:c.amber700}].map(hb=>(
                <div key={hb.label} style={{ position:"absolute", top:14, left:hb.x, fontSize:10, fontWeight:500, color:hb.col, background:c.white, padding:"2px 8px", borderRadius:4, border:`1px solid ${c.border}`, letterSpacing:"0.04em" }}>{hb.label}</div>
              ))}
            </>
          )}
        </div>
        {/* Inspector */}
        <div style={{ width:240, borderLeft:`1px solid ${c.border}`, padding:16, overflowY:"auto", flexShrink:0 }}>
          <div style={{ fontSize:11, fontWeight:500, color:c.ink, marginBottom:12 }}>Inspector</div>
          {!sel && <div style={{ fontSize:11, color:c.hint, fontStyle:"italic" }}>Select a node to inspect</div>}
          {sel && populated && (()=>{
            const isS = sel.startsWith("s");
            const item = isS ? SCENARIOS.find(s=>`s${s.id}`===sel) : CLUSTERS.find(cl=>cl.id===parseInt(sel));
            if(!item) return null;
            return (
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:c.ink, marginBottom:6, lineHeight:1.3 }}>{item.name}</div>
                {isS ? (
                  <>
                    <div style={{ display:"flex", gap:5, marginBottom:10 }}><ArchTag arch={item.arch}/><HorizTag h={item.h}/></div>
                    <div style={{ fontSize:11, color:c.muted, lineHeight:1.5, marginBottom:14 }}>{item.narrative.slice(0,120)}…</div>
                    <button style={btnSm}>Open narrative →</button>
                  </>
                ) : (
                  <>
                    <div style={{ display:"flex", gap:5, marginBottom:10 }}><SubtypeTag sub={item.sub}/><HorizTag h={item.h}/></div>
                    <div style={{ fontSize:11, color:c.muted, lineHeight:1.5, marginBottom:10 }}>{item.desc}</div>
                    <div style={{ fontSize:10, color:c.hint, marginBottom:12 }}>{item.iids.length} inputs</div>
                    <button style={btnSm}>Edit cluster</button>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </AppShell>
  );
}

// ─── SCREEN 8: Scenario Narrative Canvas ─────────────────────────────────────────
function Screen8({ populated }) {
  const [sel, setSel] = useState(populated ? 1 : null);
  const archCol = { Collapse:[c.red800,c.red50,c.redBorder], Discipline:[c.blue700,c.blue50,c.blueBorder], Growth:[c.green700,c.green50,c.greenBorder], Transformation:[c.amber700,c.amber50,c.amberBorder] };
  return (
    <AppShell active={8} scroll={false}>
      <div style={{ display:"flex", height:"100%" }}>
        {/* Spatial canvas */}
        <div style={{ flex:1, position:"relative", overflow:"hidden", background:c.bg }}>
          {/* Axis guides */}
          <div style={{ position:"absolute", left:26, top:0, bottom:0, width:"0.5px", background:c.border }}/>
          <div style={{ position:"absolute", top:26, left:0, right:0, height:"0.5px", background:c.border }}/>
          {/* Axis labels */}
          <div style={{ position:"absolute", bottom:10, left:"50%", transform:"translateX(-50%)", fontSize:10, color:c.hint, letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap" }}>← More uncertain · More certain →</div>
          <div style={{ position:"absolute", left:4, top:"50%", transform:"translateY(-50%) rotate(-90deg)", fontSize:10, color:c.hint, letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap" }}>← Disruptive · Continuous →</div>
          {/* Quadrant labels */}
          {populated && [
            { label:"Uncertain + Disruptive", top:32, left:40, anchor:"left" },
            { label:"Certain + Disruptive", top:32, right:20, anchor:"right" },
            { label:"Uncertain + Continuous", bottom:32, left:40 },
            { label:"Certain + Continuous", bottom:32, right:20 },
          ].map((q,i)=>(
            <div key={i} style={{ position:"absolute", fontSize:10, color:"rgba(0,0,0,0.12)", textTransform:"uppercase", letterSpacing:"0.06em", ...q }}>{q.label}</div>
          ))}
          {!populated && (
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center" }}>
              <div style={{ fontSize:28, opacity:0.1, marginBottom:12 }}>◆</div>
              <div style={{ fontSize:13, fontWeight:500, color:c.muted, marginBottom:6 }}>Narrative canvas</div>
              <div style={{ fontSize:11, color:c.hint }}>Generate or create scenarios to place them in the scenario space.</div>
            </div>
          )}
          {populated && SCENARIOS.map(sc=>{
            const [col,bg,brd] = archCol[sc.arch];
            const isSelected = sel===sc.id;
            return (
              <div key={sc.id} onClick={()=>setSel(sc.id)} style={{
                position:"absolute", left:`${sc.x+6}%`, top:`${sc.y+5}%`,
                background:isSelected?c.ink:c.white,
                border:`1.5px solid ${isSelected?c.ink:c.border}`,
                borderRadius:12, padding:"13px 15px", width:210, cursor:"pointer",
                boxShadow:isSelected?"0 6px 24px rgba(0,0,0,0.2)":"0 2px 8px rgba(0,0,0,0.06)",
                transition:"all .15s",
              }}>
                <div style={{ marginBottom:7 }}>
                  <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:isSelected?"rgba(255,255,255,0.14)":bg, color:isSelected?"rgba(255,255,255,0.7)":col, border:`1px solid ${isSelected?"rgba(255,255,255,0.2)":brd}` }}>{sc.arch}</span>
                </div>
                <div style={{ fontSize:12, fontWeight:500, color:isSelected?c.white:c.ink, marginBottom:4, lineHeight:1.3 }}>{sc.name}</div>
                <div style={{ fontSize:10, color:isSelected?"rgba(255,255,255,0.45)":c.hint }}>{sc.tag}</div>
              </div>
            );
          })}
        </div>
        {/* Narrative panel */}
        <div style={{ width:290, borderLeft:`1px solid ${c.border}`, display:"flex", flexDirection:"column", overflow:"hidden", flexShrink:0 }}>
          <div style={{ padding:"14px 16px", borderBottom:`1px solid ${c.border}`, fontSize:11, fontWeight:500, color:c.ink }}>
            Scenario narrative
          </div>
          {!sel && <div style={{ padding:16, fontSize:11, color:c.hint, fontStyle:"italic", lineHeight:1.5 }}>Select a scenario card to read its narrative.</div>}
          {sel && populated && (()=>{
            const sc = SCENARIOS.find(s=>s.id===sel);
            if(!sc) return null;
            const [col,bg,brd] = archCol[sc.arch];
            return (
              <div style={{ flex:1, overflowY:"auto", padding:16 }}>
                <span style={{ fontSize:10, padding:"2px 8px", borderRadius:10, background:bg, color:col, border:`1px solid ${brd}`, display:"inline-block", marginBottom:10 }}>{sc.arch}</span>
                <div style={{ fontSize:14, fontWeight:500, color:c.ink, marginBottom:4, lineHeight:1.3 }}>{sc.name}</div>
                <div style={{ fontSize:11, color:c.hint, marginBottom:16 }}>{sc.tag}</div>
                <div style={{ fontSize:12, color:c.muted, lineHeight:1.75, marginBottom:20 }}>{sc.narrative}</div>
                <div style={{ padding:"12px 14px", background:c.surfaceAlt, border:`1px solid ${c.border}`, borderRadius:8, marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:500, color:c.ink, marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Linked clusters</div>
                  {sc.cids.map(cid=>{
                    const cl = CLUSTERS.find(c=>c.id===cid);
                    return cl ? <div key={cid} style={{ fontSize:11, color:c.muted, marginBottom:5, display:"flex", alignItems:"center", gap:6 }}><SubtypeTag sub={cl.sub}/>{cl.name}</div> : null;
                  })}
                </div>
                <button style={{ ...btnSm, width:"100%", marginBottom:8 }}>Generate full narrative</button>
                <button style={{ ...btnSec, width:"100%", fontSize:12 }}>Edit scenario</button>
              </div>
            );
          })()}
        </div>
      </div>
    </AppShell>
  );
}

// ─── Prototype shell ─────────────────────────────────────────────────────────────
const SCREENS_META = [
  { id:1, label:"Login" },
  { id:2, label:"Onboarding" },
  { id:3, label:"Dashboard" },
  { id:4, label:"Project Creation" },
  { id:5, label:"Input Creation" },
  { id:6, label:"Clustering" },
  { id:7, label:"Scenario Mapping" },
  { id:8, label:"Narrative Canvas" },
];


export default function App() {
  const [screen, setScreen]             = useState(1);
  const [populated, setPopulated]       = useState(false);
  const [onboardingData, setOnboarding] = useState({
    name: "Sam", level: "intermediate",
    domains: ["health","gov","tech"],
    purpose: "strategy",
  });

  const go = (n) => { setScreen(n); setPopulated(false); };

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Helvetica Neue',system-ui,sans-serif", height:"100vh", display:"flex", flexDirection:"column", color:c.ink, background:c.bg }}>
      {/* Controls bar */}
      <div style={{ height:48, flexShrink:0, background:c.white, borderBottom:`1px solid ${c.border}`, display:"flex", alignItems:"center", padding:"0 14px", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, color:c.ink, flexShrink:0 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:c.ink }}/>
          <span>Future Signals v2</span>
        </div>
        <div style={{ width:"0.5px", height:20, background:c.border, flexShrink:0 }}/>
        <div style={{ display:"flex", gap:1, flex:1, overflowX:"auto" }}>
          {SCREENS_META.map(s=>(
            <button key={s.id} onClick={()=>go(s.id)} style={{ padding:"4px 9px", borderRadius:5, fontSize:11, fontWeight:screen===s.id?500:400, color:screen===s.id?c.ink:c.hint, background:screen===s.id?"rgba(0,0,0,0.06)":"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0 }}>
              {s.id}. {s.label}
            </button>
          ))}
        </div>
        <div style={{ width:"0.5px", height:20, background:c.border, flexShrink:0 }}/>
        <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
          <span style={{ fontSize:10, color:c.hint, textTransform:"uppercase", letterSpacing:"0.07em" }}>State</span>
          <div style={{ display:"flex", background:"rgba(0,0,0,0.05)", borderRadius:6, padding:2, gap:1 }}>
            {[["empty","Empty"],["populated","Populated"]].map(([id,lbl])=>(
              <button key={id} onClick={()=>setPopulated(id==="populated")} style={{ padding:"3px 10px", borderRadius:4, fontSize:11, fontWeight:(id==="populated"?populated:!populated)?500:400, background:(id==="populated"?populated:!populated)?c.white:"transparent", color:(id==="populated"?populated:!populated)?c.ink:c.hint, border:"none", cursor:"pointer", fontFamily:"inherit" }}>{lbl}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", gap:2, flexShrink:0 }}>
          <button onClick={()=>go(Math.max(1,screen-1))} style={{ ...btnG, padding:"4px 9px", fontSize:12, opacity:screen===1?0.25:1 }}>←</button>
          <button onClick={()=>go(Math.min(8,screen+1))} style={{ ...btnG, padding:"4px 9px", fontSize:12, opacity:screen===8?0.25:1 }}>→</button>
        </div>
      </div>
      {/* Screen */}
      <div style={{ flex:1, overflow:"hidden" }}>
        {screen===1 && <Screen1 key={`1-${populated}`} populated={populated}/>}
        {screen===2 && <Screen2 key={`2-${populated}`} populated={populated} onComplete={data=>{ setOnboarding(data); }}/>}
        {screen===3 && <Screen3 key={`3-${populated}`} populated={populated} onboardingData={onboardingData}/>}
        {screen===4 && <Screen4 key={`4-${populated}`} populated={populated}/>}
        {screen===5 && <Screen5 key={`5-${populated}`} populated={populated}/>}
        {screen===6 && <Screen6 key={`6-${populated}`} populated={populated}/>}
        {screen===7 && <Screen7 key={`7-${populated}`} populated={populated}/>}
        {screen===8 && <Screen8 key={`8-${populated}`} populated={populated}/>}
      </div>
    </div>
  );
}
