import Anthropic from '@anthropic-ai/sdk';

// Check for API key at startup
if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
  console.error('Missing VITE_ANTHROPIC_API_KEY environment variable');
  throw new Error('Anthropic API key is not configured. Please add your API key to the .env file.');
}

// Initialize Anthropic client
export const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
});

export async function generateCandidateReport(
  csvContent: string,
  jobDescriptionContent: string,
  resumeContents: string[]
) {
  if (!csvContent || !jobDescriptionContent || !resumeContents.length) {
    throw new Error('Missing required input data');
  }

  try {
    const msg = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4096,
      temperature: 0,
      system: `You are an expert system for analyzing technical candidate data and generating standardized reports. Your task is to process candidate information and create a comprehensive HTML report with a dashboard overview and detailed candidate profiles.

Format the output as clean HTML with Tailwind CSS classes for styling. Focus on creating a professional, easy-to-read report that highlights key candidate information and comparisons.

Guidelines:
1. Use consistent color coding:
   - First candidate: Blue theme (blue-800, blue-500, etc.)
   - Second candidate: Green theme
   - Third candidate: Purple theme
2. Include visual score indicators
3. Highlight key strengths and areas for improvement
4. Ensure mobile-responsive layout
5. Use appropriate icons and visual elements`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `CSV Data:
${csvContent}

Job Description:
${jobDescriptionContent}

Resumes:
${resumeContents.join('\n\n---\n\n')}

Please analyze these candidates and create a detailed HTML report comparing their qualifications.`
            }
          ]
        }
      ]
    });

    if (!msg.content[0]?.text) {
      throw new Error('No report content received from API');
    }

    return msg.content[0].text;
  } catch (error) {
    // Handle Anthropic API specific errors
    if (error instanceof Anthropic.APIError) {
      const status = error.status;
      const errorMessage = error.error?.message || 'Unknown API error';
      
      // Log detailed error information for debugging
      console.error('Anthropic API Error:', {
        status,
        message: errorMessage,
        error: error.error
      });

      // Map specific error codes to user-friendly messages
      switch (status) {
        case 401:
          throw new Error('Authentication failed. Please check your API key.');
        case 429:
          throw new Error('Too many requests. Please try again in a few minutes.');
        case 400:
          throw new Error(`Invalid request: ${errorMessage}`);
        case 500:
          throw new Error('Service temporarily unavailable. Please try again later.');
        default:
          throw new Error(`API error (${status}): ${errorMessage}`);
      }
    }

    // Handle network or other errors
    if (error instanceof Error) {
      console.error('Report Generation Error:', error);
      throw new Error(`Failed to generate report: ${error.message}`);
    }

    // Fallback for unknown errors
    console.error('Unknown Error:', error);
    throw new Error('An unexpected error occurred while generating the report.');
  }
}