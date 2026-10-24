// src/pages/Upload.tsx
import { useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  ClipboardList,
  Pencil,
  Paperclip,
  Trash2,
  ArrowRight,
  Lightbulb,
  Check,
  LayoutGrid,
} from "lucide-react";
import type { Candidate } from "../types";

const MAX_FILES = 10;
const isResume = (f: File) => f.type === "application/pdf" || /\.(pdf|docx)$/i.test(f.name);
const extOf = (name: string) => (name.split(".").pop() || "").toUpperCase();
const sizeMB = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MB`;

const newSessionId = () =>
  `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const scoreMeta = (s: number) => {
  if (s >= 80) return { label: "Strong match", cls: "bg-green-100 text-green-800" };
  if (s >= 60) return { label: "Good match", cls: "bg-lime-100 text-lime-800" };
  if (s >= 40) return { label: "Fair match", cls: "bg-amber-100 text-amber-800" };
  return { label: "Needs improvement", cls: "bg-red-100 text-red-700" };
};

export default function UploadPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<{
    success: Candidate[];
    errors: Array<{ filename: string; error: string }>;
  }>({ success: [], errors: [] });
  const [dragActive, setDragActive] = useState(false);
  const [notice, setNotice] = useState("");
  const [jdNotice, setJdNotice] = useState("");
  const [jdDrag, setJdDrag] = useState(false);
  const jdInputRef = useRef<HTMLInputElement>(null);
  const [expired, setExpired] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const [sessionId, setSessionId] = useState<string>(() => {
    let existing = localStorage.getItem("current_session_id");
    if (!existing) {
      existing = newSessionId();
      localStorage.setItem("current_session_id", existing);
    }
    return existing;
  });

  const hasJd = !!jobDescription.trim() || !!jdFile;
  const wordCount = jobDescription.trim() ? jobDescription.trim().split(/\s+/).length : 0;
  const canSubmit = files.length > 0 && hasJd && !uploading;
  const done = results.success.length > 0;

  // ---- add resumes (type filter, de-dupe, max 10) ----
  const addFiles = useCallback((incoming: File[]) => {
    const messages: string[] = [];
    const valid = incoming.filter(isResume);
    const rejected = incoming.length - valid.length;
    if (rejected > 0) messages.push(`${rejected} file(s) skipped: only PDF and DOCX are supported.`);

    setFiles((prev) => {
      const fresh = valid.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size));
      if (valid.length - fresh.length > 0) messages.push("Duplicate files were ignored.");
      const room = MAX_FILES - prev.length;
      if (fresh.length > room) messages.push(`Maximum ${MAX_FILES} resumes at a time.`);
      return [...prev, ...fresh.slice(0, Math.max(room, 0))];
    });
    setNotice(messages.join(" "));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = ""; // allow re-selecting the same file
  };

  // ---- job description file ----
  // Backend uses pasted text first and the file only when text is empty,
  // so a PDF/DOCX file and typed text are mutually exclusive.
  const isTxt = (f: File) => f.type === "text/plain" || /\.txt$/i.test(f.name);
  const isJdType = (f: File) => isTxt(f) || isResume(f);

  const pickJdFile = (f: File | undefined) => {
    if (!f) return;
    if (!isJdType(f)) {
      setJdNotice("Only TXT, PDF or DOCX files are supported for the job description.");
      return;
    }
    setJdNotice("");
    if (isTxt(f)) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) setJobDescription(event.target.result as string);
      };
      reader.readAsText(f);
      setJdFile(f);
    } else {
      setJobDescription(""); // file will be used instead of text
      setJdFile(f);
    }
  };

  const handleJdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    pickJdFile(e.target.files?.[0]);
    e.target.value = "";
  };

  // ---- drag & drop ----
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
    },
    [addFiles]
  );

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const removeJdFile = () => {
    setJdFile(null);
    if (jdFile && isTxt(jdFile)) setJobDescription("");
  };

  // ---- upload to backend (same API call as before) ----
  const handleUpload = async () => {
    if (!canSubmit) return;

    setUploading(true);
    setExpired(false);
    setResults({ success: [], errors: [] });

    const formData = new FormData();
    formData.append("session_id", sessionId);
    if (jobDescription.trim()) formData.append("job_description", jobDescription);
    if (jdFile) formData.append("jd_file", jdFile);
    files.forEach((file) => formData.append("resumes", file));

    try {
      const token = localStorage.getItem("access");

      const response = await fetch("https://anish321-ats-resume-analyzer.hf.space/api/upload/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.status === 401) {
        setExpired(true);
        throw new Error("Your session has expired. Please log in again.");
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const data = await response.json();
      const successful = data.results?.filter((r: any) => r.success) || [];
      const errors = data.results?.filter((r: any) => !r.success) || [];

      setResults({
        success: successful.map((r: any) => ({
          id: r.candidate_id,
          name: r.filename,
          score: r.score || 0,
          session_id: sessionId,
          match_report: r.match_report,
          ...r,
        })),
        errors: errors.map((r: any) => ({
          filename: r.filename,
          error: r.error || "Unknown error",
        })),
      });

      if (successful.length > 0) {
        setFiles([]);
        setJobDescription("");
        setJdFile(null);
        setNotice("");
        const nextSession = newSessionId();
        localStorage.setItem("current_session_id", nextSession);
        setSessionId(nextSession);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setResults((prev) => ({
        ...prev,
        errors: [
          ...prev.errors,
          {
            filename: "Upload",
            error:
              err?.message === "Failed to fetch"
                ? "Could not reach the server. It may be waking up, please try again in a moment."
                : err.message,
          },
        ],
      }));
    } finally {
      setUploading(false);
      window.setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        100
      );
    }
  };

  // ---- step indicator ----
  const steps = [
    { n: 1, label: "Job description", ok: hasJd },
    { n: 2, label: "Resumes", ok: files.length > 0 || done },
    { n: 3, label: "Analyse", ok: done },
  ];

  return (
    <div className="min-h-[calc(100vh-67px)] bg-gray-50 pb-16">
      {/* Header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-green-600 via-green-600 to-emerald-800 px-4 pb-24 pt-10 text-white sm:pt-14">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="relative mx-auto max-w-5xl text-center">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Analyse resumes against a job</h1>
          <p className="mx-auto mt-2 max-w-xl text-green-50">
            Add the job description, upload up to {MAX_FILES} resumes, and get a score for each one.
          </p>

          {/* Steps */}
          <ol className="mx-auto mt-7 flex max-w-lg items-center justify-center gap-2 sm:gap-4">
            {steps.map((s, i) => (
              <li key={s.n} className="flex items-center gap-2 sm:gap-4">
                <span className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition ${
                      s.ok ? "bg-white text-green-700" : "bg-white/20 text-white ring-1 ring-white/40"
                    }`}
                  >
                    {s.ok ? <Check size={16} strokeWidth={3} /> : s.n}
                  </span>
                  <span className="hidden text-sm font-medium sm:inline">{s.label}</span>
                </span>
                {i < steps.length - 1 && <span className="h-px w-6 bg-white/40 sm:w-10" />}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mx-auto -mt-16 grid max-w-5xl gap-6 px-4 lg:grid-cols-3">
        {/* ============ Left column ============ */}
        <div className="space-y-6 lg:col-span-2">
          {/* --- Step 1: Job description --- */}
          <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-gray-100 sm:p-8">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-gray-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-700">
                <ClipboardList size={18} />
              </span>
              1. Job description <span className="text-sm font-medium text-red-500">required</span>
            </h2>
            <p className="mb-4 text-sm text-gray-500">Paste the text, or upload it as a file.</p>

            {/* Option A: paste text */}
            <label htmlFor="jd-text" className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Pencil size={14} /> Paste text
            </label>
            <textarea
              id="jd-text"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder={
                jdFile && !isTxt(jdFile)
                  ? "Using the uploaded file below. Remove it to type instead."
                  : "Paste the job description here: title, requirements, skills, responsibilities…"
              }
              disabled={uploading || (!!jdFile && !isTxt(jdFile))}
              className="min-h-[150px] w-full resize-y rounded-2xl border border-gray-300 p-4 text-sm text-gray-900 placeholder:text-gray-400 transition focus:border-green-600 focus:outline-none focus:ring-4 focus:ring-green-100 disabled:bg-gray-50"
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={wordCount > 0 && wordCount < 30 ? "text-amber-600" : "text-gray-400"}>
                {wordCount} word{wordCount === 1 ? "" : "s"}
                {wordCount > 0 && wordCount < 30 && " · a longer description gives a more accurate score"}
              </span>
              {jobDescription && (
                <button
                  type="button"
                  onClick={() => {
                    setJobDescription("");
                    if (jdFile && isTxt(jdFile)) setJdFile(null);
                  }}
                  className="font-medium text-gray-500 hover:text-red-600"
                  disabled={uploading}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <span className="h-px flex-1 bg-gray-200" /> or <span className="h-px flex-1 bg-gray-200" />
            </div>

            {/* Option B: upload file (PDF / DOCX / TXT) */}
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Paperclip size={14} /> Upload a file
            </p>

            {jdFile ? (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                      extOf(jdFile.name) === "PDF"
                        ? "bg-red-100 text-red-700"
                        : extOf(jdFile.name) === "DOCX"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {extOf(jdFile.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-800">{jdFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {sizeMB(jdFile.size)}
                      {isTxt(jdFile) ? " · text loaded into the box above" : " · will be read by the server"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeJdFile}
                  disabled={uploading}
                  aria-label="Remove job description file"
                  className="rounded-full p-1.5 text-gray-500 transition hover:bg-red-100 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload job description file: click or drop a file"
                onClick={() => jdInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    jdInputRef.current?.click();
                  }
                }}
                onDragEnter={(e) => { e.preventDefault(); setJdDrag(true); }}
                onDragOver={(e) => { e.preventDefault(); setJdDrag(true); }}
                onDragLeave={(e) => { e.preventDefault(); setJdDrag(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setJdDrag(false);
                  pickJdFile(e.dataTransfer.files?.[0]);
                }}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition focus:outline-none focus-visible:ring-4 focus-visible:ring-green-200 ${
                  jdDrag ? "border-green-600 bg-green-50" : "border-gray-300 hover:border-green-500 hover:bg-green-50/40"
                } ${uploading || jobDescription.trim() ? "pointer-events-none opacity-50" : ""}`}
              >
                <input
                  ref={jdInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx"
                  className="hidden"
                  onChange={handleJdFileChange}
                  disabled={uploading}
                />
                <Upload className="mx-auto mb-2 h-7 w-7 text-green-600" />
                <p className="text-sm font-medium text-gray-800">
                  Drop the job description here, or <span className="text-green-700 underline">browse</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">PDF, DOCX or TXT</p>
                {jobDescription.trim() && (
                  <p className="mt-2 text-xs text-amber-700">Clear the text above to upload a file instead.</p>
                )}
              </div>
            )}

            {jdNotice && (
              <p role="status" className="mt-3 flex items-start gap-1.5 text-xs text-amber-700">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {jdNotice}
              </p>
            )}

            {!hasJd && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700">
                <AlertCircle size={13} /> The job description is needed to match and score resumes.
              </p>
            )}
          </section>

          {/* --- Step 2: Resumes --- */}
          <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-gray-100 sm:p-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-100 text-green-700">
                  <FileText size={18} />
                </span>
                2. Candidate resumes
              </h2>
              <span className="text-sm font-medium text-gray-500">
                {files.length}/{MAX_FILES}
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              aria-label="Add resumes: drag and drop or press Enter to browse"
              className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-green-200 ${
                dragActive
                  ? "scale-[1.01] border-green-600 bg-green-50"
                  : "border-gray-300 hover:border-green-500 hover:bg-green-50/40"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => resumeInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  resumeInputRef.current?.click();
                }
              }}
            >
              <input
                ref={resumeInputRef}
                type="file"
                multiple
                accept=".pdf,.docx"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                <Upload size={26} />
              </span>
              <p className="font-semibold text-gray-800">
                {dragActive ? "Drop the files here" : "Drag & drop resumes here"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                or <span className="font-medium text-green-700 underline">click to browse</span>
              </p>
              <p className="mt-3 text-xs text-gray-400">PDF or DOCX · up to {MAX_FILES} files</p>
            </div>

            {notice && (
              <p role="status" className="mt-3 flex items-start gap-1.5 text-xs text-amber-700">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {notice}
              </p>
            )}

            {files.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Selected ({files.length})</p>
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    disabled={uploading}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600"
                  >
                    <Trash2 size={13} /> Remove all
                  </button>
                </div>
                <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${file.size}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                            extOf(file.name) === "PDF" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {extOf(file.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-800">{file.name}</p>
                          <p className="text-xs text-gray-500">{sizeMB(file.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        disabled={uploading}
                        aria-label={`Remove ${file.name}`}
                        className="rounded-full p-1.5 text-gray-500 transition hover:bg-red-100 hover:text-red-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        <X size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        {/* ============ Right column: summary ============ */}
        <aside className="lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-24">
            <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-gray-100">
              <h2 className="mb-4 text-lg font-bold text-gray-900">Ready to analyse?</h2>

              <ul className="mb-5 space-y-3 text-sm">
                {[
                  { ok: hasJd, text: hasJd ? "Job description added" : "Add a job description" },
                  {
                    ok: files.length > 0,
                    text: files.length > 0 ? `${files.length} resume${files.length > 1 ? "s" : ""} selected` : "Add at least one resume",
                  },
                ].map((c) => (
                  <li key={c.text} className={`flex items-center gap-2.5 ${c.ok ? "text-green-800" : "text-gray-500"}`}>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        c.ok ? "bg-green-600 text-white" : "bg-gray-200 text-transparent"
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {c.text}
                  </li>
                ))}
              </ul>

              <button
                onClick={handleUpload}
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 py-3.5 font-semibold text-white shadow-md transition hover:shadow-lg hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-md disabled:hover:brightness-100"
              >
                {uploading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> Analysing…
                  </>
                ) : (
                  <>
                    <Upload size={18} /> Upload &amp; analyse ({files.length})
                  </>
                )}
              </button>

              {uploading && (
                <div className="mt-4" role="status">
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-green-500" />
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Reading resumes and scoring them. This can take up to a minute.
                  </p>
                </div>
              )}

              <button
                onClick={() => navigate("/dashboard")}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-100"
              >
                <LayoutGrid size={16} /> Go to dashboard
              </button>
            </section>

            <section className="rounded-2xl bg-green-50 p-5 text-sm text-green-900 ring-1 ring-green-100">
              <p className="mb-2 flex items-center gap-2 font-semibold">
                <Lightbulb size={16} /> Tips for better results
              </p>
              <ul className="list-disc space-y-1 pl-5 text-green-800">
                <li>Paste the full job description, not just the title.</li>
                <li>Use text-based PDFs; scanned images can&rsquo;t be read.</li>
                <li>Analyse resumes for one job at a time.</li>
              </ul>
            </section>
          </div>
        </aside>

        {/* ============ Results ============ */}
        {(results.success.length > 0 || results.errors.length > 0) && (
          <section
            ref={resultsRef}
            className="scroll-mt-24 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-gray-100 sm:p-8 lg:col-span-3"
            aria-live="polite"
          >
            <h2 className="mb-5 text-xl font-bold text-gray-900">Results</h2>

            {results.success.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 flex items-center gap-2 font-semibold text-green-800">
                  <CheckCircle size={18} className="text-green-600" />
                  {results.success.length} resume{results.success.length > 1 ? "s" : ""} analysed
                </p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {results.success.map((c, i) => {
                    const score = Math.round(Number(c.score) || 0);
                    const meta = scoreMeta(score);
                    return (
                      <li
                        key={`${c.name}-${i}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 p-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                            <FileText size={18} />
                          </span>
                          <p className="truncate text-sm font-medium text-gray-800">{c.name}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xl font-bold text-gray-900">{score}%</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.cls}`}>
                            {meta.label}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 font-semibold text-white shadow-md transition hover:bg-green-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-green-200 sm:w-auto sm:px-8"
                >
                  View full report in dashboard <ArrowRight size={18} />
                </button>
              </div>
            )}

            {results.errors.length > 0 && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <p className="mb-2 flex items-center gap-2 font-semibold text-red-800">
                  <AlertCircle size={18} /> {results.errors.length} problem{results.errors.length > 1 ? "s" : ""}
                </p>
                <ul className="space-y-1 text-sm text-red-700">
                  {results.errors.map((err, i) => (
                    <li key={i}>
                      <span className="font-medium">{err.filename}:</span> {err.error}
                    </li>
                  ))}
                </ul>
                {expired && (
                  <Link to="/login" className="mt-3 inline-block text-sm font-semibold text-red-800 underline">
                    Log in again
                  </Link>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
