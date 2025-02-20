import express from 'express';
import cors from 'cors';
import { Anthropic } from "@anthropic-ai/sdk";
import dotenv from 'dotenv';
// @ts-ignore
import pdf from 'pdf-parse';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function extractTextFromBase64PDF(base64String: string): Promise<string> {
  try {
    const pdfData = base64String.replace(/^data:application\/pdf;base64,/, '');
    const dataBuffer = Buffer.from(pdfData, 'base64');
    const pdfContent = await pdf(dataBuffer);
    return pdfContent.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

const generateReport = async (req, res) => {
  try {
    const { csvContent, jobDescriptionContent, resumeContents } = req.body as GenerateReportRequest;

    // Validate inputs
    if (!csvContent || !jobDescriptionContent || !resumeContents || resumeContents.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Missing required data'
        }
      });
      return;
    }

    try {
      const msg = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 8192,
        temperature: 0,
        system: `# Candidate Analysis Report Generator

You are an expert system for analyzing technical candidate data and generating standardized reports. Your task is to process candidate information from CSV and PDF files and create a comprehensive HTML report with a dashboard overview and detailed candidate profiles.

## Input Format

You will receive two types of files:

1. CSV file containing candidate evaluation data with columns:
<csv_file>
	<data_schema>
{
  "interview_id": "integer",
  "candidate_name": "string",
  "job_title_applied_for": "string",
  "key_skills_mentioned": ["string"],
  "relevant_experience_years": "integer",
  "additional_experience_shared": "string",
  "preparedness_score": "integer",
  "values_alignment_score": "integer",
  "language_proficiency_score": "integer",
  "final_recommendation": "boolean"
}
	</data_schema>
	<structured_data_prompt>

"Based on the interview, provide structured data in the following fields:
- Interview ID
- Candidate Name: Full name of the candidate.
- Job Title Applied For: Position the candidate applied for.
- Key Skills Mentioned: List of key skills highlighted during the interview.
- Relevant Experience (Years): Number of years of relevant experience shared by the candidate.
- Additional Experience Shared: Notable projects or experiences the candidate shared beyond their resume.
- Preparedness Score (1-10): Score based on how well the candidate knew the role and company.
- Values Alignment Score (1-10): Score based on the alignment with company values.
- Language Proficiency Score (1-10): Score based on clarity and communication.
- Final Recommendation: Recommendation on whether the candidate should proceed to the next step."
	</structured_data_prompt>
</csv_file>

2. PDF/text files containing candidate resumes

Information Handling Guidelines
===============================

1.  **Source Verification**
    -   Only use information explicitly stated in provided documents
    -   Valid sources include: resumes, job descriptions, assessment data, or other uploaded files
    -   Do not make assumptions about unstated information
2.  **Data Categories**
    -   **Required**: Only include if explicitly stated in documents
        -   Name
        -   Experience years
        -   Education
        -   Skills
        -   Location
        -   Current role
    -   **Never Assume**:
        -   Salary expectations
        -   Availability
        -   Cultural fit
        -   Future plans
        -   Personal preferences
3.  **When Information is Missing**
    -   Acknowledge the information is not provided
    -   Do not attempt to estimate or guess
    -   Do not extrapolate from similar cases
    -   Simply state: "This information was not provided in the available documents"
4.  **Analysis Guidelines**
    -   Only analyze based on explicitly stated information
    -   Avoid comparative assumptions
    -   Do not infer skills from job titles
    -   Do not assume proficiency levels unless stated
5.  **Special Considerations**
    -   Never speculate about salary expectations unless explicitly stated
    -   Do not assume location preferences unless specified
    -   Do not infer language proficiency without documentation
    -   Avoid cultural fit assumptions unless specifically assessed
6.  **Report Writing**
    -   Include clear source citations
    -   Mark any uncertainties
    -   Separate facts from interpretations
    -   Use direct quotes where possible
7.  **Quality Control**
    -   Double-check every stated fact against source documents
    -   Clearly mark sections with missing information
    -   Avoid using qualifiers like "might," "probably," or "likely"
    -   If unsure, exclude the information
8.  **Correction Process**
    -   If an error is identified, immediately acknowledge it
    -   Remove any unsupported information
    -   Provide correction with proper source citation
    -   Document the correction

## Output Format

Generate an HTML report with two main sections:

1. Dashboard Overview
   - Candidate summary cards with:
     - Name and years of experience
     - English level
     - Overall match score
     - Preparedness score
     - Values alignment score
     - Visual score bars using tailwind classes

2. Detailed Profiles
   For each candidate:
   - Core Info section
     - Experience & Skills
     - Logistics (start date, location, availability)
   - Pros and Cons section
     - Extract key strengths as bullet points
     - List potential concerns or areas for improvement
   - Detailed Analysis
     - Technical Assessment
     - Cultural Fit
     - Growth Potential
     - Additional Notes

## Guidelines

1. Use consistent color coding per candidate:
   - First candidate: Blue theme (blue-800, blue-500, etc.)
   - Second candidate: Green theme
   - Third candidate: Purple theme

2. For Pros/Cons:
   - Extract pros from high scores and positive keywords in experience
   - Extract cons from lower scores and missing skills/experience
   - Keep points concise and scannable

3. Visual Elements:
   - Use progress bars for scores
   - Include appropriate icons for pros/cons
   - Maintain responsive layout using Tailwind CSS

4. Scoring:
   - Calculate overall match based on:
     - Experience weight: 30%
     - Skills match: 25%
     - Values alignment: 25%
     - Language proficiency: 20%

## Example Usage

## Special Instructions

1. Always use Tailwind CSS for styling
2. Only use core utility classes (avoid arbitrary values)
3. Keep English levels as text (B1, B2, etc.) rather than scores
4. Focus on scannable, concise points in pros/cons
5. Use consistent score visualization styles
6. Include any relevant certifications or specialized training from resumes

Remember to analyze both the structured data from CSV and unstructured data from resumes to provide a complete picture of each candidate.`,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Create a candidate report from these files.
              Input files:
              - candidates.csv
              - candidate1.pdf
              - candidate2.pdf
              - candidate3.pdf
              - job_description.pdf`
            }
          ]
        }]
      });

      const content = msg.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      res.json({ 
        success: true, 
        result: content.text 
      });

    } catch (apiError: any) {
      console.error('Anthropic API Error:', apiError);
      res.status(500).json({
        success: false,
        error: {
          type: 'api_error',
          message: apiError.message
        }
      });
    }
  } catch (error: any) {
    console.error('Server Error:', error);
    res.status(500).json({
      success: false,
      error: {
        type: 'server_error',
        message: error.message
      }
    });
  }
};

app.post('/api/generate-report', generateReport);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});