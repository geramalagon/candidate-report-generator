export interface InterviewData {
  interview_id: number;
  candidate_name: string;
  preparedness_score: number;
  final_recommendation: boolean;
  key_skills_mentioned: string[];
  job_title_applied_for: string;
  values_alignment_score: number;
  relevant_experience_years: number;
  language_proficiency_score: number;
  additional_experience_shared: string;
}

export interface Candidate {
  name: string;
  role?: string;
  company?: string;
  interviewData: InterviewData;
  resumeContent?: string;
}

export interface ProcessedFile {
  name: string;
  processed: boolean;
  error?: string;
}