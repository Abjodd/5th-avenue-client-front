/* Single GSAP import point — every module imports gsap from here so
   plugins are registered exactly once. */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, Flip, SplitText, useGSAP);

export { gsap, ScrollTrigger, Flip, SplitText, useGSAP };
