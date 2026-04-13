import mammoth from 'mammoth';
import type { IDocumentParser, ParsedDocument } from './base.parser.js';

export class DocxParser implements IDocumentParser {
  readonly supportedTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.docx',
    '.doc',
  ];

  async parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument> {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const rawText = result.value.trim();
    return {
      rawText,
      metadata: {
        wordCount: rawText.split(/\s+/).filter(Boolean).length,
        format: 'docx',
        filename,
        extractedAt: new Date(),
      },
    };
  }
}
