import pdfParse from 'pdf-parse';
import type { IDocumentParser, ParsedDocument } from './base.parser.js';

export class PdfParser implements IDocumentParser {
  readonly supportedTypes = ['application/pdf', '.pdf'];

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    const result = await pdfParse(fileBuffer);
    const rawText = result.text.trim();
    return {
      rawText,
      metadata: {
        pageCount: result.numpages,
        wordCount: rawText.split(/\s+/).filter(Boolean).length,
        format: 'pdf',
        filename,
        extractedAt: new Date(),
      },
    };
  }
}
