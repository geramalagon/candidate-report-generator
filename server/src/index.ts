import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
// @ts-ignore
import pdf from 'pdf-parse';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

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

app.post('/api/generate-report', async (req, res) => {
  try {
    const { csvContent, jobDescriptionContent, resumeContents } = req.body;
    
    // Extract text from PDFs
    const jobDescriptionText = await extractTextFromBase64PDF(jobDescriptionContent);
    const resumeTexts = await Promise.all(
      resumeContents.map((content: string) => extractTextFromBase64PDF(content))
    );

    // Log sizes for debugging
    console.log('\nText content sizes (in bytes):');
    console.log('CSV:', Buffer.byteLength(csvContent, 'utf8'));
    console.log('Job Description:', Buffer.byteLength(jobDescriptionText, 'utf8'));
    resumeTexts.forEach((text, index) => {
      console.log(`Resume ${index + 1}:`, Buffer.byteLength(text, 'utf8'));
    });

    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8192,
      temperature: 0,
      system: "You are an expert HR professional and recruiter. Your task is to analyze job descriptions, resumes, and interview results to provide detailed candidate comparisons and recommendations.",
      messages: [{
        role: "user",
        content: [
          {
            type: "text" as const,
            text: `Please analyze these documents and provide a detailed report comparing the candidates. 
                  Focus on:
                  1. Match between job requirements and candidate qualifications
                  2. Interview performance from the CSV data
                  3. Overall ranking of candidates
                  4. Specific strengths and weaknesses of each candidate
                  5. Final recommendations`
          },
          {
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: jobDescriptionContent.split(',')[1] || jobDescriptionContent
            }
          },
          ...resumeContents.map((content: string) => ({
            type: "document" as const,
            source: {
              type: "base64" as const,
              media_type: "application/pdf" as const,
              data: content.split(',')[1] || content
            }
          })),
          {
            type: "text" as const,
            text: `CSV Data (Interview Results):\n${csvContent}`
          }
        ]
      }]
    });

    // Type check the response content
    const content = msg.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }

    res.json({ 
      success: true, 
      result: content.text 
    });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate report',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});