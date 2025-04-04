export async function generateCandidateReport(
  csvContent: string,
  jobDescriptionContent: string,
  resumeContents: string[]
) {
  try {
    // Add logging to see what's being sent
    console.log("Sending API request with:");
    console.log("- CSV length:", csvContent?.length || 0);
    console.log("- Job description length:", jobDescriptionContent?.length || 0);
    console.log("- Number of resumes:", resumeContents?.length || 0);
    
    // Use a relative URL in production, localhost in development
    const apiUrl = import.meta.env.PROD 
      ? '/api/generate-report'  // Production: use relative path
      : 'http://localhost:3001/api/generate-report'; // Development: use localhost
    
    console.log("Using API URL:", apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        csvContent,
        jobDescriptionContent,
        resumeContents
      })
    });

    if (!response.ok) {
      // Clone the response before reading it
      const errorResponseClone = response.clone();
      
      // Try to parse error as JSON, but be prepared for non-JSON responses
      try {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate report');
      } catch (parseError) {
        // If response is not JSON, get it as text from the clone
        const errorText = await errorResponseClone.text();
        throw new Error(`Server error: ${errorText.substring(0, 100)}...`);
      }
    }

    // Check content type to determine how to process the response
    const contentType = response.headers.get('Content-Type');
    
    if (contentType && contentType.includes('text/html')) {
      // Return HTML directly
      return await response.text();
    } else {
      // Clone the response before attempting to read as JSON
      const responseClone = response.clone();
      
      // Process as JSON
      try {
        const data = await response.json();
        return data.data || data;
      } catch (parseError) {
        // Fallback to text if JSON parsing fails (using the clone)
        return await responseClone.text();
      }
    }
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
} 