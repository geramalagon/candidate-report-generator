import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
// @ts-ignore
import pdf from 'pdf-parse';
import { config, validateConfig } from './config/environment';
import { fetchData, generateContent } from './utils/apiClient';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { exec } from 'child_process';
import fetch from 'node-fetch';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads')); // Use the uploads directory
  },
  filename: (req, file, cb) => {
    // Keep the original filename to help with matching resumes to candidates
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Verify API key is available
if (!process.env.GOOGLE_API_KEY) {
  console.error('GOOGLE_API_KEY environment variable is not set');
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

// At the top of your file, after dotenv.config()
console.log('Environment variables loaded:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`- GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT}`);
console.log(`- GOOGLE_API_KEY set: ${Boolean(process.env.GOOGLE_API_KEY)}`);

// If the API key exists, log a masked version
if (process.env.GOOGLE_API_KEY) {
  const key = process.env.GOOGLE_API_KEY;
  const maskedKey = key.substring(0, 4) + '...' + key.substring(key.length - 4);
  console.log(`- GOOGLE_API_KEY: ${maskedKey}`);
}

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
          message: 'Missing required input files'
        }
      });
      return;
    }

    // Truncate resume contents if needed
    const maxResumeLength = 10000; // characters per resume
    const truncatedResumes = resumeContents.map(content => {
      if (content.length > maxResumeLength) {
        console.warn(`Truncating resume from ${content.length} to ${maxResumeLength} characters`);
        return content.substring(0, maxResumeLength);
      }
      return content;
    });

    // Create a more concise prompt
    const prompt = `Create a candidate report based on these materials:
    
Job Description:
${jobDescriptionContent.substring(0, 5000)}

CSV Data:
${csvContent}

${truncatedResumes.map((resume, index) => `Resume ${index + 1}:\n${resume}`).join('\n\n')}

Generate a detailed HTML report comparing these candidates for the position.`;

    const result = await generateContent(prompt);
    
    // Extract the generated text from the response
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!generatedText) {
      throw new Error('No content generated from the model');
    }

    res.json({
      success: true,
      data: generatedText
    });

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

// Update the Python report generation endpoint
app.post('/api/generate-report-python', 
  upload.fields([
    { name: 'csvFile', maxCount: 1 },
    { name: 'pdfFiles', maxCount: 10 }
  ]), 
  (req: Request, res: Response): void => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const csvFile = files?.['csvFile']?.[0];
    const pdfFiles = files?.['pdfFiles'];
    
    if (!csvFile || !pdfFiles || pdfFiles.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Missing required files'
        }
      });
      return;
    }
    
    // Log the uploaded files for debugging
    console.log('CSV File:', csvFile.originalname, csvFile.path);
    console.log('PDF Files:', pdfFiles.map(f => `${f.originalname} -> ${f.path}`));
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const pythonScriptPath = path.join(__dirname, 'candidate_report_generator.py');
    
    // Join the PDF paths with quotes to handle spaces in filenames
    const pdfPathsString = pdfFiles.map(file => `"${file.path}"`).join(' ');
    
    // Build the command with proper quoting
    const command = `python "${pythonScriptPath}" "${csvFile.path}" ${pdfPathsString}`;
    
    console.log('Executing command:', command);
    
    // Pass environment variables to the child process
    const env = { ...process.env };
    
    // Increase the maxBuffer size significantly
    exec(command, { env, maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing Python script: ${error}`);
        res.status(500).json({
          success: false,
          error: {
            type: 'python_error',
            message: `Python script error: ${error.message || error}`
          }
        });
        return;
      }
      
      if (stderr) {
        console.error(`Python script stderr: ${stderr}`);
      }
      
      // Don't clean up files immediately for debugging purposes
      // We'll comment this out for now to help with debugging
      /*
      try {
        fs.unlinkSync(csvFile.path);
        pdfFiles.forEach(file => fs.unlinkSync(file.path));
      } catch (cleanupError) {
        console.error('Error cleaning up files:', cleanupError);
      }
      */
      
      res.json({
        success: true,
        data: stdout
      });
    });
  }
);

// Your existing API endpoint for Gemini-based report generation
app.post('/api/generate-report', generateReport);

// Add this new endpoint to test the API key
app.get('/api/test-api-key', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      res.status(500).json({
        success: false,
        error: {
          type: 'configuration_error',
          message: 'API key is not configured'
        }
      });
      return;
    }
    
    // Make a simple test request to the Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Hello, please respond with just the word 'Success' if you can read this message."
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 10
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('API Key Test Error:', errorData);
      
      res.status(500).json({
        success: false,
        error: {
          type: 'api_error',
          message: `API error: ${errorData.error?.message || 'Unknown error'}`,
          details: errorData
        }
      });
      return;
    }
    
    const data = await response.json();
    
    res.json({
      success: true,
      message: 'API key is valid',
      response: data
    });
  } catch (error: any) {
    console.error('Error testing API key:', error);
    
    res.status(500).json({
      success: false,
      error: {
        type: 'test_error',
        message: error.message || 'Unknown error'
      }
    });
  }
});

const PORT = process.env.PORT || 3001;
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