import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { config } from '../config/environment';

interface ProcessPDFOptions {
  mimeType?: string;
  location?: string;
  processorId?: string;
}

export class DocumentAIService {
  private client: DocumentProcessorServiceClient;
  private processorPath: string;

  constructor(options: ProcessPDFOptions = {}) {
    this.client = new DocumentProcessorServiceClient();
    
    const location = options.location || config.google.location;
    const processorId = options.processorId || config.google.processorId;

    this.processorPath = this.client.processorPath(
      config.google.projectId,
      location,
      processorId
    );
  }

  private async encodeToBase64(content: string): Promise<string> {
    try {
      // If content is already base64, return it
      if (this.isBase64(content)) {
        return content;
      }
      
      // Otherwise, encode it
      return Buffer.from(content).toString('base64');
    } catch (error) {
      throw new Error(`Failed to encode content to base64: ${error}`);
    }
  }

  private isBase64(str: string): boolean {
    try {
      return Buffer.from(str, 'base64').toString('base64') === str;
    } catch {
      return false;
    }
  }

  async processPDF(content: string, options: ProcessPDFOptions = {}): Promise<string> {
    try {
      // Ensure content is base64 encoded
      const encodedContent = await this.encodeToBase64(content);
      
      const request = {
        name: this.processorPath,
        document: {
          content: Buffer.from(encodedContent, 'base64'),
          mimeType: options.mimeType || 'application/pdf',
        },
      };

      const [result] = await this.client.processDocument(request);
      
      if (!result?.document?.text) {
        throw new Error('No text content extracted from PDF');
      }

      // Store metadata about the processing
      const metadata = {
        mimeType: result.document.mimeType,
        pageCount: result.document.pages?.length || 0,
        timestamp: new Date().toISOString(),
      };

      console.log('PDF Processing Metadata:', metadata);

      return result.document.text;
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error occurred while processing PDF';
      console.error('PDF Processing Error:', {
        message: errorMessage,
        details: error.details || '',
        code: error.code || '',
        timestamp: new Date().toISOString(),
      });
      
      throw new Error(`PDF processing failed: ${errorMessage}`);
    }
  }

  async processPDFs(contents: string[]): Promise<string[]> {
    try {
      // Process PDFs in batches to avoid overwhelming the API
      const batchSize = 3;
      const results: string[] = [];
      
      for (let i = 0; i < contents.length; i += batchSize) {
        const batch = contents.slice(i, i + batchSize);
        const batchPromises = batch.map(content => 
          this.processPDF(content).catch(error => {
            console.error('Error processing individual PDF:', error);
            return ''; // Return empty string for failed PDFs
          })
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
      
      // Filter out empty results and validate
      const validResults = results.filter(text => text.length > 0);
      
      if (validResults.length === 0) {
        throw new Error('No valid text extracted from any PDFs');
      }

      if (validResults.length !== contents.length) {
        console.warn(`Warning: Only ${validResults.length} out of ${contents.length} PDFs were successfully processed`);
      }

      return validResults;
    } catch (error: any) {
      throw new Error(`Batch PDF processing failed: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const documentAIService = new DocumentAIService(); 