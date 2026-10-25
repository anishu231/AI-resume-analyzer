import type { ResumeAnalysisReport } from "../types";

const LABELS: Record<string, string> = {
  job_relevance: "Job description relevance",
  requirement_coverage: "Requirement evidence",
  role_skills: "Role skills",
  projects_and_education: "Projects and education",
  experience_and_scope: "Experience and ownership",
  impact_evidence: "Measurable impact",
  resume_readability: "Resume structure and readability",
};

const hasVerifiedMeasure = (line: string) =>
  /(?:[$₹€]\s*\d|\b\d[\d,.]*\s*(?:%|x|k|m|b|hours?|days?|weeks?|months?|users?|customers?|clients?|employees?|people|teams?|projects?|reports?|dashboards?|kpis?|records?|requests?|tickets?|transactions?|rows?|files?|minutes?|seconds?|gb|tb|mb)(?![a-z0-9]))/i.test(line);

function legacyBulletRewrite(line: string) {
  const original = line.replace(/^[\s•●▪◦*\-–—]+/, "").trim();
  if (!original) return "Review each bullet and describe your own action and verified result.";

  let rewritten = original;
  const responsible = rewritten.match(/^responsible for\s+([a-z]+ing)\b\s*(.*)$/i);
  const gerunds: Record<string, string> = {
    analyzing: "Analyzed", building: "Built", calculating: "Calculated", cleaning: "Cleaned",
    coordinating: "Coordinated", creating: "Created", designing: "Designed", developing: "Developed",
    extracting: "Extracted", implementing: "Implemented", leading: "Led", maintaining: "Maintained",
    managing: "Managed", modeling: "Modeled", monitoring: "Monitored", optimizing: "Optimized",
    processing: "Processed", testing: "Tested", transforming: "Transformed", visualizing: "Visualized",
  };

  if (responsible && gerunds[responsible[1].toLowerCase()]) {
    rewritten = `${gerunds[responsible[1].toLowerCase()]} ${responsible[2]}`;
  } else if (/^worked on\s+/i.test(rewritten)) {
    rewritten = `Contributed to ${rewritten.replace(/^worked on\s+/i, "")} by [state your specific contribution]`;
  } else {
    rewritten = rewritten
      .replace(/^Conducted detailed analysis on\b/i, "Analyzed")
      .replace(/\bfor improved\b/i, "to improve")
      .replace(/\bindustry-standard\s+/i, "");
  }

  rewritten = rewritten.replace(/[.;\s]+$/, "");
  return `${rewritten}.`;
}

export default function ResumeFeedback({ report }: { report?: ResumeAnalysisReport }) {
  if (!report) return null;
  const repetition = report.repetition_checks;

  return (
    <div className="mt-4 space-y-5 rounded-2xl border border-gray-200 bg-white p-4 text-left sm:p-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-gray-900">Detailed resume feedback</h3>
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
            {report.experience_level_label}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">{report.method}</p>
      </div>

      <section>
        <h4 className="mb-3 text-sm font-semibold text-gray-800">Score breakdown</h4>
        <div className="space-y-3">
          {Object.entries(report.component_scores).map(([key, score]) => (
            <div key={key}>
              <div className="mb-1 flex justify-between gap-3 text-xs">
                <span className="text-gray-700">{LABELS[key] ?? key.replaceAll("_", " ")}</span>
                <span className="shrink-0 font-medium text-gray-900">
                  {score}%{report.score_weights[key] ? ` · ${report.score_weights[key]}% weight` : ""}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, score)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-500">Analysis confidence: {report.confidence}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-green-800">Relevant job skills found</h4>
          <div className="flex flex-wrap gap-1.5">
            {report.matched_skills.map((skill) => (
              <span key={skill} className="rounded-md bg-green-50 px-2 py-1 text-xs text-green-800">{skill}</span>
            ))}
            {!report.matched_skills.length && <p className="text-xs text-gray-500">No catalogued role skills detected; other evidence still contributes to the estimate.</p>}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-amber-800">JD skills not found in resume</h4>
          <div className="flex flex-wrap gap-1.5">
            {report.missing_skills.map((skill) => (
              <span key={skill} className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">{skill}</span>
            ))}
            {!report.missing_skills.length && <p className="text-xs text-gray-500">No supported job-skill gaps were detected.</p>}
          </div>
          <p className="mt-2 text-[11px] text-gray-500">This list includes recognized tools and skills, not job titles or degree names. Only add a skill if you can support it with real experience.</p>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-sm font-semibold text-gray-800">Job requirements and resume evidence</h4>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {report.requirement_matches.map((item, index) => (
            <div key={`${item.requirement}-${index}`} className="w-[min(82vw,360px)] shrink-0 snap-start rounded-xl bg-gray-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-xs font-medium leading-5 text-gray-800">{item.requirement}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-600">{item.status} · {item.fit}%</span>
              </div>
              {item.evidence && <p className="mt-2 border-l-2 border-green-300 pl-2 text-xs leading-5 text-gray-600">Resume text: {item.evidence}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-sm font-semibold text-gray-800">Bullet-point edits</h4>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {report.bullet_feedback.map((item, index) => (
            <div key={`${item.original}-${index}`} className="w-[min(82vw,360px)] shrink-0 snap-start rounded-xl border border-blue-100 bg-blue-50/60 p-3">
              {item.original && <p className="text-xs italic text-gray-700">Original: “{item.original}”</p>}
              {item.issues.filter((issue) => !/no scale or outcome is stated|rewrite as:/i.test(issue)).length > 0 && (
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-900">
                  {item.issues.filter((issue) => !/no scale or outcome is stated|rewrite as:/i.test(issue)).map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              )}
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-blue-800">
                {item.suggestion_source === "gemini" ? "AI-generated suggestion" : item.suggestion_source === "guidance" ? "Suggested improvement" : "Built-in suggestion"}
              </p>
              <p className="text-xs leading-5 text-blue-900">{item.suggested_version || legacyBulletRewrite(item.original)}</p>
              <p className="mt-1 text-[11px] text-gray-500">Replace bracketed prompts only with facts you can verify.</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-800">Repeated content check</h4>
          <ul className="space-y-1 text-xs text-gray-600">
            {repetition.repeated_terms.map(({ term, count }) => <li key={term}>“{term}” appears {count} times</li>)}
            {repetition.possible_repeated_characters.map((text) => <li key={text}>Check possible repeated-letter typo: “{text}”</li>)}
            {repetition.duplicate_bullets > 0 && <li>{repetition.duplicate_bullets} duplicate bullet(s) detected</li>}
            {!repetition.repeated_terms.length && !repetition.possible_repeated_characters.length && !repetition.duplicate_bullets && <li>No strong repetition signal detected.</li>}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-gray-800">Recommended next edits</h4>
          <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-gray-700">
            {report.recommendations.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <ul className="list-disc space-y-1 pl-4 text-xs text-gray-700">
        {report.strengths.map((strength) => <li key={strength}>{strength}</li>)}
      </ul>
      <p className="border-t border-gray-100 pt-3 text-[11px] leading-5 text-gray-500">{report.disclaimer}</p>
    </div>
  );
}
