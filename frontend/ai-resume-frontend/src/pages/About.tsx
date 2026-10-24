// src/pages/About.tsx
import { Link } from "react-router-dom";
import {
  Upload,
  Cpu,
  LayoutGrid,
  Lightbulb,
  FileText,
  Target,
  Users,
  ShieldCheck,
} from "lucide-react";

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    text: "Add one or many resumes (PDF, DOCX, DOC) and paste or upload the job description.",
  },
  {
    icon: Cpu,
    title: "Analyse",
    text: "The text is extracted, skills are detected and every resume is compared with the job.",
  },
  {
    icon: LayoutGrid,
    title: "Rank",
    text: "Candidates get a 0–100% score and are ranked on a dashboard with clear charts.",
  },
  {
    icon: Lightbulb,
    title: "Improve",
    text: "See matched and missing skills, strengths and practical tips to raise the score.",
  },
];

const WEIGHTS = [
  { label: "Text similarity (TF-IDF)", value: 40, hint: "How closely the resume wording matches the job description" },
  { label: "Skill match", value: 30, hint: "Required skills found in the resume" },
  { label: "Experience", value: 20, hint: "Years and role signals" },
  { label: "Education", value: 10, hint: "Degrees and qualifications" },
];

const FEATURES = [
  { icon: FileText, title: "Smart resume parsing", text: "Reads PDF and Word files and pulls out the skills and details that matter." },
  { icon: Target, title: "Job-specific scoring", text: "Every score is measured against the job description you provide, not a generic template." },
  { icon: Users, title: "Bulk screening", text: "Compare many candidates in one session and see who fits best at a glance." },
  { icon: ShieldCheck, title: "Private sessions", text: "Results are tied to your account, and you can delete any past session." },
];

const TECH = [
  "React", "Vite", "TypeScript", "Tailwind CSS",
  "Django REST Framework", "JWT auth",
  "scikit-learn", "spaCy", "pdfplumber", "python-docx",
  "Google Gemini assistant",
];

export default function About() {
  return (
    <div className="bg-gray-50 text-gray-800">
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-600 via-green-600 to-emerald-700 px-4 py-16 text-center text-white sm:py-24">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-green-100">
          About the project
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Hiring decisions that start with the right resume
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-green-50">
          AI Resume Screening System helps recruiters shortlist faster and helps job seekers
          understand exactly why a resume does or doesn't match a job.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/upload"
            className="rounded-xl bg-white px-6 py-3 font-semibold text-green-700 shadow-lg transition hover:scale-105"
          >
            Try it now
          </Link>
          <Link
            to="/signup"
            className="rounded-xl bg-black/80 px-6 py-3 font-semibold text-white shadow-lg transition hover:scale-105"
          >
            Create free account
          </Link>
        </div>
      </section>

      {/* Motive */}
      <section className="mx-auto grid max-w-5xl gap-8 px-4 py-14 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-2xl font-bold">Why we built it</h2>
          <p className="leading-relaxed text-gray-700">
            A single job opening can attract hundreds of resumes. Reading them all by hand is slow,
            tiring and inconsistent, and good candidates get missed. On the other side, many job
            seekers are rejected by Applicant Tracking Systems (ATS) without ever knowing why.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-2xl font-bold">What it does</h2>
          <p className="leading-relaxed text-gray-700">
            This project reads resumes, compares them with a job description, and produces a clear,
            explainable score. Instead of just a number, you see matched skills, missing skills,
            strengths, weaknesses and recommendations, so the next step is always obvious.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white px-4 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-bold">How it works</h2>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 text-green-700">
                    <s.icon size={22} />
                  </span>
                  <span className="text-sm font-semibold text-gray-400">Step {i + 1}</span>
                </div>
                <h3 className="mb-1 text-lg font-bold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-gray-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Scoring */}
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h2 className="mb-2 text-center text-2xl font-bold">How the score is calculated</h2>
        <p className="mb-8 text-center text-gray-600">
          Four signals are combined into one transparent score out of 100.
        </p>
        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {WEIGHTS.map((w) => (
            <div key={w.label}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="font-semibold">{w.label}</span>
                <span className="font-bold text-green-700">{w.value}%</span>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-gray-100"
                role="img"
                aria-label={`${w.label}: ${w.value} percent of the score`}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600"
                  style={{ width: `${w.value * 2.5}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">{w.hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white px-4 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-2xl font-bold">Highlights</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 rounded-2xl bg-gray-50 p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-600 text-white">
                  <f.icon size={22} />
                </span>
                <div>
                  <h3 className="mb-1 font-bold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech */}
      <section className="mx-auto max-w-4xl px-4 py-14 text-center">
        <h2 className="mb-6 text-2xl font-bold">Built with</h2>
        <div className="flex flex-wrap justify-center gap-2">
          {TECH.map((t) => (
            <span
              key={t}
              className="rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-sm font-medium text-green-800"
            >
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* Developer + CTA */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-green-600 to-emerald-700 p-10 text-center text-white shadow-xl">
          <h2 className="text-2xl font-bold">Built by Anish Singh</h2>
          <p className="mx-auto mt-3 max-w-xl text-green-50">
            Made to bring clarity to resume screening. Have a question or stuck somewhere? Open
            the chat assistant at the bottom-right of the Home page, it can guide you.
          </p>
          <Link
            to="/upload"
            className="mt-6 inline-block rounded-xl bg-white px-6 py-3 font-semibold text-green-700 shadow-lg transition hover:scale-105"
          >
            Analyse a resume
          </Link>
        </div>
      </section>
    </div>
  );
}
