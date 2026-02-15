/**
 * Image Analysis Stub Tool
 *
 * Provides image analysis capabilities as stubs for future
 * integration with vision models and image processing libraries.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ImageAnalysisResult {
  description: string;
  labels: string[];
  dimensions?: { width: number; height: number };
  format?: string;
  size?: number;
}

// ============================================================================
// ImageStubTool
// ============================================================================

const SUPPORTED_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];

export class ImageStubTool {
  private static instance: ImageStubTool | null = null;

  constructor() {}

  static getInstance(): ImageStubTool {
    if (!ImageStubTool.instance) {
      ImageStubTool.instance = new ImageStubTool();
    }
    return ImageStubTool.instance;
  }

  static resetInstance(): void {
    ImageStubTool.instance = null;
  }

  analyze(imagePath: string): ImageAnalysisResult {
    if (!this.isValidImage(imagePath)) {
      throw new Error(`Unsupported image format: ${path.extname(imagePath)}`);
    }

    let size: number | undefined;
    try {
      const stat = fs.statSync(imagePath);
      size = stat.size;
    } catch {
      // File may not exist in stub mode
    }

    const ext = path.extname(imagePath).toLowerCase().replace('.', '');
    const format = ext === 'jpg' ? 'jpeg' : ext;

    logger.debug('Image analyzed', { imagePath, format });

    return {
      description: `Image analysis of ${path.basename(imagePath)}`,
      labels: ['image', format],
      format,
      size,
    };
  }

  analyzeUrl(url: string): ImageAnalysisResult {
    logger.debug('Analyzing image URL', { url });

    // Extract format from URL
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath).toLowerCase().replace('.', '') || 'unknown';

    return {
      description: `Image analysis of ${url}`,
      labels: ['image', 'url', ext],
      format: ext !== 'unknown' ? ext : undefined,
    };
  }

  compare(path1: string, path2: string): { similarity: number; description: string } {
    if (!this.isValidImage(path1)) {
      throw new Error(`Unsupported image format: ${path.extname(path1)}`);
    }
    if (!this.isValidImage(path2)) {
      throw new Error(`Unsupported image format: ${path.extname(path2)}`);
    }

    logger.debug('Comparing images', { path1, path2 });

    return {
      similarity: 0.85,
      description: `Comparison between ${path.basename(path1)} and ${path.basename(path2)}`,
    };
  }

  extractText(imagePath: string): string {
    if (!this.isValidImage(imagePath)) {
      throw new Error(`Unsupported image format: ${path.extname(imagePath)}`);
    }

    logger.debug('OCR extraction', { imagePath });
    return `[OCR placeholder for ${path.basename(imagePath)}]`;
  }

  resize(imagePath: string, width: number, height: number): string {
    if (!this.isValidImage(imagePath)) {
      throw new Error(`Unsupported image format: ${path.extname(imagePath)}`);
    }

    logger.debug('Resize image', { imagePath, width, height });
    const ext = path.extname(imagePath);
    const base = path.basename(imagePath, ext);
    const dir = path.dirname(imagePath);
    return path.join(dir, `${base}-${width}x${height}${ext}`);
  }

  getSupportedFormats(): string[] {
    return [...SUPPORTED_FORMATS];
  }

  isValidImage(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase().replace('.', '');
    return SUPPORTED_FORMATS.includes(ext);
  }
}
