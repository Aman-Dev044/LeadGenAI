import { Injectable } from '@nestjs/common';

export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
}

@Injectable()
export class ChunkerService {
  private readonly defaultChunkSize = 500;
  private readonly defaultOverlap = 50;

  chunk(
    text: string,
    chunkSize = this.defaultChunkSize,
    overlap = this.defaultOverlap,
  ): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const words = text.split(/\s+/).filter((w) => w.length > 0);
    const chunks: TextChunk[] = [];
    let index = 0;
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      const chunkWords = words.slice(start, end);
      const content = chunkWords.join(' ');

      chunks.push({
        content,
        index,
        tokenCount: Math.ceil(chunkWords.length * 1.3), // rough token estimate
      });

      index++;
      start += chunkSize - overlap;

      if (start >= words.length) break;
    }

    return chunks;
  }

  chunkByParagraph(text: string, maxChunkSize = 1000): TextChunk[] {
    const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let index = 0;

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (
        currentChunk.length + trimmed.length > maxChunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push({
          content: currentChunk.trim(),
          index,
          tokenCount: Math.ceil(currentChunk.split(/\s+/).length * 1.3),
        });
        index++;
        currentChunk = trimmed;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index,
        tokenCount: Math.ceil(currentChunk.split(/\s+/).length * 1.3),
      });
    }

    return chunks;
  }
}
