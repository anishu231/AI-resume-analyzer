// src/pages/Profile.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Mail,
  Copy,
  Check,
  LogOut,
  Upload,
  LayoutGrid,
  FileText,
  Gauge,
  Trophy,
  ThumbsUp,
  ShieldCheck,
} from "lucide-react";

const HISTORY_URL = "https://anish321-ats-resume-analyzer.hf.space/api/dashboard/history/";

type HistoryItem = {
  id: number;
  name: string;
  score: number; // already 0-100 from the backend
  verdict: string;
  session_id: string;
  analyzed_at: string | null;
};

type Activity =
  | { status: "loading" }
  | { status: "error"; message: string; expired?: boolean }
  | { status: "ready"; total: number; items: HistoryItem[] };

// localStorage can hold the literal text "undefined" from older logins.
const clean = (v: string | null) => (v && v !== "undefined" && v !== "null" ? v : "");

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <button
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
    >
      {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const username = clean(localStorage.getItem("username"));
  const email = clean(localStorage.getItem("email"));
  const initial = (username || "U").charAt(0).toUpperCase();

  const [activity, setActivity] = useState<Activity>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const token = localStorage.getItem("access");

    (async () => {
      try {
        const res = await fetch(`${HISTORY_URL}?page=1`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (res.status === 401) {
          setActivity({
            status: "error",
            expired: true,
            message: "Your session has expired. Please log in again.",
          });
          return;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) throw new Error("bad response");
        setActivity({
          status: "ready",
          total: data.pagination?.total ?? data.results?.length ?? 0,
          items: Array.isArray(data.results) ? data.results : [],
        });
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setActivity({
          status: "error",
          message: "Couldn't load your activity. The server may be waking up, try again in a moment.",
        });
      }
    })();

    return () => controller.abort();
  }, []);

  const stats = useMemo(() => {
    if (activity.status !== "ready") return null;
    const items = activity.items;
    const scores = items.map((i) => i.score);
    return {
      total: activity.total,
      avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      best: scores.length ? Math.round(Math.max(...scores)) : 0,
      shortlisted: items.filter((i) => i.verdict === "Shortlist").length,
      sample: items.length,
    };
  }, [activity]);

  const handleLogout = () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    navigate("/");
  };

  const statCards = [
    { icon: FileText, label: "Resumes analysed", value: stats ? String(stats.total) : "–" },
    { icon: Gauge, label: "Average score", value: stats && stats.sample ? `${stats.avg}%` : "–" },
    { icon: Trophy, label: "Best score", value: stats && stats.sample ? `${stats.best}%` : "–" },
    { icon: ThumbsUp, label: "Shortlisted", value: stats ? String(stats.shortlisted) : "–" },
  ];

  return (
    <div className="min-h-[calc(100vh-67px)] bg-gray-50 pb-16">
      {/* Cover */}
      <div className="h-40 bg-gradient-to-br from-green-600 via-green-600 to-emerald-700 sm:h-48">
        <div className="mx-auto h-full max-w-4xl overflow-hidden px-4">
          <div className="relative h-full">
            <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
            <div className="absolute bottom-[-4rem] left-1/3 h-40 w-40 rounded-full bg-black/10" />
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-16 max-w-4xl space-y-6 px-4 sm:-mt-20">
        {/* Identity card */}
        <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-gray-100 sm:p-8">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-end sm:text-left">
            <div className="-mt-16 flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-green-500 to-emerald-700 text-4xl font-bold text-white shadow-lg sm:-mt-20 sm:h-28 sm:w-28">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-2xl font-bold text-gray-900 sm:text-3xl">
                {username || "Your profile"}
              </h1>
              <p className="mt-1 truncate text-gray-500">{email || "Email not available"}</p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                <ShieldCheck size={14} /> Active account
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                to="/upload"
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-200"
              >
                <Upload size={16} /> Upload resume
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-100"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section aria-label="Your activity">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
                  <s.icon size={20} />
                </span>
                <p
                  className={`text-2xl font-bold text-gray-900 ${
                    activity.status === "loading" ? "animate-pulse text-gray-300" : ""
                  }`}
                >
                  {activity.status === "loading" ? "···" : s.value}
                </p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
          {stats && stats.sample > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Score stats are based on your {stats.sample} most recent resume{stats.sample > 1 ? "s" : ""}.
            </p>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Account details */}
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 lg:col-span-2">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Account details</h2>
            <dl className="space-y-4">
              <div>
                <dt className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <User size={14} /> Username
                </dt>
                <dd className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-2.5">
                  <span className="truncate font-medium text-gray-800">{username || "—"}</span>
                  {username && <CopyButton value={username} label="username" />}
                </dd>
              </div>
              <div>
                <dt className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <Mail size={14} /> Email
                </dt>
                <dd className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-4 py-2.5">
                  {email ? (
                    <>
                      <span className="truncate font-medium text-gray-800">{email}</span>
                      <CopyButton value={email} label="email" />
                    </>
                  ) : (
                    <span className="text-sm text-amber-700">
                      Not available. Log out and log in again to load it.
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-5 flex items-start gap-2 text-xs text-gray-500">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-green-600" />
              Your resumes and results are private to this account.
            </p>
          </section>

          {/* Recent analyses */}
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Recent analyses</h2>
              <Link
                to="/dashboard"
                className="flex items-center gap-1 text-sm font-semibold text-green-700 hover:underline"
              >
                <LayoutGrid size={14} /> Dashboard
              </Link>
            </div>

            {activity.status === "loading" && (
              <ul className="space-y-3" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
                ))}
              </ul>
            )}

            {activity.status === "error" && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {activity.message}{" "}
                {activity.expired && (
                  <button onClick={handleLogout} className="font-semibold underline">
                    Log in again
                  </button>
                )}
              </div>
            )}

            {activity.status === "ready" && activity.items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center">
                <p className="font-medium text-gray-800">No resumes analysed yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Upload a resume and a job description to see your first score.
                </p>
                <Link
                  to="/upload"
                  className="mt-4 inline-block rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  Upload your first resume
                </Link>
              </div>
            )}

            {activity.status === "ready" && activity.items.length > 0 && (
              <ul className="divide-y divide-gray-100">
                {activity.items.slice(0, 5).map((it) => {
                  const good = it.verdict === "Shortlist";
                  return (
                    <li key={it.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                          <FileText size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-800">{it.name}</p>
                          <p className="text-xs text-gray-500">{formatDate(it.analyzed_at)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-bold text-gray-900">{Math.round(it.score)}%</span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            good ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {it.verdict}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
