import express from 'express';
import cors from 'cors';
import { Anthropic } from "@anthropic-ai/sdk";
import dotenv from 'dotenv';
import { Request, Response } from 'express';
// @ts-ignore
import pdf from 'pdf-parse';

dotenv.config();

interface GenerateReportRequest {
  csvContent: string;
  jobDescriptionContent: string;
  resumeContents: string[];
}

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

const generateReport = async (req: Request, res: Response): Promise<void> => {
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
              text: `<examples>
<example>
<example_description>
This output is good because it converts all the information you were given from different sources; Resumes in PDF format, Job Description in PDF format, and a CSV of the candidates' interview data and you generated a solid report for the client that focuses on the most important aspects with a clean format that is presentable
</example_description>
<candidate1>
${resumeContents[0]}
</candidate1>
<candidate2>
${resumeContents[1]}
</candidate2>
<candidate3>
${resumeContents[2]}
</candidate3>
<job_description>
${jobDescriptionContent}
</job_description>
<csv_data>
${csvContent}
</csv_data>
<ideal_output>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WordPress Developer Candidates Overview</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
    <div class="min-h-screen p-6">
        <div class="max-w-6xl mx-auto">
            <!-- Header -->
            <header class="text-center mb-12 mt-8">
                <h1 class="text-4xl font-bold text-gray-800 mb-4">WordPress Developer Candidates</h1>
                <div class="text-lg text-gray-600">Position: WordPress Developer at Cashflowy</div>
                <div class="mt-4 text-sm text-gray-500">Analysis Date: February 1, 2025</div>
            </header>

            <!-- Dashboard Overview -->
            <section class="bg-white rounded-xl shadow-lg p-8 mb-8">
                <h2 class="text-2xl font-bold text-gray-800 mb-8">Candidates Overview</h2>

                <!-- Kevin Pelozo -->
                <div class="border-b pb-6 mb-6">
                    <div class="flex items-center justify-between mb-4 flex-wrap gap-4">
                        <h3 class="text-xl font-semibold text-blue-800">Kevin Daniel Pelozo</h3>
                        <div class="flex items-center gap-6">
                            <span class="text-blue-600 font-medium whitespace-nowrap">5 Years Experience</span>
                            <div class="flex items-center whitespace-nowrap">
                                <span class="text-blue-600 font-medium mr-2">English:</span>
                                <div class="flex">
                                    <div class="flex" title="English Proficiency: 4 out of 5">
                                        ★★★★☆
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600">Overall Match</span>
                                <span class="text-blue-600 font-semibold">8.5/10</span>
                            </div>
                            <div class="bg-gray-100 rounded">
                                <div class="h-6 bg-blue-500 rounded" style="width: 85%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Hemant Lama -->
                <div class="border-b pb-6 mb-6">
                    <div class="flex items-center justify-between mb-4 flex-wrap gap-4">
                        <h3 class="text-xl font-semibold text-green-800">Hemant Lama</h3>
                        <div class="flex items-center gap-6">
                            <span class="text-green-600 font-medium whitespace-nowrap">10+ Years Experience</span>
                            <div class="flex items-center whitespace-nowrap">
                                <span class="text-green-600 font-medium mr-2">English:</span>
                                <div class="flex" title="English Proficiency: 4 out of 5">
                                    ★★★★☆
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600">Overall Match</span>
                                <span class="text-green-600 font-semibold">9/10</span>
                            </div>
                            <div class="bg-gray-100 rounded">
                                <div class="h-6 bg-green-500 rounded" style="width: 90%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Cesar Hernandez -->
                <div>
                    <div class="flex items-center justify-between mb-4 flex-wrap gap-4">
                        <h3 class="text-xl font-semibold text-purple-800">Cesar Hernandez</h3>
                        <div class="flex items-center gap-6">
                            <span class="text-purple-600 font-medium whitespace-nowrap">3 Years Experience</span>
                            <div class="flex items-center whitespace-nowrap">
                                <span class="text-purple-600 font-medium mr-2">English:</span>
                                <div class="flex" title="English Proficiency: 3 out of 5">
                                    ★★★☆☆
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-600">Overall Match</span>
                                <span class="text-purple-600 font-semibold">7.5/10</span>
                            </div>
                            <div class="bg-gray-100 rounded">
                                <div class="h-6 bg-purple-500 rounded" style="width: 75%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </div>
</body>
</html>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kevin Pelozo - Detailed Profile</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
    <div class="bg-white rounded-xl shadow-lg p-8">
        <h2 class="text-2xl font-bold text-blue-800 mb-6">Kevin Daniel Pelozo - Detailed Profile</h2>

        <div class="space-y-6">
            <!-- Core Info -->
            <div class="border-b pb-6">
                <div class="grid md:grid-cols-2 gap-6">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Experience & Skills</h3>
                        <ul class="space-y-2">
                            <li>• WordPress Developer: 5 years</li>
                            <li class="flex items-center flex-wrap gap-2">
                                <span>• English Level:</span>
                                <div class="flex">★★★★☆</div>
                            </li>
                            <li>• Specialization: Full-stack WordPress Development, AWS Infrastructure</li>
                        </ul>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Logistics</h3>
                        <ul class="space-y-2">
                            <li>• Location: San José, Costa Rica</li>
                            <li>• Availability: Full-time</li>
                            <li>• Start Date: Immediate</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Pros and Cons -->
            <div class="grid md:grid-cols-2 gap-8 mb-6">
                <div>
                    <h3 class="text-lg font-semibold text-green-700 mb-3">Pros</h3>
                    <ul class="space-y-2">
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Strong experience with WordPress multisite environments
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Extensive AWS infrastructure knowledge
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Experience with large-scale platforms (500+ companies, 2k+ users)
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Diverse tech stack including React, Ruby, PHP
                        </li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-red-700 mb-3">Considerations</h3>
                    <ul class="space-y-2">
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-red-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            May be overqualified for basic WordPress tasks
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-red-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            Salary expectations may be above budget range
                        </li>
                    </ul>
                </div>
            </div>

            <!-- Custom Analysis -->
            <div class="border-t pt-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Detailed Analysis</h3>
                <div class="bg-blue-50 p-6 rounded-lg">
                    <div class="space-y-4">
                        <!-- Technical Assessment -->
                        <div>
                            <h4 class="font-medium text-blue-800 mb-2">Technical Assessment</h4>
                            <p class="text-blue-700">
                                Kevin demonstrates exceptional technical proficiency with WordPress, particularly in complex implementations involving multisite setups, LMS integration, and AWS infrastructure. His experience with KuikMatch shows ability to handle large-scale WordPress deployments with multiple integrations. Strong background in both frontend and backend development with modern technologies.
                            </p>
                        </div>

                        <!-- Cultural Fit -->
                        <div>
                            <h4 class="font-medium text-blue-800 mb-2">Cultural Fit</h4>
                            <p class="text-blue-700">
                                Shows strong alignment with company values, particularly the "everything-is-figure-out-able" mindset through his diverse project portfolio. International experience living in 5 different countries suggests adaptability and strong communication skills, valuable for a remote position.
                            </p>
                        </div>

                        <!-- Growth Potential -->
                        <div>
                            <h4 class="font-medium text-blue-800 mb-2">Growth Potential</h4>
                            <p class="text-blue-700">
                                Strong potential for technical leadership given his experience managing complex projects and training new developers. Continuous learning evident through recent certifications and expanding skill set across multiple technologies.
                            </p>
                        </div>

                        <!-- Additional Notes -->
                        <div>
                            <h4 class="font-medium text-blue-800 mb-2">Additional Notes</h4>
                            <p class="text-blue-700">
                                Experience with BuddyBoss platform and membership systems directly aligns with potential future needs. AWS expertise could be valuable for scaling operations. Consider discussing long-term career goals to ensure role alignment.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hemant Lama - Detailed Profile</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
    <div class="bg-white rounded-xl shadow-lg p-8">
        <h2 class="text-2xl font-bold text-green-800 mb-6">Hemant Lama - Detailed Profile</h2>

        <div class="space-y-6">
            <!-- Core Info -->
            <div class="border-b pb-6">
                <div class="grid md:grid-cols-2 gap-6">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Experience & Skills</h3>
                        <ul class="space-y-2">
                            <li>• WordPress Developer: 10+ years</li>
                            <li class="flex items-center flex-wrap gap-2">
                                <span>• English Level:</span>
                                <div class="flex">★★★★☆</div>
                            </li>
                            <li>• Specialization: Full-stack WordPress Development, Custom Plugins & Themes</li>
                        </ul>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Logistics</h3>
                        <ul class="space-y-2">
                            <li>• Location: Kathmandu, Nepal</li>
                            <li>• Availability: Full-time</li>
                            <li>• Start Date: Immediate</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Pros and Cons -->
            <div class="grid md:grid-cols-2 gap-8 mb-6">
                <div>
                    <h3 class="text-lg font-semibold text-green-700 mb-3">Pros</h3>
                    <ul class="space-y-2">
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Extensive experience in custom WordPress development
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Strong expertise in plugin and theme development
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Proven experience with platform migrations
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Strong background in e-commerce development
                        </li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-red-700 mb-3">Considerations</h3>
                    <ul class="space-y-2">
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-red-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            Time zone difference may require coordination
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-red-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            Less experience with modern JavaScript frameworks
                        </li>
                    </ul>
                </div>
            </div>

            <!-- Custom Analysis -->
            <div class="border-t pt-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Detailed Analysis</h3>
                <div class="bg-green-50 p-6 rounded-lg">
                    <div class="space-y-4">
                        <!-- Technical Assessment -->
                        <div>
                            <h4 class="font-medium text-green-800 mb-2">Technical Assessment</h4>
                            <p class="text-green-700">
                                Hemant demonstrates exceptional proficiency in WordPress development with over a decade of hands-on experience. His expertise in creating custom plugins, themes, and Gutenberg blocks shows deep understanding of WordPress architecture. Particularly strong in migration projects from platforms like Hubspot, Wix, and Webflow, which demonstrates adaptability and problem-solving skills.
                            </p>
                        </div>

                        <!-- Cultural Fit -->
                        <div>
                            <h4 class="font-medium text-green-800 mb-2">Cultural Fit</h4>
                            <p class="text-green-700">
                                Shows strong alignment with the company's problem-solving mindset through his track record of handling complex migrations and custom development projects. Experience working with international clients and teams suggests good communication skills and adaptability to different work cultures.
                            </p>
                        </div>

                        <!-- Growth Potential -->
                        <div>
                            <h4 class="font-medium text-green-800 mb-2">Growth Potential</h4>
                            <p class="text-green-700">
                                Demonstrated leadership experience in client meetings and project management indicates potential for growth into technical leadership roles. Continuous skill development evident through expanding into modern development practices and tools.
                            </p>
                        </div>

                        <!-- Additional Notes -->
                        <div>
                            <h4 class="font-medium text-green-800 mb-2">Additional Notes</h4>
                            <p class="text-green-700">
                                Strong educational background with a BSc in Business Computing provides additional perspective valuable for business-oriented development decisions. Experience with SEO optimization and security implementations aligns well with the role requirements.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cesar Hernandez - Detailed Profile</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
    <div class="bg-white rounded-xl shadow-lg p-8">
        <h2 class="text-2xl font-bold text-purple-800 mb-6">Cesar Hernandez - Detailed Profile</h2>

        <div class="space-y-6">
            <!-- Core Info -->
            <div class="border-b pb-6">
                <div class="grid md:grid-cols-2 gap-6">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Experience & Skills</h3>
                        <ul class="space-y-2">
                            <li>• WordPress Developer: 3 years</li>
                            <li class="flex items-center flex-wrap gap-2">
                                <span>• English Level:</span>
                                <div class="flex">★★★☆☆</div>
                            </li>
                            <li>• Specialization: Frontend Development, E-Commerce, LMS</li>
                        </ul>
                    </div>
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">Logistics</h3>
                        <ul class="space-y-2">
                            <li>• Location: Colombia</li>
                            <li>• Availability: Full-time</li>
                            <li>• Start Date: Immediate</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Pros and Cons -->
            <div class="grid md:grid-cols-2 gap-8 mb-6">
                <div>
                    <h3 class="text-lg font-semibold text-green-700 mb-3">Pros</h3>
                    <ul class="space-y-2">
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Strong frontend development skills
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Experience with E-commerce and LMS implementations
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Project management background
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            Actively pursuing backend development skills
                        </li>
                    </ul>
                </div>
                <div>
                    <h3 class="text-lg font-semibold text-red-700 mb-3">Considerations</h3>
                    <ul class="space-y-2">
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-red-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            Less WordPress experience compared to requirements
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-red-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            Lower English proficiency level
                        </li>
                        <li class="flex items-start">
                            <svg class="h-5 w-5 text-red-500 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                            Limited experience with custom plugin development
                        </li>
                    </ul>
                </div>
            </div>

            <!-- Custom Analysis -->
            <div class="border-t pt-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Detailed Analysis</h3>
                <div class="bg-purple-50 p-6 rounded-lg">
                    <div class="space-y-4">
                        <!-- Technical Assessment -->
                        <div>
                            <h4 class="font-medium text-purple-800 mb-2">Technical Assessment</h4>
                            <p class="text-purple-700">
                                Cesar shows strong frontend development skills and practical experience with WordPress implementations. His experience managing over 30 websites demonstrates ability to handle multiple projects. Currently expanding his skill set with backend development studies, showing commitment to growth.
                            </p>
                        </div>

                        <!-- Cultural Fit -->
                        <div>
                            <h4 class="font-medium text-purple-800 mb-2">Cultural Fit</h4>
                            <p class="text-purple-700">
                                Background in mechanical engineering demonstrates analytical thinking and problem-solving abilities. Shows strong alignment with the company's learning mindset through continuous skill development and transition into web development.
                            </p>
                        </div>

                        <!-- Growth Potential -->
                        <div>
                            <h4 class="font-medium text-purple-800 mb-2">Growth Potential</h4>
                            <p class="text-purple-700">
                                Currently pursuing backend development studies and expanding technical skills. Strong project management background could be valuable for future leadership roles. Shows dedication to professional development through continuous learning.
                            </p>
                        </div>

                        <!-- Additional Notes -->
                        <div>
                            <h4 class="font-medium text-purple-800 mb-2">Additional Notes</h4>
                            <p class="text-purple-700">
                                Experience with E-commerce and LMS implementations aligns with potential business needs. Engineering background provides strong foundation for technical problem-solving. Consider additional training support to accelerate WordPress expertise development.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
</ideal_output>
</example>
</examples>`
            },
            {
              type: "text",
              text: "Create a candidate report from these files."
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