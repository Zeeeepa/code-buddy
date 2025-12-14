/**
 * Tests for exit-codes utility
 */

import {
  EXIT_CODES,
  getExitCodeDescription,
  exitWithCode,
  errorToExitCode,
  handleFatalError,
} from '../../src/utils/exit-codes.js';

describe('Exit Codes', () => {
  describe('EXIT_CODES', () => {
    it('should have SUCCESS as 0', () => {
      expect(EXIT_CODES.SUCCESS).toBe(0);
    });

    it('should have GENERAL_ERROR as 1', () => {
      expect(EXIT_CODES.GENERAL_ERROR).toBe(1);
    });

    it('should have INVALID_USAGE as 2', () => {
      expect(EXIT_CODES.INVALID_USAGE).toBe(2);
    });

    it('should have API_ERROR', () => {
      expect(EXIT_CODES.API_ERROR).toBeDefined();
      expect(typeof EXIT_CODES.API_ERROR).toBe('number');
    });

    it('should have TIMEOUT', () => {
      expect(EXIT_CODES.TIMEOUT).toBeDefined();
    });

    it('should have all expected codes', () => {
      expect(EXIT_CODES.AUTHENTICATION_ERROR).toBeDefined();
      expect(EXIT_CODES.FILE_NOT_FOUND).toBeDefined();
      expect(EXIT_CODES.PERMISSION_DENIED).toBeDefined();
      expect(EXIT_CODES.NETWORK_ERROR).toBeDefined();
      expect(EXIT_CODES.USER_CANCELLED).toBe(130);
    });
  });

  describe('getExitCodeDescription', () => {
    it('should return description for SUCCESS', () => {
      const desc = getExitCodeDescription(EXIT_CODES.SUCCESS);
      expect(desc.toLowerCase()).toContain('success');
    });

    it('should return description for GENERAL_ERROR', () => {
      const desc = getExitCodeDescription(EXIT_CODES.GENERAL_ERROR);
      expect(desc.toLowerCase()).toContain('error');
    });

    it('should return unknown for invalid code', () => {
      const desc = getExitCodeDescription(999);
      expect(desc.toLowerCase()).toContain('unknown');
    });

    it('should return description for API_ERROR', () => {
      const desc = getExitCodeDescription(EXIT_CODES.API_ERROR);
      expect(desc.toLowerCase()).toContain('api');
    });
  });

  describe('errorToExitCode', () => {
    it('should return AUTHENTICATION_ERROR for auth errors', () => {
      const error = new Error('Invalid API key');
      expect(errorToExitCode(error)).toBe(EXIT_CODES.AUTHENTICATION_ERROR);
    });

    it('should return API_ERROR for rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      expect(errorToExitCode(error)).toBe(EXIT_CODES.API_ERROR);
    });

    it('should return TIMEOUT for timeout errors', () => {
      const error = new Error('Operation timed out');
      expect(errorToExitCode(error)).toBe(EXIT_CODES.TIMEOUT);
    });

    it('should return FILE_NOT_FOUND for enoent errors', () => {
      const error = new Error('ENOENT: no such file');
      expect(errorToExitCode(error)).toBe(EXIT_CODES.FILE_NOT_FOUND);
    });

    it('should return NETWORK_ERROR for network errors', () => {
      const error = new Error('Network connection failed');
      expect(errorToExitCode(error)).toBe(EXIT_CODES.NETWORK_ERROR);
    });

    it('should return GENERAL_ERROR for unknown errors', () => {
      const error = new Error('Something went wrong');
      expect(errorToExitCode(error)).toBe(EXIT_CODES.GENERAL_ERROR);
    });
  });

  describe('exitWithCode', () => {
    let originalExit: typeof process.exit;
    let exitCode: number | undefined;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      originalExit = process.exit;
      exitCode = undefined;
      process.exit = jest.fn((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      process.exit = originalExit;
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should call process.exit with SUCCESS code', () => {
      expect(() => exitWithCode(EXIT_CODES.SUCCESS)).toThrow('process.exit called');
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it('should call process.exit with GENERAL_ERROR code', () => {
      expect(() => exitWithCode(EXIT_CODES.GENERAL_ERROR)).toThrow('process.exit called');
      expect(exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    });

    it('should log message for success', () => {
      expect(() => exitWithCode(EXIT_CODES.SUCCESS, 'Done!')).toThrow('process.exit called');
      expect(consoleLogSpy).toHaveBeenCalledWith('Done!');
    });

    it('should error message for errors', () => {
      expect(() => exitWithCode(EXIT_CODES.GENERAL_ERROR, 'Failed!')).toThrow('process.exit called');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed!');
    });
  });

  describe('handleFatalError', () => {
    let originalExit: typeof process.exit;
    let exitCode: number | undefined;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      originalExit = process.exit;
      exitCode = undefined;
      process.exit = jest.fn((code?: number) => {
        exitCode = code;
        throw new Error('process.exit called');
      }) as never;
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      process.exit = originalExit;
      consoleErrorSpy.mockRestore();
    });

    it('should handle fatal errors and exit', () => {
      const error = new Error('Fatal error occurred');
      expect(() => handleFatalError(error)).toThrow('process.exit called');
      expect(exitCode).toBe(EXIT_CODES.GENERAL_ERROR);
    });

    it('should map authentication errors correctly', () => {
      const error = new Error('Invalid API key');
      expect(() => handleFatalError(error)).toThrow('process.exit called');
      expect(exitCode).toBe(EXIT_CODES.AUTHENTICATION_ERROR);
    });

    it('should output error description', () => {
      const error = new Error('Connection failed');
      expect(() => handleFatalError(error)).toThrow('process.exit called');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
