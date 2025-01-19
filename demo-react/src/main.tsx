import { createRoot } from "react-dom/client";
// @ts-ignore: no type
import GetUserMediaMock from "@theopenweb/get-user-media-mock";
import App from "./App.tsx";

const urlParams = new URLSearchParams(window.location.search);
// @ts-ignore: no type
window.getUserMediaMock = new GetUserMediaMock();
if (urlParams.get("mock") !== null) {
  // @ts-ignore: no type
  window.getUserMediaMock.mock();
  console.log("force mock");
} else {
  // @ts-ignore: no type
  window.getUserMediaMock.fallbackMock();
  console.log("fallback mock");
}

createRoot(document.getElementById("root")!).render(
  <App />,
);
