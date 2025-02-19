import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

app.post('/api/generate-report', async (req, res) => {
  try {
    const { csvContent, jobDescriptionContent, resumeContents } = req.body;
    
    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8192,
      temperature: 0,
      system: `You are an expert system for analyzing technical candidate data and generating standardized reports. Your task is to process candidate information and create a comprehensive HTML report with a dashboard overview and detailed candidate profiles.

Format the output as clean HTML with Tailwind CSS classes for styling. Focus on creating a professional, easy-to-read report that highlights key candidate information and comparisons.`,
      messages: [
        {
          role: "user",
          content: `CSV Data: ${csvContent}\n\nJob Description: ${jobDescriptionContent}\n\nResumes: ${resumeContents.join('\n\n---\n\n')}`
        }
      ]
    });

    res.json({ result: msg.content[0].text });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 