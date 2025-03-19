import { config } from '../config/environment';
import { GoogleAuth } from 'google-auth-library';
import fetch from 'node-fetch';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Initialize Google Auth client
const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform']
});

// Approximate token count estimation (rough estimate)
function estimateTokenCount(text: string): number {
  // A very rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

// Function to truncate text to fit within token limit
function truncateToTokenLimit(text: string, maxTokens: number = 30000): string {
  const estimatedTokens = estimateTokenCount(text);
  
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  
  // If we need to truncate, do it by character count (approximate)
  const maxChars = maxTokens * 4;
  console.warn(`Input text truncated from ~${estimatedTokens} tokens to ${maxTokens} tokens`);
  return text.substring(0, maxChars);
}

// Export the function
export async function fetchData() {
  try {
    // Get credentials
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    
    if (!accessToken.token) {
      throw new Error('Failed to get access token');
    }

    const endpoint = `https://${config.google.location}-aiplatform.googleapis.com/v1/projects/${config.google.projectId}/locations/${config.google.location}`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken.token}`,
      },
    });

    if (!response.ok) {
      console.error(`Error: ${response.status} - ${response.statusText}`);
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// Make sure the API key is available and log it (partially masked for security)
const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error('GOOGLE_API_KEY environment variable is not set');
} else {
  // Log first 4 and last 4 characters of the API key for debugging
  const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
  console.log(`Using API key: ${maskedKey}`);
}

export async function generateContent(prompt: string) {
  console.log("generateContent called with prompt length:", prompt.length);
  
  // Log the first and last parts of the prompt
  console.log("PROMPT FIRST 1000 CHARS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
  console.log(prompt.substring(0, 1000));
  console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
  console.log("PROMPT LAST 1000 CHARS >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
  console.log(prompt.substring(prompt.length - 1000));
  console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
  
  // Check if API key is set
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_API_KEY is not set in environment variables");
    throw new Error("API key is not configured");
  }
  
  try {
    // Initialize the Google Generative AI client
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // For text-only input, use the gemini-pro model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    console.log("Using model: gemini-pro");
    
    // Configure safety settings
    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ];
    
    // Configure generation parameters
    const generationConfig = {
      temperature: 0.4,
      topK: 32,
      topP: 1,
      maxOutputTokens: 8192,
    };
    
    console.log("Sending request to Gemini API...");
    
    // Generate content
    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }] }],
      safetySettings,
      generationConfig,
    });
    
    console.log("Response received from Gemini API");
    
    // Log response details
    const response = result.response;
    console.log("Response has text:", Boolean(response.text()));
    console.log("Response text length:", response.text().length);
    console.log("Response text sample:", response.text().substring(0, 500) + "...");
    
    // Format the response to match the expected structure
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                text: response.text()
              }
            ]
          }
        }
      ]
    };
  } catch (error) {
    console.error("Error in generateContent:", error);
    
    // Log more details about the error
    if (error.response) {
      console.error("Error response:", error.response.data);
    }
    
    throw error;
  }
}

// You can add more exported functions here
export async function otherFunction() {
  // ... implementation
} 