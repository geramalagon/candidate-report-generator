export interface Candidate {
  interview_id: number;
  candidate_name: string;
  job_title_applied_for: string;
  key_skills_mentioned: string[];
  relevant_experience_years: number;
  additional_experience_shared: string;
  preparedness_score: number;
  values_alignment_score: number;
  language_proficiency_score: number;
  final_recommendation: boolean;
}

export interface ProcessedData {
  candidates: Candidate[];
  resumeTexts: string[];
  jobDescription: string;
}

export interface GenerateReportRequest {
  csvContent: string;
  jobDescriptionContent: string;
  resumeContents: string[];
}

export interface GenerateReportResponse {
  success: boolean;
  data?: string;
  error?: {
    type: string;
    message: string;
  };
} 