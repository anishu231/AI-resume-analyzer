// src/pages/Dashboard.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  Download,
  LayoutGrid,
  List,
  Clock,
  X,
  Upload,
  Trash2,
  Search,
  Users,
  Gauge,
  Trophy,
  ThumbsUp,
  AlertCircle,
  Check,
} from "lucide-react";
import type { Candidate } from "../types";

const API = "https://anish321-ats-resume-analyzer.hf.space/api";
const LEGACY = "legacy"; // candidates saved without a session id

// ---------- helpers ----------
const scoreOf = (c: Candidate) => Number(c.score) || 0;

const tier = (s: number) => {
  if (s >= 80) return { label: "Strong match", chip: "bg-green-100 text-green-800", text: "text-green-700", bar: "#15803d", ring: "#16a34a" };
  if (s >= 60) return { label: "Good match", chip: "bg-lime-100 text-lime-800", text: "text-lime-700", bar: "#65a30d", ring: "#65a30d" };
  if (s >= 40) return { label: "Fair match", chip: "bg-amber-100 text-amber-800", text: "text-amber-700", bar: "#d97706", ring: "#d97706" };
  return { label: "Needs improvement", chip: "bg-red-100 text-red-700", text: "text-red-600", bar: "#dc2626", ring: "#dc2626" };
};

const fmtDate = (ms: number) =>
  ms
    ? new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "Earlier session";

const kw = (c: Candidate): string[] => c.matched_keywords ?? c.match_report?.matched_keywords ?? [];

function ScoreRing({ value, size = 56 }: { value: number; size?: number }) {
  const t = tier(value);
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} role="img" aria-label={`Score ${Math.round(value)} percent`}>
      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
      <circle
        cx="18" cy="18" r="15.9" fill="none" stroke={t.ring} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={`${Math.min(Math.max(value, 0), 100)} 100`} transform="rotate(-90 18 18)"
      />
      <text x="18" y="21.3" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1f2937">
        {Math.round(value)}
      </text>
    </svg>
  );
}

type Session = {
  id: string;
  list: Candidate[];
  latest: number;
  count: number;
  avg: number;
  top: Candidate;
  shortlisted: number;
};

export default function Dashboard() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ msg: string; expired?: boolean } | null>(null);

  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState<"score-desc" | "score-asc" | "name">("score-desc");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [currentId, setCurrentId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------- load ----------
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API}/dashboard/`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) {
        setError({ msg: "Your session has expired. Please log in again.", expired: true });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCandidates(data.candidates ?? []);
    } catch (err) {
      console.error("Error fetching candidates:", err);
      setError({ msg: "Failed to load candidates. The server may be waking up, please try again." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // close modals with Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (sessionToDelete) setSessionToDelete(null);
      else setShowHistory(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sessionToDelete]);

  // ---------- sessions ----------
  const sessions: Session[] = useMemo(() => {
    const map = new Map<string, Candidate[]>();
    candidates.forEach((c) => {
      const k = c.session_id || LEGACY;
      const arr = map.get(k);
      if (arr) arr.push(c);
      else map.set(k, [c]);
    });
    return [...map.entries()]
      .map(([id, list]) => {
        const scores = list.map(scoreOf);
        return {
          id,
          list,
          latest: Math.max(...list.map((c) => (c.analyzed_at ? new Date(c.analyzed_at).getTime() : 0))),
          count: list.length,
          avg: Math.round(scores.reduce((a, b) => a + b, 0) / list.length),
          top: list.reduce((t, c) => (scoreOf(c) > scoreOf(t) ? c : t), list[0]),
          shortlisted: scores.filter((s) => s >= 60).length,
        };
      })
      .sort((a, b) => b.latest - a.latest);
  }, [candidates]);

  const activeId = currentId && sessions.some((s) => s.id === currentId) ? currentId : sessions[0]?.id ?? null;
  const current = sessions.find((s) => s.id === activeId);
  const batch = current?.list ?? [];
  const otherSessions = sessions.filter((s) => s.id !== activeId);

  // ---------- stats for current batch ----------
  const stats = useMemo(() => {
    if (!current) return null;
    return {
      count: current.count,
      avg: current.avg,
      top: current.top,
      shortlisted: current.shortlisted,
      passRate: Math.round((current.shortlisted / current.count) * 100),
    };
  }, [current]);

  const distribution = useMemo(() => {
    const d = [
      { label: "Strong (80+)", n: 0, color: "bg-green-600" },
      { label: "Good (60–79)", n: 0, color: "bg-lime-500" },
      { label: "Fair (40–59)", n: 0, color: "bg-amber-500" },
      { label: "Low (<40)", n: 0, color: "bg-red-500" },
    ];
    batch.forEach((c) => {
      const s = scoreOf(c);
      d[s >= 80 ? 0 : s >= 60 ? 1 : s >= 40 ? 2 : 3].n++;
    });
    return d;
  }, [batch]);

  // ---------- filter + sort ----------
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = batch.filter((c) => c.name.toLowerCase().includes(q) && scoreOf(c) >= minScore);
    return list.sort((a, b) =>
      sortBy === "name" ? a.name.localeCompare(b.name) : sortBy === "score-asc" ? scoreOf(a) - scoreOf(b) : scoreOf(b) - scoreOf(a)
    );
  }, [batch, search, minScore, sortBy]);

  const chartData = useMemo(
    () =>
      [...batch]
        .sort((a, b) => scoreOf(b) - scoreOf(a))
        .slice(0, 10)
        .map((c) => ({
          name: c.name.length > 14 ? `${c.name.slice(0, 13)}…` : c.name,
          fullName: c.name,
          score: scoreOf(c),
        })),
    [batch]
  );

  // ---------- actions ----------
  const exportToCSV = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["Name", "Score", "Status", "Matched Keywords", "Analysed on", "Session"];
    const rows = shown.map((c) => [
      c.name,
      scoreOf(c),
      tier(scoreOf(c)).label,
      kw(c).join("; "),
      c.analyzed_at ? new Date(c.analyzed_at).toLocaleString("en-IN") : "",
      (c.session_id || "N/A").slice(0, 14),
    ]);
    const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ats_results_${(activeId || "export").slice(0, 14)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSession = (id: string) => {
    setCurrentId(id);
    setShowHistory(false);
    setSearch("");
    setMinScore(0);
  };

  const deleteSession = async (id: string) => {
    setDeleting(true);
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(`${API}/delete-session/${id}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      setCandidates((prev) => prev.filter((c) => c.session_id !== id));
      if (id === currentId) setCurrentId(null);
      toast.success("Batch deleted");
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
      setSessionToDelete(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setMinScore(0);
  };

  // ---------- states ----------
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-67px)] bg-gray-50" aria-busy="true">
        <div className="h-44 animate-pulse bg-green-600/80" />
        <div className="mx-auto -mt-14 grid max-w-6xl grid-cols-2 gap-4 px-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
        </div>
        <p className="mt-8 text-center text-gray-500">Loading your results…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-67px)] items-center justify-center bg-gray-50 p-6">
        <div role="alert" className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl ring-1 ring-gray-100">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <AlertCircle size={26} />
          </span>
          <p className="font-medium text-gray-800">{error.msg}</p>
          <div className="mt-5 flex justify-center gap-3">
            {error.expired ? (
              <Link to="/login" className="rounded-xl bg-green-600 px-6 py-2.5 font-semibold text-white hover:bg-green-700">
                Log in again
              </Link>
            ) : (
              <button onClick={load} className="rounded-xl bg-green-600 px-6 py-2.5 font-semibold text-white hover:bg-green-700">
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // no data at all
  if (candidates.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-67px)] items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-3xl bg-white p-10 text-center shadow-xl ring-1 ring-gray-100">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100 text-green-700">
            <Upload size={30} />
          </span>
          <h1 className="text-2xl font-bold text-gray-900">No results yet</h1>
          <p className="mt-2 text-gray-500">Upload resumes with a job description and your ranked results will appear here.</p>
          <Link to="/upload" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-7 py-3 font-semibold text-white shadow-md hover:brightness-110">
            Upload resumes
          </Link>
        </div>
      </div>
    );
  }

  const statCards = [
    { icon: Users, label: "Candidates", value: String(stats?.count ?? 0), sub: "in this batch" },
    { icon: Gauge, label: "Average score", value: `${stats?.avg ?? 0}%`, sub: "across the batch" },
    { icon: Trophy, label: "Top score", value: stats ? `${Math.round(scoreOf(stats.top))}%` : "–", sub: stats?.top.name ?? "" },
    { icon: ThumbsUp, label: "Shortlisted", value: String(stats?.shortlisted ?? 0), sub: `${stats?.passRate ?? 0}% scored 60%+` },
  ];

  const hasFilters = !!search || minScore > 0;

  return (
    <div className="min-h-[calc(100vh-67px)] bg-gray-50 pb-16">
      {/* ===== Header ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-600 via-green-600 to-emerald-800 px-4 pb-24 pt-9 text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">Screening dashboard</h1>
            <p className="mt-1 text-green-50">
              {current && current.id !== LEGACY ? `Batch analysed ${fmtDate(current.latest)}` : "Earlier results"}
              {" · "}
              {batch.length} resume{batch.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/upload"
              className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 font-semibold text-green-700 shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              <Upload size={18} /> Upload new resumes
            </Link>
            <button
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 py-2.5 font-semibold text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              <Clock size={18} /> Previous batches ({otherSessions.length})
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-16 max-w-6xl space-y-6 px-4">
        {/* ===== Stats ===== */}
        <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-gray-100">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
                <s.icon size={20} />
              </span>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm font-medium text-gray-600">{s.label}</p>
              <p className="truncate text-xs text-gray-400">{s.sub}</p>
            </div>
          ))}
        </section>

        {/* ===== Toolbar ===== */}
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search candidates"
                className="w-full rounded-xl border border-gray-300 py-2.5 pl-11 pr-4 text-sm transition focus:border-green-600 focus:outline-none focus:ring-4 focus:ring-green-100"
              />
            </div>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              aria-label="Filter by minimum score"
              className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-4 focus:ring-green-100"
            >
              <option value={0}>All scores</option>
              <option value={60}>60%+</option>
              <option value={75}>75%+</option>
              <option value={85}>85%+</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort candidates"
              className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-green-600 focus:outline-none focus:ring-4 focus:ring-green-100"
            >
              <option value="score-desc">Score: high to low</option>
              <option value="score-asc">Score: low to high</option>
              <option value="name">Name: A to Z</option>
            </select>

            <div className="flex rounded-xl bg-gray-100 p-1" role="group" aria-label="View mode">
              {(["grid", "table"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  aria-pressed={viewMode === m}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${
                    viewMode === m ? "bg-white text-green-800 shadow-sm" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {m === "grid" ? <LayoutGrid size={16} /> : <List size={16} />}
                  {m === "grid" ? "Grid" : "Table"}
                </button>
              ))}
            </div>

            <button
              onClick={exportToCSV}
              disabled={shown.length === 0}
              className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500" aria-live="polite">
            Showing {shown.length} of {batch.length} candidate{batch.length === 1 ? "" : "s"}
            {hasFilters && (
              <button onClick={clearFilters} className="ml-2 font-semibold text-green-700 hover:underline">
                Clear filters
              </button>
            )}
          </p>
        </section>

        {/* ===== Candidates ===== */}
        {shown.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
            <p className="font-semibold text-gray-800">No candidates match your filters</p>
            <p className="mt-1 text-sm text-gray-500">Try a different name or lower the minimum score.</p>
            <button onClick={clearFilters} className="mt-4 rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700">
              Clear filters
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c, i) => {
              const s = scoreOf(c);
              const t = tier(s);
              const keys = kw(c);
              const isTop = sortBy === "score-desc" && i === 0 && !hasFilters;
              return (
                <li key={c.id ?? i} className="relative rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-1 hover:shadow-lg">
                  {isTop && (
                    <span className="absolute -top-2.5 right-4 flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-1 text-xs font-bold text-white shadow-md">
                      <Trophy size={12} /> Top candidate
                    </span>
                  )}
                  <div className="flex items-center gap-4">
                    <ScoreRing value={s} />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-gray-900" title={c.name}>{c.name}</h3>
                      <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${t.chip}`}>{t.label}</span>
                    </div>
                  </div>

                  <div className="mt-4 min-h-[2rem]">
                    {keys.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {keys.slice(0, 5).map((k) => (
                          <span key={k} className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
                            <Check size={11} strokeWidth={3} /> {k}
                          </span>
                        ))}
                        {keys.length > 5 && <span className="self-center text-xs text-gray-400">+{keys.length - 5} more</span>}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">No matched keywords recorded</p>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
                    <span>{c.skills_count != null ? `${c.skills_count} skills found` : "Skills n/a"}</span>
                    <span>{c.analyzed_at ? new Date(c.analyzed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="p-4 font-semibold">#</th>
                    <th className="p-4 font-semibold">Candidate</th>
                    <th className="p-4 font-semibold">Score</th>
                    <th className="p-4 font-semibold">Matched keywords</th>
                    <th className="p-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c, i) => {
                    const s = scoreOf(c);
                    const t = tier(s);
                    const keys = kw(c);
                    return (
                      <tr key={c.id ?? i} className="border-b last:border-0 transition hover:bg-green-50/40">
                        <td className="p-4 font-semibold text-gray-400">{i + 1}</td>
                        <td className="max-w-[14rem] truncate p-4 font-medium text-gray-900" title={c.name}>{c.name}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(s, 100)}%`, backgroundColor: t.bar }} />
                            </div>
                            <span className="w-12 font-bold text-gray-900">{Math.round(s * 10) / 10}%</span>
                          </div>
                        </td>
                        <td className="max-w-xs p-4 text-gray-600">
                          {keys.length ? (
                            <span className="line-clamp-1">{keys.slice(0, 4).join(", ")}{keys.length > 4 && ` +${keys.length - 4}`}</span>
                          ) : (
                            <span className="text-gray-400">–</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.chip}`}>{t.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== Charts ===== */}
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 lg:col-span-2">
            <h2 className="text-lg font-bold text-gray-900">Score comparison</h2>
            <p className="mb-4 text-sm text-gray-500">Top {chartData.length} candidates in this batch</p>
            <div role="img" aria-label="Bar chart comparing candidate scores">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip
                    cursor={{ fill: "#f0fdf4" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    labelFormatter={(_: unknown, p: any) => p?.[0]?.payload?.fullName ?? ""}
                    formatter={(v: any) => [`${v}%`, "Score"]}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} animationDuration={400}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={tier(d.score).bar} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Score distribution</h2>
            <p className="mb-5 text-sm text-gray-500">How the batch is spread</p>
            <ul className="space-y-4">
              {distribution.map((d) => (
                <li key={d.label}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{d.label}</span>
                    <span className="font-bold text-gray-900">{d.n}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${d.color}`} style={{ width: `${batch.length ? (d.n / batch.length) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            {activeId && activeId !== LEGACY && (
              <button
                onClick={() => setSessionToDelete(activeId)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
              >
                <Trash2 size={16} /> Delete this batch
              </button>
            )}
          </section>
        </div>
      </div>

      {/* ===== History modal ===== */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setShowHistory(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Previous batches"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-bold text-gray-900">Previous batches</h2>
              <button
                onClick={() => setShowHistory(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-5">
              {otherSessions.length === 0 ? (
                <p className="py-10 text-center text-gray-500">No previous batches yet.</p>
              ) : (
                <ul className="space-y-3">
                  {otherSessions.map((s) => (
                    <li key={s.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{s.id === LEGACY ? "Earlier results" : fmtDate(s.latest)}</p>
                        <p className="text-sm text-gray-500">
                          {s.count} candidate{s.count > 1 ? "s" : ""} · avg {s.avg}% · {s.shortlisted} shortlisted
                        </p>
                        <p className="truncate text-sm font-medium text-green-700">Top: {s.top.name}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => loadSession(s.id)}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-200"
                        >
                          View
                        </button>
                        {s.id !== LEGACY && (
                          <button
                            onClick={() => setSessionToDelete(s.id)}
                            aria-label="Delete batch"
                            className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete confirmation ===== */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => !deleting && setSessionToDelete(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl"
          >
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <Trash2 size={26} />
            </span>
            <h3 className="text-lg font-bold text-gray-900">Delete this batch?</h3>
            <p className="mt-2 text-sm text-gray-500">This permanently removes the batch and all its results. This cannot be undone.</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setSessionToDelete(null)}
                disabled={deleting}
                className="rounded-xl bg-gray-100 px-5 py-2.5 font-semibold text-gray-700 hover:bg-gray-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSession(sessionToDelete)}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
