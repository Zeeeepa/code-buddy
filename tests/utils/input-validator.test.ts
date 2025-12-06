import {
  validateString,
  validateStringLength,
  validatePattern,
  validateNumber,
  validateNumberRange,
  validatePositiveInteger,
  validateArray,
  validateObject,
  validateChoice,
  validateBoolean,
  validateUrl,
  validateEmail,
  validateFilePath,
  validateOptional,
  validateWithDefault,
  validateSchema,
  assertValid,
  assertString,
  assertNumber,
} from '../../src/utils/input-validator';

describe('String Validators', () => {
  describe('validateString', () => {
    it('should accept valid strings', () => {
      const result = validateString('hello');
      expect(result.valid).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('should reject null', () => {
      const result = validateString(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject undefined', () => {
      const result = validateString(undefined);
      expect(result.valid).toBe(false);
    });

    it('should reject non-strings', () => {
      const result = validateString(123);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should reject empty strings by default', () => {
      const result = validateString('  ');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should allow empty strings when configured', () => {
      const result = validateString('', { allowEmpty: true });
      expect(result.valid).toBe(true);
    });

    it('should use custom field name in error', () => {
      const result = validateString(null, { fieldName: 'username' });
      expect(result.error).toContain('username');
    });

    it('should use custom error message', () => {
      const result = validateString(null, { customError: 'Custom error' });
      expect(result.error).toBe('Custom error');
    });
  });

  describe('validateStringLength', () => {
    it('should accept strings within range', () => {
      const result = validateStringLength('hello', 1, 10);
      expect(result.valid).toBe(true);
    });

    it('should reject strings too short', () => {
      const result = validateStringLength('hi', 5, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 5');
    });

    it('should reject strings too long', () => {
      const result = validateStringLength('hello world', 1, 5);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most 5');
    });
  });

  describe('validatePattern', () => {
    it('should accept matching strings', () => {
      const result = validatePattern('abc123', /^[a-z]+\d+$/);
      expect(result.valid).toBe(true);
    });

    it('should reject non-matching strings', () => {
      const result = validatePattern('abc', /^\d+$/);
      expect(result.valid).toBe(false);
    });

    it('should include pattern description in error', () => {
      const result = validatePattern('abc', /^\d+$/, {
        patternDescription: 'numbers only',
      });
      expect(result.error).toContain('numbers only');
    });
  });
});

describe('Number Validators', () => {
  describe('validateNumber', () => {
    it('should accept valid numbers', () => {
      const result = validateNumber(42);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should accept numeric strings', () => {
      const result = validateNumber('3.14');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(3.14);
    });

    it('should reject NaN', () => {
      const result = validateNumber(NaN);
      expect(result.valid).toBe(false);
    });

    it('should reject non-numeric strings', () => {
      const result = validateNumber('abc');
      expect(result.valid).toBe(false);
    });

    it('should reject null', () => {
      const result = validateNumber(null);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateNumberRange', () => {
    it('should accept numbers within range', () => {
      const result = validateNumberRange(5, 1, 10);
      expect(result.valid).toBe(true);
    });

    it('should reject numbers below range', () => {
      const result = validateNumberRange(0, 1, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('between 1 and 10');
    });

    it('should reject numbers above range', () => {
      const result = validateNumberRange(11, 1, 10);
      expect(result.valid).toBe(false);
    });

    it('should accept boundary values', () => {
      expect(validateNumberRange(1, 1, 10).valid).toBe(true);
      expect(validateNumberRange(10, 1, 10).valid).toBe(true);
    });
  });

  describe('validatePositiveInteger', () => {
    it('should accept positive integers', () => {
      const result = validatePositiveInteger(42);
      expect(result.valid).toBe(true);
    });

    it('should reject zero', () => {
      const result = validatePositiveInteger(0);
      expect(result.valid).toBe(false);
    });

    it('should reject negative numbers', () => {
      const result = validatePositiveInteger(-1);
      expect(result.valid).toBe(false);
    });

    it('should reject floats', () => {
      const result = validatePositiveInteger(3.14);
      expect(result.valid).toBe(false);
    });
  });
});

describe('Array Validators', () => {
  describe('validateArray', () => {
    it('should accept arrays', () => {
      const result = validateArray([1, 2, 3]);
      expect(result.valid).toBe(true);
      expect(result.value).toEqual([1, 2, 3]);
    });

    it('should accept empty arrays', () => {
      const result = validateArray([]);
      expect(result.valid).toBe(true);
    });

    it('should reject non-arrays', () => {
      const result = validateArray('not an array');
      expect(result.valid).toBe(false);
    });

    it('should reject null', () => {
      const result = validateArray(null);
      expect(result.valid).toBe(false);
    });

    it('should validate minimum length', () => {
      const result = validateArray([1], { minLength: 2 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 2');
    });

    it('should validate maximum length', () => {
      const result = validateArray([1, 2, 3, 4], { maxLength: 3 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at most 3');
    });
  });
});

describe('Object Validators', () => {
  describe('validateObject', () => {
    it('should accept objects', () => {
      const result = validateObject({ a: 1 });
      expect(result.valid).toBe(true);
    });

    it('should accept empty objects', () => {
      const result = validateObject({});
      expect(result.valid).toBe(true);
    });

    it('should reject arrays', () => {
      const result = validateObject([]);
      expect(result.valid).toBe(false);
    });

    it('should reject null', () => {
      const result = validateObject(null);
      expect(result.valid).toBe(false);
    });

    it('should reject primitives', () => {
      expect(validateObject('string').valid).toBe(false);
      expect(validateObject(123).valid).toBe(false);
    });
  });
});

describe('Choice Validators', () => {
  describe('validateChoice', () => {
    const choices = ['red', 'green', 'blue'] as const;

    it('should accept valid choices', () => {
      const result = validateChoice('red', choices);
      expect(result.valid).toBe(true);
      expect(result.value).toBe('red');
    });

    it('should reject invalid choices', () => {
      const result = validateChoice('yellow', choices);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('red, green, blue');
    });
  });
});

describe('Boolean Validators', () => {
  describe('validateBoolean', () => {
    it('should accept true', () => {
      const result = validateBoolean(true);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should accept false', () => {
      const result = validateBoolean(false);
      expect(result.valid).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should parse string "true"', () => {
      const result = validateBoolean('true');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(true);
    });

    it('should parse string "false"', () => {
      const result = validateBoolean('false');
      expect(result.valid).toBe(true);
      expect(result.value).toBe(false);
    });

    it('should parse string "yes"/"no"', () => {
      expect(validateBoolean('yes').value).toBe(true);
      expect(validateBoolean('no').value).toBe(false);
    });

    it('should parse numbers', () => {
      expect(validateBoolean(1).value).toBe(true);
      expect(validateBoolean(0).value).toBe(false);
    });

    it('should reject invalid strings', () => {
      const result = validateBoolean('maybe');
      expect(result.valid).toBe(false);
    });
  });
});

describe('Special Validators', () => {
  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      const result = validateUrl('https://example.com');
      expect(result.valid).toBe(true);
    });

    it('should accept http URLs', () => {
      const result = validateUrl('http://example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const result = validateUrl('not-a-url');
      expect(result.valid).toBe(false);
    });

    it('should reject disallowed protocols', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.valid).toBe(false);
    });

    it('should allow custom protocols', () => {
      const result = validateUrl('ftp://example.com', { protocols: ['ftp:'] });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      const result = validateEmail('user@example.com');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(validateEmail('not-an-email').valid).toBe(false);
      expect(validateEmail('missing@domain').valid).toBe(false);
      expect(validateEmail('@example.com').valid).toBe(false);
    });
  });

  describe('validateFilePath', () => {
    it('should accept valid paths', () => {
      const result = validateFilePath('/home/user/file.txt');
      expect(result.valid).toBe(true);
    });

    it('should reject paths with null bytes', () => {
      const result = validateFilePath('/path/to\0/file');
      expect(result.valid).toBe(false);
    });

    it('should require absolute paths when configured', () => {
      const result = validateFilePath('relative/path', { mustBeAbsolute: true });
      expect(result.valid).toBe(false);
    });

    it('should accept absolute paths when required', () => {
      const result = validateFilePath('/absolute/path', { mustBeAbsolute: true });
      expect(result.valid).toBe(true);
    });
  });
});

describe('Composite Validators', () => {
  describe('validateOptional', () => {
    it('should return undefined for missing values', () => {
      const result = validateOptional(undefined, validateString);
      expect(result.valid).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should validate present values', () => {
      const result = validateOptional('hello', validateString);
      expect(result.valid).toBe(true);
      expect(result.value).toBe('hello');
    });

    it('should return error for invalid present values', () => {
      const result = validateOptional(123, validateString);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateWithDefault', () => {
    it('should use default for missing values', () => {
      const result = validateWithDefault(undefined, 'default', validateString);
      expect(result.valid).toBe(true);
      expect(result.value).toBe('default');
    });

    it('should use provided value when present', () => {
      const result = validateWithDefault('provided', 'default', validateString);
      expect(result.valid).toBe(true);
      expect(result.value).toBe('provided');
    });
  });
});

describe('Schema Validation', () => {
  describe('validateSchema', () => {
    const userSchema = {
      name: { validator: validateString, required: true },
      age: { validator: validatePositiveInteger, required: true },
      email: { validator: validateEmail, required: false },
      role: { validator: validateString, default: 'user' },
    };

    it('should validate valid objects', () => {
      const result = validateSchema(
        { name: 'John', age: 30, email: 'john@example.com' },
        userSchema
      );
      expect(result.valid).toBe(true);
      expect(result.value).toEqual({
        name: 'John',
        age: 30,
        email: 'john@example.com',
        role: 'user',
      });
    });

    it('should apply defaults', () => {
      const result = validateSchema({ name: 'John', age: 30 }, userSchema);
      expect(result.valid).toBe(true);
      expect(result.value?.role).toBe('user');
    });

    it('should reject missing required fields', () => {
      const result = validateSchema({ name: 'John' }, userSchema);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('age');
    });

    it('should reject unknown fields in strict mode', () => {
      const result = validateSchema(
        { name: 'John', age: 30, unknown: 'field' },
        userSchema,
        { strict: true }
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown field');
    });

    it('should allow unknown fields by default', () => {
      const result = validateSchema(
        { name: 'John', age: 30, unknown: 'field' },
        userSchema
      );
      expect(result.valid).toBe(true);
    });
  });
});

describe('Assertion Helpers', () => {
  describe('assertValid', () => {
    it('should return value for valid results', () => {
      const result = { valid: true, value: 'hello' } as const;
      expect(assertValid(result)).toBe('hello');
    });

    it('should throw for invalid results', () => {
      const result = { valid: false, error: 'Test error' } as const;
      expect(() => assertValid(result)).toThrow('Test error');
    });

    it('should include context in error', () => {
      const result = { valid: false, error: 'Test error' } as const;
      expect(() => assertValid(result, 'Processing user')).toThrow(
        'Processing user: Test error'
      );
    });
  });

  describe('assertString', () => {
    it('should return value for valid strings', () => {
      expect(assertString('hello')).toBe('hello');
    });

    it('should throw for invalid values', () => {
      expect(() => assertString(123)).toThrow();
    });
  });

  describe('assertNumber', () => {
    it('should return value for valid numbers', () => {
      expect(assertNumber(42)).toBe(42);
    });

    it('should throw for invalid values', () => {
      expect(() => assertNumber('not a number')).toThrow();
    });
  });
});
