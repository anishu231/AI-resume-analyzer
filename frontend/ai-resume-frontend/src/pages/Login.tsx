// src/pages/Login.tsx
import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Target,
  Lightbulb,
  LayoutGrid,
  ArrowRight,
} from "lucide-react";

// Same backend the app already used for login.
const LOGIN_URL = "https://anish321-ats-resume-analyzer.hf.space/api/login/";

const PERKS = [
  { icon: Target, text: "Score every resume against the job description" },
  { icon: LayoutGrid, text: "Rank candidates on a clear dashboard" },
  { icon: Lightbulb, text: "Get matched skills, gaps and improvement tips" },
];

const SAMPLE_BARS = [
  { label: "Skill match", value: 92 },
  { label: "Experience", value: 80 },
  { label: "Education", value: 75 },
];

const getRemembered = () => {
  try {
    return localStorage.getItem("remembered_username") || "";
  } catch {
    return "";
  }
};

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState(getRemembered);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => !!getRemembered());
  const [capsOn, setCapsOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) =>
    setCapsOn(e.getModifierState("CapsLock"));

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!username.trim() || !password) {
      setError("Please enter both your username and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data.error || data.detail || "Login failed. Check your details and try again.";
        setError(msg);
        toast.error(msg);
        return;
      }

      if (typeof data.access !== "string" || !data.access.trim()) {
        const msg = "Login response did not include an access token. Please try again.";
        setError(msg);
        toast.error(msg);
        return;
      }

      localStorage.setItem("access", data.access);
      if (typeof data.refresh === "string") localStorage.setItem("refresh", data.refresh);
      if (typeof data.username === "string" && data.username.trim()) {
        localStorage.setItem("username", data.username.trim());
      } else {
        localStorage.removeItem("username");
      }
      if (typeof data.email === "string" && data.email.trim()) {
        localStorage.setItem("email", data.email.trim());
      } else {
        localStorage.removeItem("email");
      }

      if (remember) localStorage.setItem("remembered_username", username.trim());
      else localStorage.removeItem("remembered_username");

      toast.success("Login successful");
      navigate("/");
    } catch (err) {
      console.error(err);
      const msg =
        "Could not reach the server. It may be waking up, please wait a few seconds and try again.";
      setError(msg);
      toast.error("Server error");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 text-gray-900 placeholder:text-gray-400 transition focus:border-green-600 focus:outline-none focus:ring-4 focus:ring-green-100";

  return (
    <div className="grid min-h-[calc(100vh-67px)] lg:grid-cols-2">
      {/* ---------- Brand panel ---------- */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-green-600 via-green-600 to-emerald-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* decorative circles */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-black/10" />

        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-widest text-green-100">
            AI Resume Screening System
          </p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight xl:text-5xl">
            Welcome back.
            <br />
            Let&rsquo;s find the right fit.
          </h2>
          <ul className="mt-8 space-y-4">
            {PERKS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-green-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <p.icon size={18} />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Sample report card (illustration only) */}
        <div className="relative mt-10 max-w-sm rounded-2xl bg-white p-5 text-gray-800 shadow-2xl">
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 36 36" className="h-16 w-16 shrink-0" aria-hidden="true">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="#16a34a"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="87 100"
                transform="rotate(-90 18 18)"
              />
              <text x="18" y="21.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="#166534">
                87%
              </text>
            </svg>
            <div>
              <p className="font-bold">ATS match score</p>
              <p className="text-xs text-gray-500">Sample report, for illustration</p>
            </div>
          </div>
          <div className="mt-4 space-y-2.5">
            {SAMPLE_BARS.map((b) => (
              <div key={b.label}>
                <div className="mb-1 flex justify-between text-xs font-medium text-gray-600">
                  <span>{b.label}</span>
                  <span>{b.value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600"
                    style={{ width: `${b.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ---------- Form panel ---------- */}
      <main className="flex items-center justify-center bg-gray-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-white p-8 shadow-xl ring-1 ring-gray-100 sm:p-10">
            <div className="mb-8 text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                <Lock size={26} />
              </span>
              <h1 className="text-3xl font-bold text-gray-900">Sign in</h1>
              <p className="mt-2 text-gray-500">Access your ATS resume dashboard</p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5" noValidate>
              {/* Username */}
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-gray-700">
                  Username
                </label>
                <div className="relative">
                  <User
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={`${inputBase} pr-4`}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={handleKey}
                    onKeyDown={handleKey}
                    className={`${inputBase} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {capsOn && (
                  <p className="mt-2 text-xs font-medium text-amber-600">Caps Lock is on</p>
                )}
              </div>

              {/* Remember */}
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-green-600"
                />
                Remember my username
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3.5 font-semibold text-white shadow-md transition hover:shadow-lg hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {/* Divider + signup */}
            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              New here?
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <Link
              to="/signup"
              className="block w-full rounded-xl border border-green-600 py-3 text-center font-semibold text-green-700 transition hover:bg-green-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-100"
            >
              Create a free account
            </Link>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-500">
              <ShieldCheck size={14} className="text-green-600" />
              Your resumes stay private to your account.
            </p>
          </div>

          <p className="mt-5 text-center text-sm text-gray-500">
            <Link to="/" className="font-medium text-green-700 hover:underline">
              &larr; Back to home
            </Link>
            <span className="mx-2 text-gray-300">|</span>
            <Link to="/about" className="font-medium text-green-700 hover:underline">
              About the project
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
