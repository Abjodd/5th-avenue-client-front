import { useState } from "react";
import { Search, Plus, ArrowRight, Sparkles } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import {
  Button, IconButton, Card, CardTitle, Badge, Chip, StatCard, Input, Select,
  SegmentedControl, Tabs, Toggle, Modal, Sheet, Tooltip, Kbd, Avatar, Skeleton,
  EmptyState, ProgressRing, Slider, ToastProvider, useToast,
} from "../components/primitives";
import { AnimatedNumber } from "../motion/AnimatedNumber";
import { Sparkline, LineChart, DonutChart, BarList, Funnel, StackedBar } from "../components/charts";
import { IndiaMap } from "../components/map/IndiaMap";
import { fmtL, fmtNum } from "../lib/format";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <p className="mb-4 font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">{title}</p>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

function Inner() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [seg, setSeg] = useState("founder");
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [on, setOn] = useState(true);
  const [slider, setSlider] = useState(40);
  const [chip, setChip] = useState(true);
  const [num, setNum] = useState(26.5);

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-10 flex items-center justify-between">
        <h1 className="font-serif text-title-lg text-ink">Style guide</h1>
        <Button variant="outline" onClick={toggleTheme}>Theme: {theme}</Button>
      </div>

      <Section title="Typography">
        <div className="space-y-2">
          <p className="font-serif text-display-lg text-ink">Marketing that compounds.</p>
          <p className="text-title font-semibold text-ink">Section title 20px</p>
          <p className="text-body text-ink-2">Body 14 — the quick brown fox jumps over the lazy dog.</p>
          <p className="font-mono text-eyebrow uppercase tracking-[0.12em] text-ink-3">01 — Eyebrow mono</p>
        </div>
      </Section>

      <Section title="Buttons">
        <Button variant="primary" icon={Plus}>Primary</Button>
        <Button variant="outline" iconRight={ArrowRight}>Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="success">Success</Button>
        <Button loading>Loading</Button>
        <IconButton icon={Search} label="Search" />
        <Button onClick={() => toast("Saved to your workspace", "success")}>Fire toast</Button>
      </Section>

      <Section title="Badges & chips">
        <Badge tone="accent" dot>Active</Badge>
        <Badge tone="success">Paid</Badge>
        <Badge tone="danger">Overdue</Badge>
        <Badge tone="warning">Pending</Badge>
        <Badge tone="pink">Concept</Badge>
        <Chip selected={chip} count={5} onClick={() => setChip(!chip)}>Selectable</Chip>
        <Chip count={2}>Unselected</Chip>
      </Section>

      <Section title="Inputs">
        <Input icon={Search} placeholder="Search…" className="w-56" />
        <Select options={[{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }]} />
        <SegmentedControl value={seg} onChange={setSeg} options={[{ value: "founder", label: "Founder" }, { value: "manager", label: "Manager" }, { value: "content", label: "Content" }]} />
        <Toggle checked={on} onChange={setOn} label="toggle" />
        <div className="w-56"><Slider value={slider} onChange={(e) => setSlider(+e.target.value)} /></div>
        <Tooltip label="Command palette"><Kbd>⌘K</Kbd></Tooltip>
        <Avatar initials="RS" />
      </Section>

      <Section title="Stat cards + animated numbers">
        <StatCard label="Total reach" value={<AnimatedNumber value={num * 1e6} format={fmtNum} />} delta={{ value: "12%", direction: "up" }} hint="vs last period" spark={<Sparkline data={[4, 6, 5, 8, 7, 11, 26]} />} />
        <StatCard label="Spend" value={<AnimatedNumber value={num} format={fmtL} />} delta={{ value: "3%", direction: "down" }} />
        <Button onClick={() => setNum(Math.round((15 + Math.random() * 40) * 10) / 10)}>Reroll numbers</Button>
      </Section>

      <Section title="Tabs">
        <div className="w-full">
          <Tabs active={tab} onChange={setTab} tabs={[{ id: "overview", label: "Overview" }, { id: "brief", label: "Brief", count: 2 }, { id: "creators", label: "Creators", count: 5 }]} />
        </div>
      </Section>

      <Section title="Charts">
        <Card className="w-full max-w-xl">
          <CardTitle title="Reach vs Spend" hint="small multiples — one axis each" />
          <LineChart
            labels={["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"]}
            primary={{ label: "Reach", color: "var(--viz-blue)", values: [8.2, 11.5, 14.2, 18.6, 22.3, 26.5], format: (n) => `${n.toFixed(0)}M` }}
            secondary={{ label: "Spend", color: "var(--viz-pink)", values: [28, 35, 42, 48, 56, 48.5], format: (n) => `₹${n.toFixed(0)}L` }}
          />
        </Card>
        <Card>
          <CardTitle title="Spend split" />
          <DonutChart centerValue="₹48.5L" centerLabel="total" data={[{ label: "Influencer", value: 30, color: "var(--viz-blue)" }, { label: "AEO", value: 12, color: "var(--viz-green)" }, { label: "Ads", value: 6.5, color: "var(--viz-pink)" }]} />
        </Card>
        <Card className="w-72">
          <CardTitle title="By niche" />
          <BarList avg={5} items={[{ label: "Food", value: 6.2, display: "6.2%", color: "var(--viz-blue)", flag: "high" }, { label: "Fitness", value: 5.4, display: "5.4%", color: "var(--viz-green)" }, { label: "Lifestyle", value: 3.0, display: "3.0%", color: "var(--viz-purple)", flag: "low" }]} />
        </Card>
        <Card className="w-96">
          <CardTitle title="Funnel" />
          <Funnel stages={[{ stage: "Reach", value: 65, display: "6.6M", color: "var(--viz-purple)" }, { stage: "Views", value: 100, display: "17M", color: "var(--viz-blue)" }, { stage: "Engagements", value: 22, display: "310K", color: "var(--viz-pink)" }]} />
        </Card>
        <Card className="w-full max-w-md">
          <CardTitle title="By campaign" />
          <StackedBar segments={[{ label: "Diwali", value: 12.5, color: "var(--viz-blue)", display: "₹12.5L" }, { label: "Snack Ads", value: 15, color: "var(--viz-pink)", display: "₹15L" }, { label: "Micro Wave", value: 4, color: "var(--viz-green)", display: "₹4L" }]} />
        </Card>
      </Section>

      <Section title="India map (35 states)">
        <Card className="w-96"><IndiaMap showBubbles /></Card>
      </Section>

      <Section title="Progress + states">
        <ProgressRing value={slider} />
        <Card className="w-72"><EmptyState icon={Sparkles} title="Nothing here yet" description="Adjust your filters to see creators." /></Card>
        <div className="flex w-56 flex-col gap-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-16 w-full" /></div>
      </Section>

      <Section title="Overlays">
        <Button onClick={() => setModal(true)}>Open modal</Button>
        <Button onClick={() => setSheet(true)}>Open sheet</Button>
        <Modal open={modal} onClose={() => setModal(false)} title="New requirement">
          <div className="p-5 text-body text-ink-2">Modal body content. Press Esc or click the scrim to close.</div>
        </Modal>
        <Sheet open={sheet} onClose={() => setSheet(false)}>
          <div className="p-6"><h2 className="font-serif text-title-lg text-ink">Campaign detail</h2><p className="mt-2 text-body text-ink-2">Right-edge slide-over used for campaign and map drill-downs.</p></div>
        </Sheet>
      </Section>
    </div>
  );
}

export default function Styleguide() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg">
        <Inner />
      </div>
    </ToastProvider>
  );
}
