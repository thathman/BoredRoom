import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { initInstallPromptCapture } from "./lib/pwa";

// Capture the real beforeinstallprompt as early as possible (it fires once).
initInstallPromptCapture();

createRoot(document.getElementById("root")!).render(<App />);
