import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@capacitor/app";
import { AppShell } from "../../src/components/AppShell";
import { createMobilePromptFetch } from "./promptTransport";
import { installNativeBackHandler } from "./nativeBack";
import { installWorksheetExporter } from "@/pdf/worksheetExport";
import { nativeWorksheetExporter } from "./nativeWorksheetExport";
import "../../src/app/globals.css";

declare const __PROMPT_API_URL__: string;

window.fetch = createMobilePromptFetch(
  window.fetch.bind(window),
  __PROMPT_API_URL__,
);

document.documentElement.dataset["nativeApp"] = "true";
installWorksheetExporter(nativeWorksheetExporter);
void installNativeBackHandler(App, window);

const root = document.getElementById("root");
if (!root) throw new Error("Mobile application root is missing");

createRoot(root).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
