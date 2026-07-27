import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

// Marketing-site typefaces ship as packages; the portal's Sora/Newsreader are
// still loaded from Google Fonts in index.html.
import "@fontsource-variable/instrument-sans/index.css";
import "@fontsource-variable/jost/index.css";
import "@fontsource/instrument-serif/index.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "./styles/index.css";

import { router } from "./routes";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
