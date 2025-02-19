export async function generateCandidateReport(
  csvContent: string,
  jobDescriptionContent: string,
  resumeContents: string[]
) {
  try {
    const response = await fetch('http://localhost:3000/api/generate-report', {
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
      throw new Error('Failed to generate report');
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
} 