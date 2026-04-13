import { createWorker, Worker } from 'tesseract.js';

/**
 * OCR Service using Tesseract.js (client-side)
 * Runs in the browser - completely free and private
 */

export interface OCRResult {
  text: string;
  confidence: number;
  fields?: Record<string, any>;
}

class OCRService {
  private worker: Worker | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });
      this.initialized = true;
      console.log('✅ OCR initialized');
    } catch (error) {
      console.error('Failed to initialize OCR:', error);
      throw error;
    }
  }

  async processDocument(file: File): Promise<OCRResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }

    try {
      const { data } = await this.worker.recognize(file);

      return {
        text: data.text,
        confidence: data.confidence,
      };
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw error;
    }
  }

  async extractDocumentFields(
    file: File,
    documentType: string
  ): Promise<OCRResult> {
    const ocrResult = await this.processDocument(file);

    // Parse fields based on document type
    let fields: Record<string, any> = {};

    switch (documentType) {
      case 'passport':
        fields = this.parsePassport(ocrResult.text);
        break;
      case 'driving_license':
        fields = this.parseDrivingLicense(ocrResult.text);
        break;
      default:
        fields = { raw_text: ocrResult.text };
    }

    return {
      ...ocrResult,
      fields,
    };
  }

  private parsePassport(text: string): Record<string, any> {
    const patterns = {
      passportNumber: /(?:Passport\s+No\.?|P\s*<)\s*([A-Z0-9]{6,9})/i,
      surname: /Surname[:\s]+([A-Z\s]+)/i,
      givenNames: /Given\s+Names?[:\s]+([A-Z\s]+)/i,
      dateOfBirth: /(?:Date\s+of\s+)?Birth[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
      nationality: /Nationality[:\s]+([A-Z\s]+)/i,
      expiryDate: /(?:Date\s+of\s+)?Expir(?:y|ation)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
      issueDate: /(?:Date\s+of\s+)?Issue[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    };

    const fields: Record<string, any> = { raw_text: text };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        fields[key] = match[1].trim();
      }
    }

    return fields;
  }

  private parseDrivingLicense(text: string): Record<string, any> {
    const patterns = {
      licenseNumber: /(?:License|DL)\s+(?:No\.?|Number)[:\s]+([A-Z0-9\-]+)/i,
      name: /(?:Name|Full\s+Name)[:\s]+([A-Z\s]+)/i,
      address: /(?:Address)[:\s]+([A-Z0-9\s,]+)/i,
      dateOfBirth: /(?:DOB|Date\s+of\s+Birth)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
      expiryDate: /(?:Expir(?:y|ation)|Valid\s+Until)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
      issueDate: /(?:Issue\s+Date)[:\s]+(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
    };

    const fields: Record<string, any> = { raw_text: text };

    for (const [key, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        fields[key] = match[1].trim();
      }
    }

    return fields;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initialized = false;
      console.log('✅ OCR worker terminated');
    }
  }
}

export const ocrService = new OCRService();
