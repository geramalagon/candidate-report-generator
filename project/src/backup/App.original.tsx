import React, { useState } from 'react';
import { Upload, FileText, Copy, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import _ from 'lodash';
import * as pdfjsLib from 'pdfjs-dist';
import type { Candidate, ProcessedFile } from './types';

// Set worker source path
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

function App() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState('');

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const content = await file.text();
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const processedData = results.data.map((row: any) => {
              try {
                const interviewData = typeof row.interviewData === 'string' ? 
                  JSON.parse(row.interviewData) : row.interviewData;
                
                return {
                  name: row.Name,
                  role: row.Role,
                  company: row.Company,
                  interviewData
                };
              } catch (e) {
                throw new Error(`Failed to parse interview data for candidate: ${row.Name}`);
              }
            });

            if (processedData.length === 0) {
              throw new Error('No valid candidate data found in CSV');
            }

            setCandidates(processedData);
            generateReport(processedData);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process CSV data');
          }
        },
        error: (error) => {
          setError(`CSV parsing error: ${error.message}`);
        }
      });
    } catch (err) {
      setError(`Failed to process CSV: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const processPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/cmaps/',
        cMapPacked: true,
      });
      
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + ' ';
      }
      
      return fullText
        .replace(/\s+/g, ' ')
        .replace(/\n/g, ' ')
        .trim();
    } catch (err) {
      console.error('PDF processing error:', err);
      throw new Error('Failed to extract text from PDF');
    }
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);

    const newProcessedFiles = files.map(file => ({
      name: file.name,
      processed: false,
    }));
    setProcessedFiles(newProcessedFiles);

    try {
      for (const file of files) {
        try {
          const content = await processPDF(file);
          if (!content) {
            throw new Error('No text content extracted from PDF');
          }
          
          const candidateName = file.name.replace('.pdf', '').trim().toUpperCase();
          
          setCandidates(prev => prev.map(candidate => 
            candidate.name === candidateName
              ? { ...candidate, resumeContent: content }
              : candidate
          ));

          setProcessedFiles(prev => prev.map(pf => 
            pf.name === file.name
              ? { ...pf, processed: true }
              : pf
          ));
        } catch (err) {
          console.error(`Error processing ${file.name}:`, err);
          setProcessedFiles(prev => prev.map(pf => 
            pf.name === file.name
              ? { ...pf, processed: true, error: 'Failed to process PDF. Please ensure the file is not corrupted and try again.' }
              : pf
          ));
        }
      }

      generateReport(candidates);
    } catch (err) {
      setError(`Failed to process PDFs: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const generateReport = _.debounce((candidatesData: Candidate[]) => {
    let report = `# Candidate Analysis Data\n\n`;
    
    // Add context about the role
    report += `## Role Information\n`;
    report += `* Position: WordPress Developer\n`;
    report += `* Company: Heidi\n\n`;
    
    // Process each candidate
    candidatesData.forEach(candidate => {
      const interviewData = candidate.interviewData;
      
      report += `## Candidate: ${candidate.name}\n\n`;
      
      // Interview Data Section
      report += `### Interview Data\n`;
      report += `* Interview ID: ${interviewData.interview_id}\n`;
      report += `* Applied Position: ${interviewData.job_title_applied_for}\n`;
      report += `* Preparedness Score: ${interviewData.preparedness_score}/10\n`;
      report += `* Values Alignment Score: ${interviewData.values_alignment_score}/10\n`;
      report += `* Language Proficiency Score: ${interviewData.language_proficiency_score}/10\n`;
      report += `* Years of Relevant Experience: ${interviewData.relevant_experience_years}\n`;
      report += `* Key Skills Mentioned: ${interviewData.key_skills_mentioned.join(', ')}\n`;
      report += `* Additional Experience: ${interviewData.additional_experience_shared}\n`;
      report += `* Final Recommendation: ${interviewData.final_recommendation ? '✅ Recommended' : '❌ Not Recommended'}\n\n`;
      
      // Resume Content Section
      if (candidate.resumeContent) {
        report += `### Resume Content\n`;
        report += `\`\`\`\n${candidate.resumeContent}\n\`\`\`\n\n`;
      }
      
      report += `---\n\n`;
    });
    
    // Add prompt suggestion
    report += `## Analysis Request\n\n`;
    report += `Please analyze each candidate based on both their interview data and resume content. Consider:\n`;
    report += `1. Technical expertise and experience alignment with WordPress development\n`;
    report += `2. Soft skills and communication abilities\n`;
    report += `3. Cultural fit and values alignment\n`;
    report += `4. Overall recommendation\n\n`;
    report += `Generate a detailed report following the provided template format.\n`;
    
    setReport(report);
  }, 500);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(report);
      const button = document.activeElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback method
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        alert('Content copied to clipboard!');
      } catch (err) {
        console.error('Fallback failed:', err);
        alert('Failed to copy content. Please try selecting and copying manually.');
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-8 space-y-6">
        <h2 className="text-2xl font-bold">AI-Ready Report Generator</h2>
        
        <div className="flex gap-4 mb-4">
          <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-6">
            <label className="cursor-pointer block">
              <input 
                type="file" 
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden" 
              />
              <div className="flex flex-col items-center">
                <FileText className="h-12 w-12 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  Upload Candidate Data (CSV)
                </span>
                {candidates.length > 0 && (
                  <span className="mt-2 text-green-600 text-xs">
                    ✓ CSV Processed
                  </span>
                )}
              </div>
            </label>
          </div>
          
          <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-6">
            <label className="cursor-pointer block">
              <input 
                type="file" 
                accept=".pdf"
                multiple
                onChange={handleResumeUpload}
                className="hidden" 
              />
              <div className="flex flex-col items-center">
                <Upload className="h-12 w-12 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  Upload Resumes (PDF)
                </span>
                {processedFiles.length > 0 && (
                  <span className="mt-2 text-green-600 text-xs">
                    ✓ {processedFiles.filter(f => f.processed).length} PDFs Processed
                  </span>
                )}
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-blue-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Processing files...</span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Processed Files Status */}
      {processedFiles.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold mb-4">Processed Files</h3>
          <ul className="space-y-2">
            {processedFiles.map((file, index) => (
              <li key={index} className="flex items-center gap-2">
                {file.processed ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                )}
                <span className={file.error ? 'text-red-600' : 'text-gray-700'}>
                  {file.name}
                </span>
                {file.error && (
                  <span className="text-sm text-red-600">- {file.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">AI-Ready Analysis Data</h3>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Copy className="h-4 w-4" />
              Copy to Clipboard
            </button>
          </div>
          <div className="bg-gray-50 p-6 rounded-lg">
            <pre className="whitespace-pre-wrap">{report}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;