import { describe, it, expect } from 'vitest';
import { classifyQuery, getInjectionLevel } from '../../src/agent/execution/query-classifier.js';
import type { QueryComplexity } from '../../src/agent/execution/query-classifier.js';

describe('Query Classifier', () => {
  describe('trivial messages', () => {
    const trivialMessages = [
      'hello', 'hi', 'hey', 'howdy', 'yo', 'sup',
      'bonjour', 'salut', 'coucou', 'bonsoir',
      'hola', 'ciao',
      'Hello!', 'Hi!', 'Hey!',
      'good morning', 'good afternoon', 'good evening',
      'thanks', 'thank you', 'merci', 'thx', 'ty', 'cheers',
      'parfait', 'excellent', 'super', 'cool', 'nice', 'great', 'awesome',
      'yes', 'yeah', 'yep', 'yup', 'no', 'nope', 'nah',
      'ok', 'okay', 'oui', 'non', 'sure',
      "d'accord", "c'est bon", 'ça marche', 'go', 'do it',
      'vas-y', 'allez', 'je valide',
      'bye', 'goodbye', 'au revoir', 'à plus', 'à bientôt', 'ciao',
      '👍', '🎉', '✅', '👋',
    ];

    it.each(trivialMessages)('classifies "%s" as trivial', (msg) => {
      const result = classifyQuery(msg);
      expect(result.complexity).toBe('trivial');
    });

    it('disables all context injection for trivial messages', () => {
      const { injection } = classifyQuery('bonjour');
      expect(injection.workspace).toBe(false);
      expect(injection.lessons).toBe(false);
      expect(injection.knowledgeGraph).toBe(false);
      expect(injection.decisionMemory).toBe(false);
      expect(injection.icmMemory).toBe(false);
      expect(injection.codeGraph).toBe(false);
      expect(injection.docs).toBe(false);
      expect(injection.todo).toBe(false);
    });
  });

  describe('simple messages', () => {
    const simpleMessages = [
      'what time is it',
      'how are you',
      'tell me about yourself',
      'what is this project',
      "c'est quoi ce projet",
      'show me the version',
    ];

    it.each(simpleMessages)('classifies "%s" as simple', (msg) => {
      const result = classifyQuery(msg);
      expect(result.complexity).toBe('simple');
    });

    it('enables only lessons, knowledge graph, and todo for simple messages', () => {
      const { injection } = classifyQuery('what time is it');
      expect(injection.workspace).toBe(false);
      expect(injection.lessons).toBe(true);
      expect(injection.knowledgeGraph).toBe(true);
      expect(injection.decisionMemory).toBe(false);
      expect(injection.icmMemory).toBe(false);
      expect(injection.codeGraph).toBe(false);
      expect(injection.docs).toBe(false);
      expect(injection.todo).toBe(true);
    });
  });

  describe('complex messages', () => {
    const complexMessages = [
      'fix the bug in the login function',
      'implement a new authentication system',
      'refactor the database module and then update the tests',
      'create a new API endpoint for user management',
      'debug the error in the deployment pipeline',
      'add error handling to the file upload component',
      'write tests for the user service',
      'update the configuration to support the new provider',
      'fix the build error and also update the README',
      'migrate the database schema to support multi-tenancy',
    ];

    it.each(complexMessages)('classifies "%s" as complex', (msg) => {
      const result = classifyQuery(msg);
      expect(result.complexity).toBe('complex');
    });

    it('enables all context injection for complex messages', () => {
      const { injection } = classifyQuery('fix the bug in the authentication module');
      expect(injection.workspace).toBe(true);
      expect(injection.lessons).toBe(true);
      expect(injection.knowledgeGraph).toBe(true);
      expect(injection.decisionMemory).toBe(true);
      expect(injection.icmMemory).toBe(true);
      expect(injection.codeGraph).toBe(true);
      expect(injection.docs).toBe(true);
      expect(injection.todo).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('classifies empty string as trivial', () => {
      expect(classifyQuery('').complexity).toBe('trivial');
    });

    it('classifies single character as trivial', () => {
      expect(classifyQuery('?').complexity).toBe('trivial');
    });

    it('classifies multi-action phrases as complex', () => {
      const result = classifyQuery('do this and then do that');
      expect(result.complexity).toBe('complex');
    });

    it('classifies long messages as complex', () => {
      const longMessage = Array(25).fill('word').join(' ');
      expect(classifyQuery(longMessage).complexity).toBe('complex');
    });
  });

  describe('getInjectionLevel', () => {
    it('returns correct levels for each complexity', () => {
      const trivial = getInjectionLevel('trivial');
      expect(trivial.workspace).toBe(false);
      expect(trivial.codeGraph).toBe(false);

      const simple = getInjectionLevel('simple');
      expect(simple.lessons).toBe(true);
      expect(simple.codeGraph).toBe(false);

      const complex = getInjectionLevel('complex');
      expect(complex.workspace).toBe(true);
      expect(complex.codeGraph).toBe(true);
    });
  });
});
