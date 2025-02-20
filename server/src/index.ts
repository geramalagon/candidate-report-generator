import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
// @ts-ignore
import pdf from 'pdf-parse';
import { config, validateConfig } from './config/environment';
import { fetchData } from './utils/apiClient';

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Required environment variables
const requiredEnvVars = [
  'GOOGLE_CLOUD_PROJECT',
  'GOOGLE_CLOUD_LOCATION'
] as const;

// Check for missing environment variables
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}`
  );
}

// Validate environment configuration
validateConfig();

let vertexAI: VertexAI;

try {
  // Initialize VertexAI with proper authentication
  vertexAI = new VertexAI({
    project: config.google.projectId,
    location: config.google.location,
  });

  console.log('VertexAI initialized successfully with:', {
    project: config.google.projectId,
    location: config.google.location,
    environment: config.environment,
  });
} catch (error) {
  console.error('Error initializing VertexAI:', error);
  throw error;
}

interface GenerateReportRequest {
  csvContent: string;
  jobDescriptionContent: string;
  resumeContents: string[];
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

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
    // Add authentication check
    if (!vertexAI) {
      throw new Error('VertexAI client not initialized');
    }

    const { csvContent, jobDescriptionContent, resumeContents } = req.body as GenerateReportRequest;

    // Validate inputs
    if (!csvContent || !jobDescriptionContent || !resumeContents || resumeContents.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Missing required input files'
        }
      });
      return;
    }

    const model = vertexAI.preview.getGenerativeModel({
      model: 'gemini-pro',
    });

    const prompt = `<examples>
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
</example>
</examples>

Create a candidate report from these files.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 8192,
      },
    });

    const response = await result.response;
    
    // Add null check for response.candidates
    if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API');
    }

    const text = response.candidates[0].content.parts[0].text;

    res.json({
      success: true,
      data: text
    });

  } catch (error: any) {
    console.error('Server Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    
    res.status(500).json({
      success: false,
      error: {
        type: 'server_error',
        message: error.message,
        details: config.isProduction ? undefined : error.stack,
      }
    });
  }
};

app.post('/api/generate-report', generateReport);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { generateReport };

async function main() {
  try {
    const data = await fetchData();
    console.log('Fetched data:', data);
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

main();