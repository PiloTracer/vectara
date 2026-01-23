import { useEffect, useState } from "react";
import Gatekeeper from "./components/Gatekeeper";
import Settings from "./components/Settings";
import "./App.css";

function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  return (
    <main>
      {hash === "#/settings" ? <Settings /> : <Gatekeeper />}
    </main>
  );
}

export default App;
