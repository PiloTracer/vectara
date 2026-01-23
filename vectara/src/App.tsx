import { useEffect, useState } from "react";
import Gatekeeper from "./components/Gatekeeper";
import Settings from "./components/Settings";
import Login from "./components/Login";
import "./App.css";

function App() {
  const [hash, setHash] = useState(window.location.hash);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <main>
      {hash === "#/settings" ? <Settings /> : <Gatekeeper />}
    </main>
  );
}

export default App;
