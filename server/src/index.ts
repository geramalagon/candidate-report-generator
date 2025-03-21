import express from 'express';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';
import pdf from 'pdf-parse';
import { config, validateConfig } from './config/environment';
import { fetchData, generateContent } from './utils/apiClient';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import os from 'os';

// Import express-async-errors at the top to catch unhandled promise rejections
import 'express-async-errors';

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

// Update the generateReport function with better debugging
const generateReport = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log("Received generate-report request");
    const { csvContent, jobDescriptionContent, resumeContents } = req.body as GenerateReportRequest;

    // Validate inputs with more detailed logging
    console.log("Validating inputs:");
    console.log("- CSV content exists:", Boolean(csvContent));
    console.log("- CSV content type:", typeof csvContent);
    console.log("- CSV content sample:", csvContent?.substring(0, 100) + "...");
    console.log("- Job description exists:", Boolean(jobDescriptionContent));
    console.log("- Job description sample:", jobDescriptionContent?.substring(0, 100) + "...");
    console.log("- Resume contents count:", resumeContents?.length || 0);
    if (resumeContents?.length > 0) {
      console.log("- First resume sample:", resumeContents[0]?.substring(0, 100) + "...");
    }

    if (!csvContent || !jobDescriptionContent || !resumeContents || resumeContents.length === 0) {
      console.error("Missing required input files");
      res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Missing required input files'
        }
      });
      return;
    }

    // Get current date for the report
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Read the prompt from the file - CHECK THIS PATH
    const promptFilePath = path.join(__dirname, '..', 'prompt.txt');
    console.log("Looking for prompt file at:", promptFilePath);
    // Initialize with empty string to avoid "used before assigned" errors
    let promptTemplate = '';

    try {
      promptTemplate = fs.readFileSync(promptFilePath, 'utf8');
      console.log("Prompt template loaded, length:", promptTemplate.length);
      console.log("Prompt template sample:", promptTemplate.substring(0, 100) + "...");
    } catch (readError) {
      console.error('Error reading prompt file:', readError);
      console.error('Current directory:', __dirname);
      console.error('Attempted path:', promptFilePath);
      
      // Try alternative locations
      const altPaths = [
        path.join(__dirname, 'prompt.txt'),
        path.join(__dirname, '../..', 'prompt.txt'),
        path.join(process.cwd(), 'prompt.txt')
      ];
      console.log("Trying alternative paths:", altPaths);
      
      let found = false;
      for (const altPath of altPaths) {
        try {
          console.log("Trying:", altPath);
          const content = fs.readFileSync(altPath, 'utf8');
          if (content) {
            promptTemplate = content;
            console.log("Found prompt at:", altPath);
            found = true;
            break;
          }
        } catch (e) {
          console.log("Not found at:", altPath);
        }
      }
      
      if (!found) {
        throw new Error('Failed to read the prompt file');
      }
    }

    // Read the example output HTML file - CHECK THIS PATH
    const exampleOutputPath = path.join(__dirname, '..', 'example_output.html');
    console.log("Looking for example output file at:", exampleOutputPath);
    // Initialize with empty string to avoid "used before assigned" errors
    let exampleOutput = '';

    try {
      exampleOutput = fs.readFileSync(exampleOutputPath, 'utf8');
      console.log("Example output loaded, length:", exampleOutput.length);
    } catch (readError) {
      console.error('Error reading example output file:', readError);
      console.error('Current directory:', __dirname);
      console.error('Attempted path:', exampleOutputPath);
      
      // Try alternative locations
      const altPaths = [
        path.join(__dirname, 'example_output.html'),
        path.join(__dirname, '../..', 'example_output.html'),
        path.join(process.cwd(), 'example_output.html')
      ];
      console.log("Trying alternative paths:", altPaths);
      
      let found = false;
      for (const altPath of altPaths) {
        try {
          console.log("Trying:", altPath);
          const content = fs.readFileSync(altPath, 'utf8');
          if (content) {
            exampleOutput = content;
            console.log("Found example output at:", altPath);
            found = true;
            break;
          }
        } catch (e) {
          console.log("Not found at:", altPath);
        }
      }
      
      if (!found) {
        throw new Error('Failed to read the example output file');
      }
    }

    // Process resume contents - check for and decode base64 PDFs
    const processedResumeContents = await Promise.all(resumeContents.map(async (content, index) => {
      try {
        // Check if content appears to be base64 encoded
        const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(content.trim());
        
        if (isBase64) {
          console.log(`Resume ${index+1} appears to be base64 encoded, attempting to extract text...`);
          try {
            const extractedText = await extractTextFromBase64PDF(content);
            console.log(`Successfully extracted text from resume ${index+1}, length: ${extractedText.length}`);
            return extractedText;
          } catch (extractError) {
            console.error(`Failed to extract text from base64 PDF for resume ${index+1}:`, extractError);
            console.log('Falling back to using raw content');
            return content;
          }
        } else {
          console.log(`Resume ${index+1} appears to be plain text, using as-is`);
          return content;
        }
      } catch (error) {
        console.error(`Error processing resume ${index+1}:`, error);
        return content; // Fall back to original content if processing fails
      }
    }));

    // Insert the actual file contents into the prompt
    const candidateDataSection = processedResumeContents.map((resume, index) => `
<candidate${index + 1}>
${resume}
</candidate${index + 1}>
`).join('\n');

    console.log("Candidate data section created, length:", candidateDataSection.length);

    // Create the full prompt with all data
    const fullPrompt = `${promptTemplate}

## Input Data

<csv_file>
${csvContent}
</csv_file>

<job_description>
${jobDescriptionContent}
</job_description>

${candidateDataSection}

## Example Output Format

Here is an example of the expected HTML output format:

\`\`\`html
${exampleOutput}
\`\`\`

Please generate a complete HTML report following this structure, using the provided candidate data, CSV content, and job description.`;

    console.log("Full prompt created, total length:", fullPrompt.length);
    console.log("First 200 chars:", fullPrompt.substring(0, 200));
    console.log("Last 200 chars:", fullPrompt.substring(fullPrompt.length - 200));

    // Check if the prompt is too long for the model
    if (fullPrompt.length > 100000) {
      console.warn("Warning: Prompt is very long (" + fullPrompt.length + " chars). This might exceed model limits.");
    }

    // Log the API call we're about to make
    console.log("Calling generateContent with prompt length:", fullPrompt.length);
    console.log("First 200 chars:", fullPrompt.substring(0, 200));
    console.log("Last 200 chars:", fullPrompt.substring(fullPrompt.length - 200));

    // Call the Gemini API
    const result = await generateContent(fullPrompt);
    
    // Check if there was an error
    if ('error' in result) {
      console.error("Error from generateContent:", result.error);
      res.status(500).json({
        success: false,
        error: {
          type: 'api_error',
          message: result.error,
          details: result.details
        }
      });
      return;
    }

    console.log("API response received");
    console.log("Response has candidates:", Boolean(result.candidates));
    console.log("Number of candidates:", result.candidates?.length || 0);

    // Extract the generated text from the response
    const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log("Generated text length:", generatedText.length);
    console.log("Generated text sample:", generatedText.substring(0, 200) + "...");

    if (!generatedText) {
      console.error("No content generated from the model");
      res.status(500).json({
        success: false,
        error: {
          type: 'generation_error',
          message: 'No content generated from the model'
        }
      });
      return;
    }

    // Send the HTML directly instead of wrapping it in JSON
    res.setHeader('Content-Type', 'text/html');
    res.send(generatedText);

  } catch (error: any) {
    console.error("Error in generateReport:", error);
    console.error("Error stack:", error.stack);
    
    // Log more details about the error
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    
    res.status(500).json({
      success: false,
      error: {
        type: 'server_error',
        message: error.message || 'An error occurred while generating the report',
        details: error.response?.data || error
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

      // Send the HTML directly instead of wrapping it in JSON
      res.setHeader('Content-Type', 'text/html');
      res.send(stdout);
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
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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
    return;
  }
});

// Add a new endpoint for testing base64 encoding
app.post('/api/test-encoding', (req: Request, res: Response) => {
  try {
    const testData = req.body;
    const results: Record<string, string> = {};
    
    // Encode each test string to base64
    for (const [key, value] of Object.entries(testData)) {
      if (typeof value === 'string') {
        // Node.js approach to base64 encoding with proper UTF-8 handling
        results[key] = Buffer.from(value, 'utf-8').toString('base64');
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error in encoding test endpoint:', error);
    res.status(500).json({ error: 'Failed to encode test data' });
  }
});

// Global error handler for Express
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled server error:', err);
  console.error('Error stack:', err.stack);
  
  // Always return JSON
  res.status(500).json({
    success: false,
    error: {
      type: 'unhandled_server_error',
      message: config.environment === 'production' 
        ? 'An unexpected error occurred on the server'
        : err.message || 'An unexpected error occurred on the server'
    }
  });
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