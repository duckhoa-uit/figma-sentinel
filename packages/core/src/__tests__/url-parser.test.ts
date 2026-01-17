/**
 * URL Parser module unit tests
 */

import { describe, it, expect } from 'vitest';
import { parseFigmaUrl, FigmaUrlParseError } from '../url-parser.js';

describe('parseFigmaUrl', () => {
  describe('valid design URLs', () => {
    it('parses design URL with node ID', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/ABC123XYZ/My-Design-File?node-id=1:23'
      );

      expect(result.fileKey).toBe('ABC123XYZ');
      expect(result.nodeId).toBe('1:23');
    });

    it('parses design URL without node ID', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/ABC123XYZ/My-Design-File'
      );

      expect(result.fileKey).toBe('ABC123XYZ');
      expect(result.nodeId).toBeNull();
    });

    it('parses design URL without www prefix', () => {
      const result = parseFigmaUrl(
        'https://figma.com/design/DEF456/Another-File?node-id=10:20'
      );

      expect(result.fileKey).toBe('DEF456');
      expect(result.nodeId).toBe('10:20');
    });

    it('parses design URL with additional query parameters', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/XYZ789/File?node-id=5:10&t=abcd1234&mode=design'
      );

      expect(result.fileKey).toBe('XYZ789');
      expect(result.nodeId).toBe('5:10');
    });
  });

  describe('legacy file URLs', () => {
    it('parses file URL with node ID', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/file/LEGACY123/Old-File?node-id=100:200'
      );

      expect(result.fileKey).toBe('LEGACY123');
      expect(result.nodeId).toBe('100:200');
    });

    it('parses file URL without node ID', () => {
      const result = parseFigmaUrl('https://www.figma.com/file/LEGACY456/Old-File');

      expect(result.fileKey).toBe('LEGACY456');
      expect(result.nodeId).toBeNull();
    });

    it('parses file URL without www prefix', () => {
      const result = parseFigmaUrl(
        'https://figma.com/file/LEGACY789/Some-File?node-id=50:60'
      );

      expect(result.fileKey).toBe('LEGACY789');
      expect(result.nodeId).toBe('50:60');
    });
  });

  describe('URL-encoded node IDs', () => {
    it('decodes URL-encoded node ID with %3A', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/ABC123/File?node-id=1%3A23'
      );

      expect(result.nodeId).toBe('1:23');
    });

    it('decodes URL-encoded node ID with complex encoding', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/DEF456/File?node-id=100%3A200'
      );

      expect(result.nodeId).toBe('100:200');
    });

    it('handles already-decoded node IDs', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/GHI789/File?node-id=999:888'
      );

      expect(result.nodeId).toBe('999:888');
    });
  });

  describe('non-Figma URLs', () => {
    it('rejects URLs from other domains', () => {
      expect(() => parseFigmaUrl('https://google.com/design/ABC123/File')).toThrow(
        FigmaUrlParseError
      );
      expect(() => parseFigmaUrl('https://google.com/design/ABC123/File')).toThrow(
        'Not a Figma URL'
      );
    });

    it('rejects URLs with similar domain names', () => {
      expect(() => parseFigmaUrl('https://fakefigma.com/design/ABC/File')).toThrow(
        FigmaUrlParseError
      );
      expect(() => parseFigmaUrl('https://figma.fake.com/design/ABC/File')).toThrow(
        FigmaUrlParseError
      );
    });
  });

  describe('FigJam and prototype URLs', () => {
    it('rejects FigJam board URLs', () => {
      expect(() =>
        parseFigmaUrl('https://www.figma.com/board/JAM123/My-Figjam?node-id=1:2')
      ).toThrow(FigmaUrlParseError);
      expect(() =>
        parseFigmaUrl('https://www.figma.com/board/JAM123/My-Figjam')
      ).toThrow('FigJam board URLs are not supported');
    });

    it('rejects prototype URLs', () => {
      expect(() =>
        parseFigmaUrl('https://www.figma.com/proto/PROTO123/Prototype?node-id=1:2')
      ).toThrow(FigmaUrlParseError);
      expect(() =>
        parseFigmaUrl('https://www.figma.com/proto/PROTO456/Prototype')
      ).toThrow('Prototype URLs are not supported');
    });
  });

  describe('malformed URLs', () => {
    it('rejects invalid URL format', () => {
      expect(() => parseFigmaUrl('not-a-valid-url')).toThrow(FigmaUrlParseError);
      expect(() => parseFigmaUrl('not-a-valid-url')).toThrow('Invalid URL format');
    });

    it('rejects URL with missing path segments', () => {
      expect(() => parseFigmaUrl('https://www.figma.com/design')).toThrow(
        FigmaUrlParseError
      );
      expect(() => parseFigmaUrl('https://www.figma.com/design')).toThrow(
        'Invalid Figma URL path'
      );
    });

    it('rejects URL with only hostname', () => {
      expect(() => parseFigmaUrl('https://www.figma.com')).toThrow(FigmaUrlParseError);
      expect(() => parseFigmaUrl('https://www.figma.com/')).toThrow(FigmaUrlParseError);
    });

    it('rejects empty string', () => {
      expect(() => parseFigmaUrl('')).toThrow(FigmaUrlParseError);
    });

    it('rejects unsupported URL types', () => {
      expect(() =>
        parseFigmaUrl('https://www.figma.com/community/ABC123/Plugin')
      ).toThrow('Unsupported Figma URL type');
      expect(() =>
        parseFigmaUrl('https://www.figma.com/plugins/ABC123/Some-Plugin')
      ).toThrow('Unsupported Figma URL type');
    });
  });
});
