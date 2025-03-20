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
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to generate report');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
} 