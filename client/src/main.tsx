import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { APPLICATION_METADATA } from "@shared/appMetadata";

document.title = APPLICATION_METADATA.displayName;

createRoot(document.getElementById("root")!).render(<App />);
