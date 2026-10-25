import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, Building2, ExternalLink, Info, LoaderCircle, MapPin, Search, X } from "lucide-react";

const API = "https://anish321-ats-resume-analyzer.hf.space/api/jobs/search/";
const SEARCH_API = "https://anish321-ats-resume-analyzer.hf.space/api/search/";

type Job = {
  company: string;
  title: string;
  location: string;
  url: string;
  posted: string;
  level: string;
  source?: "greenhouse" | "lever" | "adzuna" | "jooble";
  source_title?: string;
};

type SearchState = {
  can_search: boolean;
  last_search_at: string | null;
  next_search_at: string | null;
  retry_after: number;
  role: string;
  experience_level: string;
  location: string;
  jobs: Job[];
  source_errors?: string[];
};

const LEVELS = [
  { value: "entry", label: "Entry-level", detail: "0–2 years" },
  { value: "mid", label: "Mid-level", detail: "2–10 years" },
  { value: "senior", label: "Senior-level", detail: "10+ years" },
];

export default function JobSearch() {
  const [role, setRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("entry");
  const [location, setLocation] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lastSearchAt, setLastSearchAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [showInfo, setShowInfo] = useState(false);

  const token = () => localStorage.getItem("access") || "";

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(API, { headers: { Authorization: `Bearer ${token()}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load your search status.");
        applySearchState(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your search status.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const applySearchState = (data: SearchState) => {
    setJobs(data.jobs || []);
    setSourceErrors(data.source_errors || []);
    setLastSearchAt(data.last_search_at);
    if (data.role) setRole(data.role);
    if (data.experience_level) setExperienceLevel(data.experience_level);
    if (data.location) setLocation(data.location);
  };

  const canSearch = !loading && !searching && role.trim().length >= 2;

  const searchJobs = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSearch) return;
    setSearching(true);
    setError("");
    try {
      const query = new URLSearchParams({ role: role.trim(), level: experienceLevel, location: location.trim() });
      const response = await fetch(`${SEARCH_API}?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 429) applySearchState(data);
        throw new Error(data.error || "Job search failed. Please try again later.");
      }
      applySearchState(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Job search failed. Please try again later.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-67px)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl">
        <header className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Find your next role</p>
          <h1 className="mt-2 text-3xl font-extrabold text-slate-950 sm:text-4xl">Job Search</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Search current listings from company career pages using your target role and experience level.</p>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
          <form onSubmit={searchJobs} className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">Target role</span>
              <span className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
                <BriefcaseBusiness size={17} className="shrink-0 text-slate-400" />
                <input value={role} onChange={(event) => setRole(event.target.value)} maxLength={120} placeholder="e.g. Python Developer" className="w-full border-0 py-3 text-sm outline-none focus:ring-0" required minLength={2} />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-800">Experience level</span>
              <select value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
                {LEVELS.map((level) => <option key={level.value} value={level.value}>{level.label} · {level.detail}</option>)}
              </select>
            </label>

            <label className="block md:col-span-2">
              <span className="mb-2 block text-sm font-semibold text-slate-800">Location <span className="font-normal text-slate-500">(optional)</span></span>
              <span className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
                <MapPin size={17} className="shrink-0 text-slate-400" />
                <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} placeholder="City, country, or Remote" className="w-full border-0 py-3 text-sm outline-none focus:ring-0" />
              </span>
            </label>

            <div className="md:col-span-2">
              <button type="submit" disabled={!canSearch} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto">
                {searching || loading ? <LoaderCircle size={18} className="animate-spin" /> : <Search size={18} />}
                {searching ? "Searching company career pages…" : loading ? "Loading search status…" : "Search jobs"}
              </button>
              <p className="mt-3 text-xs leading-5 text-slate-500">Search as needed. Results are restricted to company career pages and verified company-hosted job links.</p>
            </div>
          </form>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Company career listings</h2>
              <p className="mt-1 text-sm text-slate-600">{jobs.length ? `${jobs.length} result${jobs.length === 1 ? "" : "s"} from company pages and labeled job sources` : "Company career pages and labeled job sources are searched."}</p>
            </div>
            {lastSearchAt && <span className="text-xs text-slate-500">Search saved {new Date(lastSearchAt).toLocaleString()}</span>}
          </div>

          {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
          {sourceErrors.length > 0 && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Some job sources did not respond ({sourceErrors.join(", ")}); results from available sources are shown.</p>}

          {jobs.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {jobs.map((job) => (
                <article key={job.url} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700"><Building2 size={14} />{job.company}</p>
                      <h3 className="mt-2 text-lg font-bold leading-6 text-slate-900">{job.title}</h3>
                    </div>
                    {job.source === "greenhouse" || job.source === "lever" || job.source_title ? (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">Company career page</span>
                    ) : job.source === "adzuna" ? (
                      <a href="https://www.adzuna.in/" target="_blank" rel="noopener noreferrer" aria-label="Jobs by Adzuna" className="inline-flex h-[23px] min-w-[116px] shrink-0 items-center justify-center gap-1 rounded-full bg-slate-100 px-2 text-[10px] font-semibold text-slate-700"><span>Jobs by</span><img src="https://zunastatic-abf.kxcdn.com/images/global/adzuna_logo.svg" alt="Adzuna" className="h-[17px] w-[58px] object-contain" /></a>
                    ) : (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">via Jooble</span>
                    )}
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600"><MapPin size={15} />{job.location || "Location not specified"}</p>
                  <p className="mt-2 text-xs text-slate-500">{job.posted ? `Posted ${new Date(job.posted).toLocaleDateString()}` : "Posted date unavailable"} · {job.level === "entry" ? "Entry-level" : job.level === "senior" ? "Senior-level" : "Mid-level"}</p>
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
                    Apply <ExternalLink size={15} />
                  </a>
                </article>
              ))}
            </div>
          ) : !loading && lastSearchAt ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="font-semibold text-slate-800">Koi job nahi mili.</p>
              <p className="mt-2 text-sm text-slate-600">Try a broader role or location.</p>
            </div>
          ) : null}
        </section>
      </main>

      <div className="fixed right-4 top-28 z-40">
        {showInfo && (
          <aside className="absolute right-0 top-14 w-[min(88vw,340px)] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">Check your resume against a job</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">You can also check your resume ATS score against any job description or targeted role.</p>
              </div>
              <button onClick={() => setShowInfo(false)} aria-label="Close information" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><X size={17} /></button>
            </div>
            <Link to="/upload" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Check resume ATS <ArrowRight size={15} /></Link>
          </aside>
        )}
        <button onClick={() => setShowInfo((open) => !open)} aria-label="Resume ATS information" aria-expanded={showInfo} className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-800 shadow-lg ring-1 ring-slate-200 hover:bg-emerald-50">
          {showInfo ? <X size={20} /> : <Info size={20} />}
        </button>
      </div>
    </div>
  );
}
