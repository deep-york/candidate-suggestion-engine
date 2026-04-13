export interface ParsedDocument {
  rawText: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    format: string;
    filename: string;
    extractedAt: Date;
  };
}

export interface IDocumentParser {
  readonly supportedTypes: string[];
  parse(fileBuffer: Buffer, filename: string): Promise<ParsedDocument>;
}

export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedFormatError';
  }
}
