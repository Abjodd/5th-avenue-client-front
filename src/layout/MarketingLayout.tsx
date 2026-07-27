import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ScrollTrigger } from "../motion/gsap";
import { Nav } from "../pages/landing/sections/Nav";
import { Footer } from "../pages/landing/sections/Footer";

/** Shared chrome for every public marketing page (landing + Network/Tech/
    Creatives): film grain, fixed Nav, an <Outlet/> and the Footer. */
export default function MarketingLayout() {
  const { pathname } = useLocation();

  // Scroll to top on route change + refresh scroll triggers once fonts settle.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    const t = setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => clearTimeout(t);
  }, [pathname]);

  return (
    <div data-marketing className="relative min-h-screen bg-bg">
      <div className="fa-grain" aria-hidden />
      <Nav />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
