// Phase → icon. Split out of lib/phases.js so that registry stays pure logic:
// portalMetrics.js imports it and runs under `node --test`, which has no
// business loading a React icon library to answer what phase a campaign is in.
//
// Line icons rather than the emoji that used to sit in the registry (📋 🔍 🎬
// 🟢 ✅). Emoji render at their own size, weight and colour on every platform,
// so a row of five arrived as five different-looking objects and no amount of
// CSS could line them up with the label beside them. These inherit currentColor
// and take the phase's own tint.
import { ClipboardList, Search, Clapperboard, Radio, CircleCheck } from "lucide-react";

export const PHASE_ICONS = {
  brief: ClipboardList,
  shortlist: Search,
  production: Clapperboard,
  live: Radio,
  completed: CircleCheck,
};
