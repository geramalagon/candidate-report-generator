import { Candidate, ProcessedData } from '../types/candidate';
import { parse } from 'csv-parse/sync';
import { documentAIService } from './documentAI';

export async function processData(
  csvContent: string,
  jobDescriptionContent: string,
  resumeContents: string[]
): Promise<ProcessedData> {
  try {
    // Process all data concurrently
    const [candidates, resumeTexts] = await Promise.all([
      processCSV(csvContent),
      documentAIService.processPDFs(resumeContents),
    ]);

    // Process job description
    const jobDescription = await documentAIService.processPDF(jobDescriptionContent);

    return {
      candidates,
      resumeTexts,
      jobDescription,
    };
  } catch (error: any) {
    throw new Error(`Data processing failed: ${error.message}`);
  }
}

export function processCSV(csvContent: string): Candidate[] {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: true,
    });

    return records.map((record: any) => {
      try {
        return {
          interview_id: Number(record.interview_id),
          candidate_name: String(record.candidate_name),
          job_title_applied_for: String(record.job_title_applied_for),
          key_skills_mentioned: String(record.key_skills_mentioned).split(',').map(s => s.trim()),
          relevant_experience_years: Number(record.relevant_experience_years),
          additional_experience_shared: String(record.additional_experience_shared),
          preparedness_score: Number(record.preparedness_score),
          values_alignment_score: Number(record.values_alignment_score),
          language_proficiency_score: Number(record.language_proficiency_score),
          final_recommendation: Boolean(record.final_recommendation),
        };
      } catch (recordError) {
        throw new Error(`Invalid record format: ${JSON.stringify(record)}`);
      }
    });
  } catch (error: any) {
    throw new Error(`CSV processing failed: ${error.message}`);
  }
}

export function prepareGeminiPrompt(data: ProcessedData): string {
  const { candidates, resumeTexts, jobDescription } = data;
  
  return `<examples>
<example>
<example_description>
Analyze the following candidate data and generate a comprehensive report. Include:
1. Overview of each candidate
2. Comparison of skills and experience
3. Evaluation scores analysis
4. Final recommendations
</example_description>

<job_description>
${jobDescription}
</job_description>

${candidates.map((candidate, index) => `
<candidate${index + 1}>
Name: ${candidate.candidate_name}
Position: ${candidate.job_title_applied_for}
Experience: ${candidate.relevant_experience_years} years
Skills: ${candidate.key_skills_mentioned.join(', ')}
Additional Experience: ${candidate.additional_experience_shared}
Scores:
- Preparedness: ${candidate.preparedness_score}/10
- Values Alignment: ${candidate.values_alignment_score}/10
- Language Proficiency: ${candidate.language_proficiency_score}/10
Final Recommendation: ${candidate.final_recommendation ? 'Recommended' : 'Not Recommended'}

Resume Content:
${resumeTexts[index]}
</candidate${index + 1}>
`).join('\n')}
</example>
</examples>

Create a detailed HTML report analyzing these candidates.`;
} 