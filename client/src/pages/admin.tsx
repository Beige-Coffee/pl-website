import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { type DashboardData } from "../components/admin/admin-data";
import OverviewView from "../components/admin/OverviewView";
import StudentsView from "../components/admin/StudentsView";
import ContentView from "../components/admin/ContentView";
import SystemView from "../components/admin/SystemView";

type View = "overview" | "students" | "content" | "system";

const ADMIN_SESSION_KEY = "pl_admin_session";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function getSavedSession(): string | null {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const { password, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    return password;
  } catch {
    return null;
  }
}

function saveSession(pw: string) {
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ password: pw, expiresAt: Date.now() + SESSION_TTL_MS }));
}

function clearSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

const cardClass = "border-4 border-border bg-card p-4 pixel-shadow";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeView, setActiveView] = useState<View>("overview");
  const [storedPassword, setStoredPassword] = useState("");
  const [ipAllowed, setIpAllowed] = useState<boolean | null>(null);

  const fetchDashboard = useCallback(async (pw: string) => {
    if (!pw) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/dashboard?password=${encodeURIComponent(pw)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to load dashboard");
        setAuthed(false);
        clearSession();
        return;
      }
      const json = await res.json();
      setData(json);
      setAuthed(true);
      setStoredPassword(pw);
      saveSession(pw);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/check-ip")
      .then((r) => {
        if (!r.ok) return { allowed: false };
        return r.json();
      })
      .then((d) => {
        setIpAllowed(!!d.allowed);
        if (d.allowed) {
          const savedPw = getSavedSession();
          if (savedPw) fetchDashboard(savedPw);
        }
      })
      .catch(() => setIpAllowed(false));
  }, [fetchDashboard]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDashboard(password);
  };

  const refresh = () => {
    fetchDashboard(storedPassword);
  };

  if (ipAllowed === null) return null;

  if (!ipAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="font-pixel text-sm text-foreground/40">404 - PAGE NOT FOUND</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-8">
        <div className={`${cardClass} max-w-md w-full`}>
          <h1 className="font-pixel text-lg mb-6 text-center">ADMIN LOGIN</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full border-2 border-border p-3 bg-background font-mono text-sm focus:outline-none focus:border-primary"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full font-pixel text-sm border-2 border-border bg-primary text-black px-4 py-3 pixel-shadow hover:bg-primary/80 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            >
              {loading ? "LOADING..." : "LOGIN"}
            </button>
            {error && <div className="font-pixel text-xs text-red-500 text-center">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const views: { key: View; label: string }[] = [
    { key: "overview", label: "OVERVIEW" },
    { key: "students", label: `STUDENTS (${data.userCount})` },
    { key: "content", label: "CONTENT" },
    { key: "system", label: "SYSTEM" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="w-full border-b-4 border-border bg-card p-2 flex justify-between items-center pixel-shadow">
        <Link href="/">
          <span className="font-pixel text-sm hover:text-primary transition-colors cursor-pointer">
            &lt; BACK
          </span>
        </Link>
        <span className="font-pixel text-sm">ADMIN DASHBOARD</span>
        <button
          onClick={refresh}
          className="font-pixel text-[10px] border-2 border-border px-3 py-1 bg-primary text-black hover:bg-primary/80"
        >
          {loading ? "..." : "REFRESH"}
        </button>
      </div>

      {/* Horizontal tab bar */}
      <div className="w-full border-b-2 border-border bg-card flex">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key)}
            className={`font-pixel text-[11px] px-5 py-3 transition-all cursor-pointer ${
              activeView === v.key
                ? "bg-primary/20 border-b-2 border-b-[#FFD700] text-foreground font-semibold -mb-[2px]"
                : "hover:bg-primary/5 text-foreground/60"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
        {error && <div className="font-pixel text-xs text-red-500 mb-4">{error}</div>}

        {activeView === "overview" && (
          <OverviewView data={data} onNavigate={(view) => setActiveView(view as View)} />
        )}
        {activeView === "students" && (
          <StudentsView data={data} storedPassword={storedPassword} onRefresh={refresh} />
        )}
        {activeView === "content" && (
          <ContentView data={data} />
        )}
        {activeView === "system" && (
          <SystemView data={data} storedPassword={storedPassword} onRefresh={refresh} />
        )}
      </div>
    </div>
  );
}
