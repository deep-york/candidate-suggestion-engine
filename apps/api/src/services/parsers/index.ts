import type { IDocumentParser } from './base.parser.js';
import { UnsupportedFormatError } from './base.parser.js';
import { PdfParser } from './pdf.parser.js';
import { DocxParser } from './docx.parser.js';

class ParserRegistry {
  private readonly parsers = new Map<string, IDocumentParser>();

  register(parser: IDocumentParser): void {
    for (const type of parser.supportedTypes) {
      this.parsers.set(type.toLowerCase(), parser);
    }
  }

  getParser(mimeType: string, extension: string): IDocumentParser {
    const parser =
      this.parsers.get(mimeType.toLowerCase()) ??
      this.parsers.get(extension.toLowerCase());

    if (!parser) {
      throw new UnsupportedFormatError(
        `No parser registered for MIME "${mimeType}" or extension "${extension}". ` +
          `Supported: ${[...this.parsers.keys()].join(', ')}`,
      );
    }

    return parser;
  }

  getSupportedMimeTypes(): string[] {
    return [...this.parsers.keys()];
  }
}

export const parserRegistry = new ParserRegistry();

// Register built-in parsers
parserRegistry.register(new PdfParser());
parserRegistry.register(new DocxParser());

// Future parsers can be registered here without touching the pipeline:
// parserRegistry.register(new TxtParser());
// parserRegistry.register(new HtmlParser());
