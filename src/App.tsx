import React, { useState } from 'react';
import { Upload, FileText, Briefcase, Users, AlertCircle, X, Loader2, Table, CheckCircle2 } from 'lucide-react';
import { generateCandidateReport } from './lib/anthropic';

console.log('App component loaded')

interface FileUpload {
  file: File;
  type: 'csv' | 'job-description' | 'resume';
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  content?: string;
}

interface ApiError {
  message: string;
  code?: string;
}

function App(): JSX.Element {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: 'csv' | 'job-description' | 'resume') => {
    const newFiles = Array.from(event.target.files || []).map(file => ({
      file,
      type,
      status: 'pending' as const
    }));

    // Remove existing files of the same type (except for resumes)
    if (type !== 'resume') {
      setFiles(prev => prev.filter(f => f.type !== type));
    }

    // Read file contents
    const filesWithContent = await Promise.all(
      newFiles.map(async (fileUpload) => {
        try {
          const content = await fileUpload.file.text();
          return { ...fileUpload, content, status: 'success' as const };
        } catch (error) {
          return {
            ...fileUpload,
            status: 'error' as const,
            error: 'Failed to read file content'
          };
        }
      })
    );

    setFiles(prev => [...prev, ...filesWithContent]);
    setApiError(null);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    // Clear report if files are removed
    setReportHtml(null);
    setApiError(null);
  };

  const validateFiles = () => {
    const csvFile = files.find(f => f.type === 'csv');
    const jobDescription = files.find(f => f.type === 'job-description');
    const resumes = files.filter(f => f.type === 'resume');

    if (!csvFile) {
      throw new Error('Please upload a CSV report');
    }
    if (!jobDescription) {
      throw new Error('Please upload a job description');
    }
    if (resumes.length === 0) {
      throw new Error('Please upload at least one candidate resume');
    }

    // Validate file contents
    if (!csvFile.content) {
      throw new Error('Failed to read CSV file content');
    }
    if (!jobDescription.content) {
      throw new Error('Failed to read job description content');
    }
    if (resumes.some(r => !r.content)) {
      throw new Error('Failed to read one or more resume contents');
    }

    return {
      csvContent: csvFile.content,
      jobDescriptionContent: jobDescription.content,
      resumeContents: resumes.map(r => r.content!),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setApiError(null);
    setReportHtml(null);

    try {
      const { csvContent, jobDescriptionContent, resumeContents } = validateFiles();
      
      // Update file statuses to uploading
      setFiles(prev => prev.map(file => ({ ...file, status: 'uploading' as const })));

      // Generate report using Anthropic API
      const report = await generateCandidateReport(
        csvContent,
        jobDescriptionContent,
        resumeContents
      );

      setReportHtml(report);
      setFiles(prev => prev.map(file => ({ ...file, status: 'success' as const })));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setApiError({
        message: errorMessage,
        code: (error as any).code
      });
      setFiles(prev => prev.map(file => ({ 
        ...file, 
        status: 'error' as const,
        error: errorMessage
      })));
    } finally {
      setIsProcessing(false);
    }
  };

  const renderFileList = (type: 'csv' | 'job-description' | 'resume') => {
    const filteredFiles = files.filter(file => file.type === type);
    if (filteredFiles.length === 0) return null;

    const titles = {
      csv: 'CSV Report',
      'job-description': 'Job Description',
      resume: 'Candidate Resumes'
    };

    const icons = {
      csv: Table,
      'job-description': Briefcase,
      resume: FileText
    };

    const Icon = icons[type];

    return (
      <div className="mb-4 last:mb-0">
        <div className="flex items-center space-x-2 mb-2">
          <Icon className="h-4 w-4 text-blue-600" />
          <h4 className="text-sm font-medium text-gray-700">{titles[type]}</h4>
        </div>
        <ul className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {filteredFiles.map((file, index) => (
            <li key={index} className="p-3 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center flex-1 min-w-0 mr-4">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-900 truncate block">
                    {file.file.name}
                  </span>
                  {file.error && (
                    <span className="text-xs text-red-600">{file.error}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">
                  {(file.file.size / 1024 / 1024).toFixed(2)} MB
                </span>
                {file.status === 'uploading' ? (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                ) : file.status === 'success' ? (
                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                ) : file.status === 'error' ? (
                  <div className="h-2 w-2 bg-red-500 rounded-full" />
                ) : (
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const hasFileOfType = (type: 'csv' | 'job-description' | 'resume') => {
    return files.some(file => file.type === type);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">TalentHQ</h1>
                <p className="text-sm text-gray-500">Candidate Report Generator</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* API Error Display */}
            {apiError && (
              <div className="rounded-lg bg-red-50 p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">
                      Error Processing Request
                    </h3>
                    <div className="mt-1 text-sm text-red-700">
                      <p>{apiError.message}</p>
                      {apiError.code && (
                        <p className="mt-1 text-xs font-mono">Error Code: {apiError.code}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CSV Upload Section */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Table className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-medium text-gray-900">CSV Report</h2>
                </div>
                {hasFileOfType('csv') && (
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="h-5 w-5 mr-1" />
                    <span className="text-sm font-medium">File uploaded</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">CSV file only</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={(e) => handleFileChange(e, 'csv')}
                  />
                </label>
              </div>
            </div>

            {/* Job Description Upload Section */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-medium text-gray-900">Job Description</h2>
                </div>
                {hasFileOfType('job-description') && (
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="h-5 w-5 mr-1" />
                    <span className="text-sm font-medium">File uploaded</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Upload Job Description</span>
                    </p>
                    <p className="text-xs text-gray-500">PDF file only</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf"
                    onChange={(e) => handleFileChange(e, 'job-description')}
                  />
                </label>
              </div>
            </div>

            {/* Candidate Resumes Upload Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-medium text-gray-900">Candidate Resumes</h2>
                </div>
                {hasFileOfType('resume') && (
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="h-5 w-5 mr-1" />
                    <span className="text-sm font-medium">Files uploaded</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-3 text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500">
                      <span className="font-semibold">Upload Candidate Resumes</span>
                    </p>
                    <p className="text-xs text-gray-500">Multiple PDF files allowed (3-5 recommended)</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf"
                    multiple
                    onChange={(e) => handleFileChange(e, 'resume')}
                  />
                </label>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Files</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  {renderFileList('csv')}
                  {renderFileList('job-description')}
                  {renderFileList('resume')}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isProcessing || files.length === 0}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                    Processing Files...
                  </>
                ) : (
                  'Generate Report'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Report Display */}
        {reportHtml && (
          <div className="mt-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div 
                className="prose prose-blue max-w-none"
                dangerouslySetInnerHTML={{ __html: reportHtml }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;