import { useEffect } from "react";
import Dashboard from "./pages/Dashboard";

function App() {
  // Register service worker for offline-first support (NASA Space Apps Challenge)
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("FieldShift ServiceWorker registered with scope: ", registration.scope);
          })
          .catch((error) => {
            console.log("FieldShift ServiceWorker registration failed: ", error);
          });
      });
    }
  }, []);

  return <Dashboard />;
}

export default App;