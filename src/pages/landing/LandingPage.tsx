import { Suspense, lazy } from "react";
import { Hero } from "./sections/Hero";
import { MetricsStrip } from "./sections/MetricsStrip";

const DashboardTour = lazy(() =>
  import("./sections/DashboardTour").then((m) => ({ default: m.DashboardTour })),
);
const NetworkMap = lazy(() =>
  import("./sections/NetworkMap").then((m) => ({ default: m.NetworkMap })),
);
const ServicesIndex = lazy(() =>
  import("./sections/ServicesIndex").then((m) => ({ default: m.ServicesIndex })),
);
const CtaBand = lazy(() =>
  import("./sections/CtaBand").then((m) => ({ default: m.CtaBand })),
);

const Placeholder = () => <div className="min-h-[60vh]" />;

/** Landing page body — rendered inside MarketingLayout's shared <main>
    (Nav / Footer / grain live in the layout). */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <MetricsStrip />
      <Suspense fallback={<Placeholder />}>
        <DashboardTour />
      </Suspense>
      <Suspense fallback={<Placeholder />}>
        <NetworkMap />
      </Suspense>
      <Suspense fallback={<Placeholder />}>
        <ServicesIndex />
      </Suspense>
      <Suspense fallback={<Placeholder />}>
        <CtaBand />
      </Suspense>
    </>
  );
}
