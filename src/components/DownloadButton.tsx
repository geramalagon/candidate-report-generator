import React from 'react';
import html2pdf from 'html2pdf.js';

interface DownloadButtonProps {
  htmlContent: string;
  filename?: string;
}

const DownloadButton: React.FC<DownloadButtonProps> = ({ 
  htmlContent, 
  filename = 'candidate-report.pdf' 
}) => {
  const handleDownload = () => {
    // Create a temporary div to hold the HTML content
    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    
    // Apply additional styling to fix formatting issues
    element.style.width = '210mm'; // A4 width
    element.style.wordBreak = 'normal';
    element.style.wordWrap = 'break-word';
    element.style.whiteSpace = 'normal';
    
    // Add spacing between elements
    const paragraphs = element.querySelectorAll('p');
    paragraphs.forEach(p => {
      p.style.margin = '0.5em 0';
      p.style.lineHeight = '1.5';
    });
    
    // Ensure proper spacing between list items
    const listItems = element.querySelectorAll('li');
    listItems.forEach(li => {
      li.style.margin = '0.25em 0';
    });
    
    // Add the element to the document body
    document.body.appendChild(element);
    
    // Configure the PDF options with improved settings
    const options = {
      margin: 15, // Margin in mm (using a single number for all sides)
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, // Higher scale for better quality
        useCORS: true, // Enable CORS for images
        letterRendering: true, // Improve text rendering
        logging: false // Disable logging
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait' as 'portrait',
        compress: true, // Compress the PDF
        precision: 16 // Higher precision for better text rendering
      },
      fontFaces: [
        {
          family: 'Arial',
          style: 'normal'
        }
      ]
    };
    
    // Generate the PDF with a slight delay to ensure proper rendering
    setTimeout(() => {
      html2pdf()
        .set(options)
        .from(element)
        .save()
        .then(() => {
          // Remove the temporary element
          document.body.removeChild(element);
        })
        .catch(error => {
          console.error('Error generating PDF:', error);
          document.body.removeChild(element);
        });
    }, 100);
  };

  return (
    <button 
      onClick={handleDownload}
      className="download-button"
      title="Download as PDF"
    >
      Download PDF
    </button>
  );
};

export default DownloadButton; 