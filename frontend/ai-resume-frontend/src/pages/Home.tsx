// src/pages/Home.tsx
import { Link } from "react-router-dom";
import {
  FileText,
  Gauge,
  LayoutGrid,
  Lightbulb,
  Upload,
  ArrowRight,
  Briefcase,
  UserCheck,
  Check,
  ShieldCheck,
  Layers,
  Target,
} from "lucide-react";

const hasToken = () => {
  try {
    return !!localStorage.getItem("access");
  } catch {
    return false;
  }
};

const HIGHLIGHTS = [
  { icon: FileText, text: "PDF, DOCX & DOC resumes" },
  { icon: Gauge, text: "4-factor ATS scoring" },
  { icon: Layers, text: "Bulk resume screening" },
  { icon: ShieldCheck, text: "Private to your account" },
];

const FEATURES = [
  {
    icon: FileText,
    title: "Resume parsing",
    text: "Upload resumes in PDF or Word format. Text and skills are extracted automatically, with no manual typing.",
  },
  {
    icon: Gauge,
    title: "Smart scoring",
    text: "Every resume is scored against your job description using text similarity, skills, experience and education.",
  },
  {
    icon: LayoutGrid,
    title: "Visual dashboard",
    text: "Rank candidates and compare performance with interactive charts, all kept in your session history.",
  },
  {
    icon: Lightbulb,
    title: "Actionable feedback",
    text: "See matched and missing skills, strengths and clear tips on what to improve in a resume.",
  },
];

const STEPS = [
  { n: "1", title: "Add resumes and a job description", text: "Upload one or many resumes and paste the role you are hiring for." },
  { n: "2", title: "Let the AI analyse", text: "Skills are detected and each resume is compared with the job." },
  { n: "3", title: "Review the ranking", text: "Open the dashboard to see scores, gaps and who to shortlist." },
];

const AUDIENCE = [
  {
    icon: Briefcase,
    title: "For recruiters",
    points: ["Shortlist from hundreds of resumes faster", "Consistent, explainable scoring", "Compare candidates side by side"],
  },
  {
    icon: UserCheck,
    title: "For job seekers",
    points: ["Know how an ATS sees your resume", "Find the skills you are missing", "Get tips to raise your match score"],
  },
];

export default function Home() {
  const loggedIn = hasToken();

  return (
    <div className="text-gray-800">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .fade-up { animation: fadeUp .7s ease-out both; }
        .float-y { animation: floatY 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .fade-up, .float-y { animation: none; } }
      `}</style>

      {/* ================= Hero ================= */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-600 via-green-600 to-emerald-800 text-white">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-black/10" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="fade-up text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-green-50 ring-1 ring-white/20">
              <Target size={14} /> AI-powered resume screening
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl xl:text-6xl">
              Find the right resume,{" "}
              <span className="text-green-200">in seconds.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-green-50 lg:mx-0">
              Upload resumes, analyse skills, rank candidates and visualise performance. Get a clear,
              explainable ATS score for every resume.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              {loggedIn ? (
                <>
                  <Link
                    to="/upload"
                    className="flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-green-700 shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
                  >
                    <Upload size={18} /> Upload resume
                  </Link>
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-2 rounded-xl bg-black/80 px-6 py-3.5 font-semibold text-white shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
                  >
                    <LayoutGrid size={18} /> View dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-green-700 shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
                  >
                    Get started free <ArrowRight size={18} />
                  </Link>
                  <Link
                    to="/login"
                    className="rounded-xl border border-white/40 bg-white/10 px-6 py-3.5 font-semibold text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
                  >
                    Login
                  </Link>
                </>
              )}
            </div>

            <Link
              to="/about"
              className="mt-5 inline-block text-sm font-medium text-green-100 underline-offset-4 hover:underline"
            >
              How does it work? Read about the project
            </Link>
          </div>

          {/* Sample report (illustration) */}
          <div className="fade-up mx-auto w-full max-w-md" style={{ animationDelay: ".15s" }}>
            <div className="float-y rounded-3xl bg-white p-6 text-gray-800 shadow-2xl">
              <div className="flex items-center gap-4">
                <svg viewBox="0 0 36 36" className="h-20 w-20 shrink-0" aria-hidden="true">
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
                  <p className="text-lg font-bold">ATS match score</p>
                  <span className="mt-1 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                    Shortlist
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  { l: "Skill match", v: 92 },
                  { l: "Experience", v: 80 },
                  { l: "Education", v: 75 },
                ].map((b) => (
                  <div key={b.l}>
                    <div className="mb-1 flex justify-between text-xs font-medium text-gray-600">
                      <span>{b.l}</span>
                      <span>{b.v}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600"
                        style={{ width: `${b.v}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
                {["Python", "React", "SQL"].map((s) => (
                  <span key={s} className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-green-800">
                    <Check size={12} strokeWidth={3} /> {s}
                  </span>
                ))}
                <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">Missing: Docker</span>
              </div>
              <p className="mt-4 text-center text-[11px] text-gray-400">Sample report, for illustration</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= Highlights strip ================= */}
      <section className="border-b border-gray-200 bg-white">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 sm:px-6 lg:grid-cols-4">
          {HIGHLIGHTS.map((h) => (
            <li key={h.text} className="flex items-center justify-center gap-3 text-sm font-medium text-gray-700">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                <h.icon size={18} />
              </span>
              {h.text}
            </li>
          ))}
        </ul>
      </section>

      {/* ================= Features ================= */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-gray-900">Everything you need to screen resumes</h2>
            <p className="mt-3 text-gray-600">
              From parsing to ranking, each step is automated and explained.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-700 text-white shadow-md">
                  <f.icon size={22} />
                </span>
                <h3 className="mb-2 text-lg font-bold text-gray-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= How it works ================= */}
      <section className="bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">How it works</h2>
          <ol className="grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="relative text-center">
                <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-xl font-bold text-white shadow-lg ring-8 ring-green-100">
                  {s.n}
                </span>
                <h3 className="mb-2 text-lg font-bold text-gray-900">{s.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= Audience ================= */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
                  <a.icon size={24} />
                </span>
                <h3 className="text-xl font-bold text-gray-900">{a.title}</h3>
              </div>
              <ul className="space-y-3">
                {a.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-gray-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="px-4 py-16 sm:px-6">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 to-emerald-800 p-10 text-center text-white shadow-xl sm:p-14">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />
          <h2 className="relative text-3xl font-bold sm:text-4xl">Ready to screen your first resume?</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-green-50">
            It takes under a minute to get a score, a skill gap report and clear next steps.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={loggedIn ? "/upload" : "/signup"}
              className="flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 font-semibold text-green-700 shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              {loggedIn ? "Upload resume" : "Create free account"} <ArrowRight size={18} />
            </Link>
            <Link
              to="/about"
              className="rounded-xl border border-white/40 px-7 py-3.5 font-semibold text-white transition hover:bg-white/15 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50"
            >
              Learn more
            </Link>
          </div>
        </div>
      </section>

      {/* ================= Footer ================= */}
      <footer className="bg-gray-900 px-4 py-10 text-gray-300 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm sm:flex-row">
          <p>
            <span className="font-semibold text-white">Resume ATS Checker</span> · Built by Anish Singh
          </p>
          <nav className="flex gap-5" aria-label="Footer">
            <Link to="/" className="hover:text-white">Home</Link>
            <Link to="/upload" className="hover:text-white">Upload</Link>
            <Link to="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link to="/about" className="hover:text-white">About</Link>
          </nav>
          <p className="text-gray-500">&copy; {new Date().getFullYear()} All rights reserved</p>
        </div>
      </footer>
    </div>
  );
}
