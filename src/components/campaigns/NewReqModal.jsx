// src/components/campaigns/NewReqModal.jsx — "New Requirement" modal:
// guided conversational brief wizard or manual form. Submissions are still
// local-only until a portal submission endpoint exists on the backend.

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { useApp } from "../../context";
import { popModal, overlayFade } from "../../lib/motion";
import { chipOn, chipOff, inputCls, labelCls, closeBtnCls } from "./mapping";

const useP = () => useApp().P;

const NICHES = ["Lifestyle","Fashion","Fitness","Dance","Music","Storytellers","Video Editors","Animation Artists","Mommy and Baby","Housewives","Food Reviews","Cooking Recipes"];
const SIZES = ["Nano","Micro","Macro","Mega","Celebrity"];
const AGE_GROUPS = ["18–24","25–30","31–40","41–50","50+"];
const REGIONS_ST = ["Maharashtra","Karnataka","Tamil Nadu","Kerala","Telangana","Delhi NCR","Uttar Pradesh","Gujarat","Rajasthan","West Bengal","Assam","Punjab","Madhya Pradesh","Bihar","Odisha","Goa"];
const TIERS = ["Tier 1","Tier 2","Tier 3"];
const LANGUAGES = ["Hindi","English","Tamil","Telugu","Kannada","Malayalam","Marathi","Bengali","Gujarati","Punjabi","Odia","Assamese","Urdu"];
const PLATFORMS = ["Instagram","YouTube","LinkedIn","Facebook","Reddit","X (Twitter)","Snapchat","Pinterest"];
const SERVICES_ALL = ["Influencer Marketing","AEO","Offline Activation"];
const IM_PRODUCTS = [{id:"reel_collab",label:"Reel — Collab"},{id:"reel_non_collab",label:"Reel — Non-Collab"},{id:"carousel_single",label:"Carousel — Single"},{id:"carousel_multi",label:"Carousel — Multi"},{id:"story",label:"Story"}];
const TEAM = [{name:"Rahul Sharma",role:"Manager"},{name:"Priya Nair",role:"Manager"},{name:"Arjun Reddy",role:"Executive"},{name:"Sneha Iyer",role:"Executive"},{name:"Vikram Das",role:"Manager"},{name:"Meera Joshi",role:"Executive"}];

/* ── Form utilities ── */
function Stepper({ value, onChange, min = 1 }) {
  const b = "flex size-[28px] items-center justify-center rounded-[8px] border border-line bg-white/70 text-[14px] text-ink shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md active:translate-y-0";
  return (<div className="flex items-center gap-2"><button className={`${b} ${value <= min ? "opacity-30" : ""}`} onClick={() => onChange(Math.max(min, value - 1))}>−</button><span className="min-w-6 text-center text-[14px] font-semibold text-ink">{value}</span><button className={b} onClick={() => onChange(value + 1)}>+</button></div>);
}

function Slider({ value, onChange, min = 0, max = 100, step = 1, suffix = "" }) {
  const P = useP(); const pct = ((value - min) / (max - min)) * 100;
  return (<div className="flex w-full items-center gap-2"><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full outline-none" style={{ background: `linear-gradient(to right,${P.accent} ${pct}%,${P.barBg} ${pct}%)` }}/><span className="min-w-12 text-right text-[12.5px] font-semibold text-ink">{value}{suffix}</span></div>);
}

function ChipSelect({ options, selected, onChange }) {
  return (<div className="flex flex-wrap gap-1.5">{options.map(o => { const a = selected.includes(o); return (<button key={o} onClick={() => onChange(a ? selected.filter(x => x !== o) : [...selected, o])} className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium transition-all duration-150 ${a ? chipOn : chipOff}`}>{o}</button>); })}</div>);
}

function DropdownSelect({ options: io, value, onChange, placeholder, allowNew }) {
  const [open, setOpen] = useState(false); const [opts, setOpts] = useState(io); const [nv, setNv] = useState(""); const ref = useRef(null);
  useEffect(() => { if (!open) return; const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={`flex w-full items-center justify-between rounded-[10px] border border-line bg-white/70 px-3 py-2 text-left text-[13px] backdrop-blur-sm transition-all duration-200 ${value ? "text-ink" : "text-mute"}`}><span className="truncate">{value || placeholder}</span><span className="text-[10px] text-mute">▾</span></button>
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+5px)] z-[60] max-h-[170px] overflow-y-auto rounded-[12px] border border-line bg-white/95 py-1 shadow-[0_16px_40px_rgba(25,22,17,0.14)] backdrop-blur-xl">
          {opts.map(o => (<div key={o} onClick={() => { onChange(o); setOpen(false); }} className="cursor-pointer px-3 py-1.5 text-[12px] text-ink transition-colors hover:bg-accent/[0.06]">{o}</div>))}
          {allowNew && (<div className="flex gap-1 border-t border-line px-2.5 py-1.5"><input value={nv} onChange={e => setNv(e.target.value)} placeholder="Add new..." className="flex-1 rounded-lg border border-line bg-white/70 px-2 py-1 text-[12px] text-ink outline-none"/><button onClick={() => { if (nv.trim()) { setOpts(p => [...p, nv.trim()]); onChange(nv.trim()); setNv(""); setOpen(false); } }} className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">Add</button></div>)}
        </div>
      )}
    </div>
  );
}

/* ═══ GUIDED BRIEF WIZARD — step-by-step conversational flow ═══ */
function GuidedBriefWizard({ onComplete }) {
  const STEPS = [
    { id: "service", q: "What service are you looking for?", options: ["Influencer Marketing", "AEO", "Offline Activation"] },
    { id: "description", q: "Describe your campaign goal in a sentence or two.", type: "text", placeholder: "e.g. Launch awareness for our new summer snack range..." },
    { id: "budget", q: "What's your budget range?", options: ["Under ₹5L", "₹5L – ₹15L", "₹15L – ₹50L", "₹50L – ₹1.5Cr"] },
    { id: "category", q: "Which brand category or team is this for?", options: ["Snacks", "Beverages", "Health & Wellness", "Fashion", "Beauty", "Other"], allowCustom: true },
    { id: "platforms", q: "Which platforms should we target?", options: ["Instagram", "YouTube", "LinkedIn", "Facebook", "Reddit", "X (Twitter)"], multi: true, condition: (d) => d.service === "Influencer Marketing" },
    { id: "numCreators", q: "How many creators are you thinking?", options: ["1 – 5", "6 – 15", "16 – 30", "30+"], condition: (d) => d.service === "Influencer Marketing" },
    { id: "creatorNiche", q: "What kind of creators? Pick all that apply.", options: ["Lifestyle", "Fashion", "Fitness", "Food Reviews", "Cooking Recipes", "Dance", "Music", "Storytellers", "Mommy and Baby", "Housewives"], multi: true, condition: (d) => d.service === "Influencer Marketing" },
    { id: "creatorSize", q: "What creator tier do you prefer?", options: ["Nano", "Micro", "Macro", "Mega", "Celebrity", "Mix of sizes"], condition: (d) => d.service === "Influencer Marketing" },
    { id: "usage", q: "What usage rights do you need?", options: ["Ad Rights (time-limited)", "Media Rights (perpetual)"], condition: (d) => d.service === "Influencer Marketing" },
    { id: "region", q: "Any specific regions or states to target?", type: "text", placeholder: "e.g. South India, Maharashtra, Pan-India..." },
    { id: "reference", q: "Any reference creators or campaign links? (optional)", type: "text", placeholder: "Paste a profile link or skip...", optional: true },
  ];

  const [step, setStep] = useState(0); const [data, setData] = useState({}); const [msgs, setMsgs] = useState([]); const [customInput, setCustomInput] = useState(""); const [multiSel, setMultiSel] = useState([]); const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, step]);

  // Initialize first message
  useEffect(() => { setMsgs([{ role: "assistant", content: STEPS[0].q }]); }, []);

  const getNextStep = (curIdx) => {
    for (let i = curIdx + 1; i < STEPS.length; i++) { if (!STEPS[i].condition || STEPS[i].condition(data)) return i; }
    return -1;
  };

  const advance = (answer) => {
    const curStep = STEPS[step];
    const newData = { ...data, [curStep.id]: answer }; setData(newData);
    const newMsgs = [...msgs, { role: "user", content: Array.isArray(answer) ? answer.join(", ") : answer }];

    const nextIdx = getNextStep(step);
    if (nextIdx === -1) {
      // Done
      const budgetMap = { "Under ₹5L": 3, "₹5L – ₹15L": 10, "₹15L – ₹50L": 30, "₹50L – ₹1.5Cr": 100 };
      newMsgs.push({ role: "assistant", content: "All set! Here's your brief summary. Review and submit." });
      setMsgs(newMsgs); setStep(-1);
      setData({ ...newData, _budgetNum: budgetMap[newData.budget] || 10 });
    } else {
      newMsgs.push({ role: "assistant", content: STEPS[nextIdx].q });
      setMsgs(newMsgs); setStep(nextIdx); setMultiSel([]); setCustomInput("");
    }
  };

  const handleOption = (opt) => advance(opt);
  const handleMultiConfirm = () => { if (multiSel.length) advance(multiSel); };
  const handleTextSubmit = () => { const v = customInput.trim(); if (v) advance(v); else if (STEPS[step]?.optional) advance("—"); };
  const handleSkip = () => advance("—");

  const curStep = step >= 0 && step < STEPS.length ? STEPS[step] : null;
  const isDone = step === -1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto py-1">
        {msgs.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={`mb-2 flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[85%] rounded-[14px] border px-3.5 py-2.5 text-[13px] leading-normal text-ink shadow-sm ${m.role === "user" ? "border-accent/[0.1] bg-accent/[0.05]" : "border-line bg-white/70"}`}>{m.content}</div>
          </motion.div>
        ))}
        <div ref={endRef}/>
      </div>

      {/* Options / Input area */}
      {curStep && !isDone && (
        <div className="border-t border-line pt-2.5">
          {curStep.type === "text" ? (
            <div className="flex gap-1.5">
              <input value={customInput} onChange={e => setCustomInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleTextSubmit()} placeholder={curStep.placeholder || "Type here..."} className="flex-1 rounded-[12px] border border-line bg-white/70 px-3.5 py-2.5 text-[13px] text-ink outline-none transition-all duration-200 focus:border-accent/40 focus:shadow-[0_0_0_3px_rgba(44,62,126,0.08)]"/>
              <button onClick={handleTextSubmit} className={`rounded-[12px] px-4 py-2.5 text-[12px] font-semibold shadow-sm transition-all duration-150 ${customInput.trim() ? "bg-accent text-white hover:-translate-y-px hover:shadow-md" : "bg-well text-mute"}`}>Next</button>
              {curStep.optional && <button onClick={handleSkip} className="rounded-[12px] border border-line bg-well/70 px-3 py-2.5 text-[12px] text-mute">Skip</button>}
            </div>
          ) : curStep.multi ? (
            <div>
              <div className="mb-2 flex flex-wrap gap-1.5">{curStep.options.map(o => { const sel = multiSel.includes(o); return (<button key={o} onClick={() => setMultiSel(sel ? multiSel.filter(x => x !== o) : [...multiSel, o])} className={`rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-150 ${sel ? chipOn : chipOff}`}>{o}</button>); })}</div>
              <button onClick={handleMultiConfirm} disabled={!multiSel.length} className={`w-full rounded-[12px] py-2 text-[12px] font-semibold shadow-sm transition-all duration-150 ${multiSel.length ? "cursor-pointer bg-accent text-white hover:-translate-y-px hover:shadow-md" : "cursor-not-allowed bg-well text-mute"}`}>Confirm ({multiSel.length} selected)</button>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-1.5">{curStep.options.map(o => (<button key={o} onClick={() => handleOption(o)} className="rounded-full border border-accent/[0.15] bg-accent/[0.04] px-4 py-1.5 text-[12px] font-medium text-accent shadow-sm transition-all duration-150 hover:-translate-y-px hover:bg-accent/[0.08] hover:shadow-md">{o}</button>))}</div>
              {curStep.allowCustom && (
                <div className="mt-2 flex gap-1.5">
                  <input value={customInput} onChange={e => setCustomInput(e.target.value)} placeholder="Or type your own..." className="flex-1 rounded-[10px] border border-line bg-white/70 px-3 py-1.5 text-[12px] text-ink outline-none"/>
                  <button onClick={handleTextSubmit} disabled={!customInput.trim()} className={`rounded-[10px] px-3 py-1.5 text-[12px] font-semibold shadow-sm ${customInput.trim() ? "bg-accent text-white" : "bg-well text-mute"}`}>Go</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary + Submit */}
      {isDone && (
        <div className="border-t border-line pt-2.5">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-green">Brief Summary</div>
          <div className="rounded-[14px] border border-green/[0.15] bg-white/70 px-3 py-2.5 text-[12px] leading-relaxed text-ink shadow-sm backdrop-blur-sm">
            {data.service && <div><span className="text-mute">Service:</span> {data.service}</div>}
            {data.description && data.description !== "—" && <div><span className="text-mute">Goal:</span> {data.description}</div>}
            {data.budget && <div><span className="text-mute">Budget:</span> {data.budget}</div>}
            {data.category && data.category !== "—" && <div><span className="text-mute">Category:</span> {data.category}</div>}
            {data.platforms && data.platforms !== "—" && <div><span className="text-mute">Platforms:</span> {data.platforms}</div>}
            {data.numCreators && <div><span className="text-mute">Creators:</span> {data.numCreators}</div>}
            {data.creatorNiche && <div><span className="text-mute">Niches:</span> {data.creatorNiche}</div>}
            {data.creatorSize && <div><span className="text-mute">Size:</span> {data.creatorSize}</div>}
            {data.usage && <div><span className="text-mute">Usage:</span> {data.usage}</div>}
            {data.region && data.region !== "—" && <div><span className="text-mute">Region:</span> {data.region}</div>}
          </div>
          <button onClick={() => onComplete({ svc: data.service || "Influencer Marketing", budget: data._budgetNum || 10, description: data.description || "Campaign brief" })} className="mt-2.5 w-full rounded-[12px] bg-accent py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_18px_rgba(44,62,126,0.3)] transition-all duration-200 hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(44,62,126,0.4)]">Submit Requirement</button>
        </div>
      )}
    </div>
  );
}

/* ═══ NEW REQ MODAL ═══ */
export default function NewReqModal({ onClose, onSubmit }) {
  const P = useP(); const [mode, setMode] = useState(null);
  const [svc, setSvc] = useState(""); const [budgetText, setBudgetText] = useState("5");
  const [numCreators, setNumCreators] = useState(5); const [niches, setNiches] = useState([]); const [sizes, setSizes] = useState([]); const [ageGroups, setAgeGroups] = useState([]); const [regions, setRegions] = useState([]); const [tiers, setTiers] = useState([]); const [languages, setLanguages] = useState([]); const [platforms, setPlatforms] = useState([]);
  const [products, setProducts] = useState([]); const [productVols, setProductVols] = useState({}); const [usage, setUsage] = useState(""); const [adDays, setAdDays] = useState(30);
  const [description, setDescription] = useState(""); const [refLink, setRefLink] = useState(""); const [brandCat, setBrandCat] = useState(""); const [poc1, setPoc1] = useState(""); const [poc2, setPoc2] = useState(""); const [creatorDesc, setCreatorDesc] = useState("");

  const handleBudgetInput = (v) => setBudgetText(v);
  const toggleProduct = (id) => { if (products.includes(id)) { setProducts(products.filter(p => p !== id)); const pv = { ...productVols }; delete pv[id]; setProductVols(pv); } else setProducts([...products, id]); };
  const canSubmit = svc && parseFloat(budgetText) > 0 && description.trim();
  const showPlatform = svc === "Influencer Marketing";
  const modeCard = "flex-1 cursor-pointer rounded-[18px] border border-line bg-white/70 px-4 py-6 text-center shadow-sm backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-[3px] hover:border-accent/25 hover:shadow-[0_14px_32px_rgba(25,22,17,0.08)]";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      <motion.div variants={overlayFade} initial="hidden" animate="show" exit="exit" onClick={onClose} className="absolute inset-0 bg-[rgba(3,6,16,0.5)] backdrop-blur-[8px]"/>
      <motion.div variants={popModal} initial="hidden" animate="show" exit="exit"
        className="glass-panel relative flex max-h-[90vh] w-[min(560px,94vw)] flex-col overflow-hidden rounded-[24px]">
        <div className="flex items-center justify-between border-b border-line px-6 pb-3.5 pt-5">
          <div><h3 className="font-serif text-[20px] italic font-semibold text-ink">New Requirement</h3></div>
          <div className="flex gap-1.5">
            {mode && <button onClick={() => setMode(null)} className="rounded-full border border-line bg-well/70 px-2.5 py-1 text-[11px] text-sub transition-colors hover:text-ink">← Back</button>}
            <button onClick={onClose} className={closeBtnCls}>✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {!mode && (
            <div className="flex gap-3 py-5">
              <div onClick={() => setMode("chat")} className={modeCard}>
                <div className="mb-2.5 text-2xl">💬</div><div className="mb-1 text-[13.5px] font-semibold text-ink">Guided Brief</div><div className="text-[12px] leading-normal text-sub">Answer step-by-step questions. We'll build the brief for you.</div>
              </div>
              <div onClick={() => setMode("form")} className={modeCard}>
                <div className="mb-2.5 text-2xl">📋</div><div className="mb-1 text-[13.5px] font-semibold text-ink">Manual Form</div><div className="text-[12px] leading-normal text-sub">Fill each field yourself.</div>
              </div>
            </div>
          )}
          {mode === "chat" && <GuidedBriefWizard onComplete={d => onSubmit({ svc: d.svc || d.service || "Influencer Marketing", budget: d.budget || 5, description: d.description || "Campaign brief" })}/>}
          {mode === "form" && (<>
            <div className="mb-3"><label className={labelCls}>Service</label><div className="flex gap-1.5">{SERVICES_ALL.map(s => (<button key={s} onClick={() => setSvc(s)} className={`flex-1 rounded-[10px] border py-2 text-[12px] font-medium transition-all duration-150 ${svc === s ? chipOn : chipOff}`}>{s}</button>))}</div></div>
            <div className="mb-3"><label className={labelCls}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What do you want to achieve..." className={`${inputCls} resize-y leading-normal`}/></div>
            <div className="mb-3"><label className={labelCls}>Brand Category</label><DropdownSelect options={["Snacks","Beverages","Health","Fashion","Beauty","Tech","FMCG","D2C"]} value={brandCat} onChange={setBrandCat} placeholder="Select..." allowNew/></div>
            <div className="mb-3 flex gap-2">
              <div className="flex-1"><label className={labelCls}>POC 1</label><DropdownSelect options={TEAM.map(m => `${m.name} (${m.role})`)} value={poc1} onChange={setPoc1} placeholder="Select..."/></div>
              <div className="flex-1"><label className={labelCls}>POC 2</label><DropdownSelect options={TEAM.map(m => `${m.name} (${m.role})`)} value={poc2} onChange={setPoc2} placeholder="Select..."/></div>
            </div>

            {/* Budget — slider + manual, capped at 1.5CR (150L) */}
            <div className="mb-3"><label className={labelCls}>Budget (Lakhs ₹) — max 1.5 Cr</label>
              <div className="flex items-center gap-2.5">
                <input type="range" min={1} max={150} step={0.5} value={parseFloat(budgetText) || 1} onChange={e => { setBudgetText(e.target.value); }} className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full outline-none" style={{ background: `linear-gradient(to right,${P.accent} ${((parseFloat(budgetText) || 1) / 150) * 100}%,${P.barBg} ${((parseFloat(budgetText) || 1) / 150) * 100}%)` }}/>
                <div className="flex items-center gap-1 rounded-lg border border-line bg-white/70 px-1.5 py-1">
                  <span className="text-[12.5px] text-mute">₹</span>
                  <input type="number" min={1} max={150} step={0.5} value={budgetText} onChange={e => handleBudgetInput(e.target.value)} className="w-[50px] bg-transparent p-1 text-center text-[12.5px] text-ink outline-none"/>
                  <span className="text-[12px] text-mute">L</span>
                </div>
              </div>
            </div>

            {showPlatform && <div className="mb-3"><label className={labelCls}>Platform</label><ChipSelect options={PLATFORMS} selected={platforms} onChange={setPlatforms}/></div>}
            {svc === "Influencer Marketing" && (<>
              <div className="mb-3 flex items-center justify-between"><label className={`${labelCls} mb-0`}>Number of Creators</label><Stepper value={numCreators} onChange={setNumCreators}/></div>
              <div className="mb-3 rounded-[14px] border border-line bg-white/60 px-3.5 py-3 shadow-sm backdrop-blur-sm">
                <div className={`${labelCls} mb-2`}>Creator Requirements</div>
                <div className="mb-2"><label className={`${labelCls} text-[10px]`}>Niche</label><ChipSelect options={NICHES} selected={niches} onChange={setNiches}/></div>
                <div className="mb-2"><label className={`${labelCls} text-[10px]`}>Size</label><ChipSelect options={SIZES} selected={sizes} onChange={setSizes}/></div>
                <div className="mb-2"><label className={`${labelCls} text-[10px]`}>Age</label><ChipSelect options={AGE_GROUPS} selected={ageGroups} onChange={setAgeGroups}/></div>
                <div className="mb-2"><label className={`${labelCls} text-[10px]`}>Region</label><ChipSelect options={REGIONS_ST} selected={regions} onChange={setRegions}/></div>
                <div className="mb-2 flex gap-2">
                  <div className="flex-1"><label className={`${labelCls} text-[10px]`}>Tier</label><ChipSelect options={TIERS} selected={tiers} onChange={setTiers}/></div>
                  <div className="flex-1"><label className={`${labelCls} text-[10px]`}>Language</label><DropdownSelect options={LANGUAGES} value="" onChange={v => { if (!languages.includes(v)) setLanguages([...languages, v]); }} placeholder="Add..."/></div>
                </div>
                {languages.length > 0 && <div className="mb-1.5 flex flex-wrap gap-1">{languages.map(l => (<span key={l} className="flex items-center gap-1 rounded-full bg-accent/[0.08] px-2 py-0.5 text-[10.5px] text-accent shadow-sm">{l}<button onClick={() => setLanguages(languages.filter(x => x !== l))} className="p-0 text-[10px] text-mute hover:text-red">×</button></span>))}</div>}
              </div>
              <div className="mb-3"><label className={labelCls}>Product & Volume</label><div className="flex flex-col gap-1.5">{IM_PRODUCTS.map(p => { const a = products.includes(p.id); return (<div key={p.id} className="flex items-center gap-1.5"><button onClick={() => toggleProduct(p.id)} className={`flex-1 rounded-[10px] border px-3 py-1.5 text-left text-[11px] font-medium transition-all duration-150 ${a ? chipOn : chipOff}`}>{p.label}</button>
                {a && <input type="number" min={1} value={productVols[p.id] || 1} onChange={e => setProductVols({ ...productVols, [p.id]: Math.max(1, parseInt(e.target.value) || 1) })} className="w-[42px] rounded-lg border border-line bg-white/70 p-1 text-center text-[12px] text-ink outline-none"/>}</div>); })}</div></div>
              <div className="mb-3"><label className={labelCls}>Usage Rights</label><div className="flex gap-1.5">{[{ id: "ad", label: "Ad Rights" }, { id: "media", label: "Media (Perpetual)" }].map(u => (<button key={u.id} onClick={() => setUsage(u.id)} className={`flex-1 rounded-[10px] border py-2 text-[12px] font-medium transition-all duration-150 ${usage === u.id ? chipOn : chipOff}`}>{u.label}</button>))}</div>
                {usage === "ad" && <div className="mt-1.5"><Slider value={adDays} onChange={setAdDays} min={7} max={365} step={1} suffix="d"/></div>}</div>
              <div className="mb-3"><label className={labelCls}>Reference Creator</label><input value={refLink} onChange={e => setRefLink(e.target.value)} placeholder="Profile link..." className={inputCls}/></div>
            </>)}
            {svc === "AEO" && <div className="mb-3"><label className={labelCls}>Target Queries</label><textarea value={creatorDesc} onChange={e => setCreatorDesc(e.target.value)} rows={3} placeholder="Queries to rank for..." className={`${inputCls} resize-y`}/></div>}
            {svc === "Offline Activation" && <><div className="mb-3"><label className={labelCls}>Activation Type</label><textarea value={creatorDesc} onChange={e => setCreatorDesc(e.target.value)} rows={2} placeholder="Pop-up, sampling..." className={`${inputCls} resize-y`}/></div><div className="mb-3"><label className={labelCls}>Locations</label><input value={refLink} onChange={e => setRefLink(e.target.value)} placeholder="Mumbai, Bangalore..." className={inputCls}/></div></>}
            <button onClick={() => { if (canSubmit) onSubmit({ svc, budget: parseFloat(budgetText), description, details: { brandCat, poc1, poc2, platforms, numCreators, niches, sizes, ageGroups, regions, tiers, languages, products, productVols, usage, adDays, refLink, creatorDesc } }); }} className={`w-full rounded-[12px] py-2.5 text-[12.5px] font-semibold shadow-sm transition-all duration-200 ${canSubmit ? "cursor-pointer bg-accent text-white hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(44,62,126,0.35)]" : "cursor-not-allowed bg-well text-mute"}`}>Submit</button>
          </>)}
        </div>
      </motion.div>
    </div>
  );
}
