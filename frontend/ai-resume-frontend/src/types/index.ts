// src/types/index.ts

export interface MatchReport {
  matched_keywords: string[];
  missing_keywords: string[];
  section_scores: {
    skills: number;
    experience: number;
    education: number;
    keywords: number;
  };
  recommendations: string[];
}

export interface ResumeAnalysisReport {
  score: number;
  experience_level: "entry" | "experienced";
  experience_level_label: string;
  component_scores: Record<string, number>;
  score_weights: Record<string, number>;
  method: string;
  confidence: "limited" | "moderate";
  matched_skills: string[];
  missing_skills: string[];
  requirement_matches: Array<{
    requirement: string;
    evidence: string;
    fit: number;
    status: string;
  }>;
  bullet_feedback: Array<{
    original: string;
    issues: string[];
    suggested_version?: string;
    suggestion?: string;
    suggestion_source?: "gemini" | "local" | "guidance" | "unavailable";
  }>;
  repetition_checks: {
    repeated_terms: Array<{ term: string; count: number }>;
    possible_repeated_characters: string[];
    duplicate_bullets: number;
  };
  strengths: string[];
  recommendations: string[];
  disclaimer: string;
}


export interface UploadResumeProps {
  onUpload?: (candidate: Candidate) => void;
  onBatchComplete?: () => void;
}

export interface CandidateCardProps extends Candidate {}

export interface DashboardState {
  candidates: Candidate[];
  loading: boolean;
  search: string;
  minScore: number;
}

export interface Candidate {
  id?: number;
  name: string;
  score: number;
  skills?: string[];
  resume_url?: string;
  matched_keywords?: string[];
  match_report?: ResumeAnalysisReport | null;
  [key: string]: any;
}
