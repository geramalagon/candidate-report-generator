import React, { useState, useRef, DragEvent } from 'react';
import CopyButton from './components/CopyButton';
import DownloadButton from './components/DownloadButton';
import { generateCandidateReport } from './lib/api';
import './App.css'; // Make sure to import your CSS

function App() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [jobDescriptionFile, setJobDescriptionFile] = useState<File | null>(null);
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [reportHtml, setReportHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for file inputs
  const csvInputRef = useRef<HTMLInputElement>(null);
  const jobDescInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  
  // Drag states
  const [csvDragActive, setCsvDragActive] = useState<boolean>(false);
  const [jobDescDragActive, setJobDescDragActive] = useState<boolean>(false);
  const [resumeDragActive, setResumeDragActive] = useState<boolean>(false);

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      if (!csvFile || !jobDescriptionFile || resumeFiles.length === 0) {
        throw new Error('Please select all required files');
      }
      
      const csvContent = await readFileAsText(csvFile);
      const jobDescriptionContent = await readFileAsText(jobDescriptionFile);
      const resumeContents = await Promise.all(resumeFiles.map(readFileAsText));
      
      const report = await generateCandidateReport(
        csvContent,
        jobDescriptionContent,
        resumeContents
      );
      
      setReportHtml(report);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle drag events
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDragEnter = (e: DragEvent<HTMLDivElement>, setDragActive: React.Dispatch<React.SetStateAction<boolean>>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  
  const handleDragLeave = (e: DragEvent<HTMLDivElement>, setDragActive: React.Dispatch<React.SetStateAction<boolean>>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  
  const handleDrop = async (
    e: DragEvent<HTMLDivElement>, 
    fileType: 'csv' | 'jobDesc' | 'resume',
    setDragActive: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      switch (fileType) {
        case 'csv':
          // Only accept the first file for CSV
          if (e.dataTransfer.files[0].name.endsWith('.csv')) {
            setCsvFile(e.dataTransfer.files[0]);
          } else {
            setError('Please upload a CSV file for the candidate data');
          }
          break;
        case 'jobDesc':
          // Only accept the first file for job description
          setJobDescriptionFile(e.dataTransfer.files[0]);
          break;
        case 'resume':
          // Accept multiple files for resumes
          setResumeFiles(Array.from(e.dataTransfer.files));
          break;
      }
    }
  };
  
  // Remove file handlers
  const removeCSVFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCsvFile(null);
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  };
  
  const removeJobDescFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setJobDescriptionFile(null);
    if (jobDescInputRef.current) {
      jobDescInputRef.current.value = '';
    }
  };
  
  const removeResumeFile = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFiles = [...resumeFiles];
    newFiles.splice(index, 1);
    setResumeFiles(newFiles);
    
    // Reset the file input if all files are removed
    if (newFiles.length === 0 && resumeInputRef.current) {
      resumeInputRef.current.value = '';
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Candidate Report Generator</h1>
      </header>
      
      <main className="App-main">
        <form onSubmit={handleSubmit} className="upload-form">
          <div className="file-inputs-container">
            {/* CSV File Upload */}
            <div 
              className={`file-input-group ${csvDragActive ? 'drag-active' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, setCsvDragActive)}
              onDragLeave={(e) => handleDragLeave(e, setCsvDragActive)}
              onDrop={(e) => handleDrop(e, 'csv', setCsvDragActive)}
              onClick={() => csvInputRef.current?.click()}
            >
              <h3>CSV File</h3>
              <div className="drop-area">
                <p>Drag & drop your CSV file here or click to browse</p>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="file-input"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {csvFile && (
                <p className="file-name">
                  {csvFile.name}
                  <span className="remove-file" onClick={removeCSVFile}></span>
                </p>
              )}
            </div>
            
            {/* Job Description Upload */}
            <div 
              className={`file-input-group ${jobDescDragActive ? 'drag-active' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, setJobDescDragActive)}
              onDragLeave={(e) => handleDragLeave(e, setJobDescDragActive)}
              onDrop={(e) => handleDrop(e, 'jobDesc', setJobDescDragActive)}
              onClick={() => jobDescInputRef.current?.click()}
            >
              <h3>Job Description</h3>
              <div className="drop-area">
                <p>Drag & drop your job description file here or click to browse</p>
                <input
                  ref={jobDescInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx"
                  onChange={(e) => setJobDescriptionFile(e.target.files?.[0] || null)}
                  className="file-input"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {jobDescriptionFile && (
                <p className="file-name">
                  {jobDescriptionFile.name}
                  <span className="remove-file" onClick={removeJobDescFile}></span>
                </p>
              )}
            </div>
            
            {/* Resumes Upload */}
            <div 
              className={`file-input-group ${resumeDragActive ? 'drag-active' : ''}`}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, setResumeDragActive)}
              onDragLeave={(e) => handleDragLeave(e, setResumeDragActive)}
              onDrop={(e) => handleDrop(e, 'resume', setResumeDragActive)}
              onClick={() => resumeInputRef.current?.click()}
            >
              <h3>Resumes</h3>
              <div className="drop-area">
                <p>Drag & drop resume files here or click to browse</p>
                <input
                  ref={resumeInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx"
                  multiple
                  onChange={(e) => setResumeFiles(Array.from(e.target.files || []))}
                  className="file-input"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              {resumeFiles.length > 0 && (
                <div className="file-names">
                  <p>{resumeFiles.length} file(s) selected:</p>
                  <ul>
                    {resumeFiles.map((file, index) => (
                      <li key={index}>
                        {file.name}
                        <span 
                          className="remove-file" 
                          onClick={(e) => removeResumeFile(index, e)}
                        ></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
          
          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading || !csvFile || !jobDescriptionFile || resumeFiles.length === 0}
          >
            {isLoading ? (
              <span className="loading-indicator">Generating Report...</span>
            ) : (
              'Generate Report'
            )}
          </button>
          
          {error && <p className="error-message">{error}</p>}
        </form>
        
        {reportHtml && (
          <div className="report-container">
            <h2>Generated Report</h2>
            <div className="report-actions">
              <CopyButton text={reportHtml} />
              <DownloadButton htmlContent={reportHtml} />
            </div>
            <div 
              className="report-content"
              dangerouslySetInnerHTML={{ __html: reportHtml }} 
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;