import { describe, expect, it } from 'vitest';
import { zodToJsonSchema } from 'zod-to-json-schema';

import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  ReviewReportSchema
} from '../src/types/index.js';

describe('CodeQualityResultSchema', () => {
  it('accepts valid data', () => {
    const data = {
      file: 'src/example.ts',
      issues: [
        {
          line: 10,
          severity: 'high',
          category: 'security',
          description: 'Potential security issue',
          suggestion: 'Validate the input before processing it'
        }
      ],
      overallScore: 85,
      summary: 'The code is generally good with one security concern.'
    };

    expect(() => CodeQualityResultSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid severity', () => {
    const data = {
      file: 'src/example.ts',
      issues: [
        {
          line: 10,
          severity: 'invalid',
          category: 'security',
          description: 'Potential issue',
          suggestion: 'Fix the issue'
        }
      ],
      overallScore: 85,
      summary: 'Summary'
    };

    expect(() => CodeQualityResultSchema.parse(data)).toThrow();
  });

  it('rejects score above 100', () => {
    const data = {
      file: 'src/example.ts',
      issues: [],
      overallScore: 101,
      summary: 'Summary'
    };

    expect(() => CodeQualityResultSchema.parse(data)).toThrow();
  });

  it('accepts empty issues', () => {
    const data = {
      file: 'src/example.ts',
      issues: [],
      overallScore: 100,
      summary: 'No issues found.'
    };

    expect(() => CodeQualityResultSchema.parse(data)).not.toThrow();
  });
});

describe('TestCoverageResultSchema', () => {
  it('accepts valid data', () => {
    const data = {
      file: 'src/example.ts',
      hasTests: true,
      testFiles: ['tests/example.test.ts'],
      untestedPaths: [
        {
          type: 'function',
          location: 'calculateTotal()',
          priority: 'high',
          reasoning: 'The function has no direct test coverage.',
          suggestedTest: 'Test normal and boundary inputs.'
        }
      ],
      coverageEstimate: 80,
      summary: 'Most functionality is covered.'
    };

    expect(() => TestCoverageResultSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid untested path type', () => {
    const data = {
      file: 'src/example.ts',
      hasTests: false,
      testFiles: [],
      untestedPaths: [
        {
          type: 'invalid',
          location: 'example()',
          priority: 'high',
          reasoning: 'No test exists.',
          suggestedTest: 'Add a test.'
        }
      ],
      coverageEstimate: 50,
      summary: 'Tests are missing.'
    };

    expect(() => TestCoverageResultSchema.parse(data)).toThrow();
  });

  it('accepts zero coverage', () => {
    const data = {
      file: 'src/example.ts',
      hasTests: false,
      testFiles: [],
      untestedPaths: [],
      coverageEstimate: 0,
      summary: 'No tests found.'
    };

    expect(() => TestCoverageResultSchema.parse(data)).not.toThrow();
  });

  it('rejects coverage above 100', () => {
    const data = {
      file: 'src/example.ts',
      hasTests: true,
      testFiles: ['tests/example.test.ts'],
      untestedPaths: [],
      coverageEstimate: 101,
      summary: 'Invalid coverage.'
    };

    expect(() => TestCoverageResultSchema.parse(data)).toThrow();
  });
});

describe('RefactoringSuggestionSchema', () => {
  it('accepts valid data', () => {
    const data = {
      file: 'src/example.ts',
      suggestions: [
        {
          type: 'extract-function',
          location: 'lines 20-40',
          impact: 'medium',
          description: 'Extract repeated logic into a function.',
          before: 'Repeated logic inside a large function.',
          after: 'Logic moved into a reusable helper function.',
          benefits: 'Improves readability and reuse.'
        }
      ],
      summary: 'One refactoring opportunity was identified.'
    };

    expect(() => RefactoringSuggestionSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid refactoring type', () => {
    const data = {
      file: 'src/example.ts',
      suggestions: [
        {
          type: 'invalid',
          location: 'lines 20-40',
          impact: 'medium',
          description: 'Refactoring suggestion.',
          before: 'Before',
          after: 'After',
          benefits: 'Benefits'
        }
      ],
      summary: 'Summary'
    };

    expect(() => RefactoringSuggestionSchema.parse(data)).toThrow();
  });

  it('accepts empty suggestions', () => {
    const data = {
      file: 'src/example.ts',
      suggestions: [],
      summary: 'No refactoring opportunities found.'
    };

    expect(() => RefactoringSuggestionSchema.parse(data)).not.toThrow();
  });
});

describe('ReviewReportSchema', () => {
  it('accepts valid complete report', () => {
    const data = {
      pullRequest: {
        owner: 'airaamane',
        repo: 'simple-todo-app',
        number: 1
      },

      fileReviews: [
        {
          file: 'src/example.ts',

          codeQuality: {
            file: 'src/example.ts',
            issues: [],
            overallScore: 90,
            summary: 'Good code quality.'
          },

          testCoverage: {
            file: 'src/example.ts',
            hasTests: true,
            testFiles: ['tests/example.test.ts'],
            untestedPaths: [],
            coverageEstimate: 90,
            summary: 'Good test coverage.'
          },

          refactorings: {
            file: 'src/example.ts',
            suggestions: [],
            summary: 'No major refactoring needed.'
          }
        }
      ],

      summary: {
        totalFiles: 1,
        overallScore: 90,
        criticalIssues: 0,
        highPriorityTests: 0,
        refactoringOpportunities: 0
      },

      recommendations: [
        {
          priority: 'low',
          category: 'quality',
          description: 'Continue maintaining the current code quality.',
          files: ['src/example.ts']
        }
      ],

      metadata: {
        analyzedAt: new Date().toISOString(),
        duration: 1000,
        agentVersions: {
          codeQuality: '1.0',
          testCoverage: '1.0',
          refactoring: '1.0'
        }
      }
    };

    expect(() => ReviewReportSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid PR number type', () => {
    const data = {
      pullRequest: {
        owner: 'airaamane',
        repo: 'simple-todo-app',
        number: '1'
      }
    };

    expect(() => ReviewReportSchema.parse(data)).toThrow();
  });

  it('accepts empty file reviews', () => {
    const data = {
      pullRequest: {
        owner: 'airaamane',
        repo: 'simple-todo-app',
        number: 1
      },

      fileReviews: [],

      summary: {
        totalFiles: 0,
        overallScore: 0,
        criticalIssues: 0,
        highPriorityTests: 0,
        refactoringOpportunities: 0
      },

      recommendations: [],

      metadata: {
        analyzedAt: new Date().toISOString(),
        duration: 0,
        agentVersions: {}
      }
    };

    expect(() => ReviewReportSchema.parse(data)).not.toThrow();
  });
});

describe('JSON Schema conversion', () => {
  it('generates JSON Schema for CodeQualityResult', () => {
    const schema = zodToJsonSchema(
      CodeQualityResultSchema,
      { $refStrategy: 'root' }
    );

    expect(schema).toBeDefined();
    expect(schema).toHaveProperty('type');
    expect(schema).toHaveProperty('properties');
  });

  it('generates JSON Schema for TestCoverageResult', () => {
    const schema = zodToJsonSchema(
      TestCoverageResultSchema,
      { $refStrategy: 'root' }
    );

    expect(schema).toBeDefined();
    expect(schema).toHaveProperty('type');
    expect(schema).toHaveProperty('properties');
  });

  it('generates JSON Schema for RefactoringSuggestion', () => {
    const schema = zodToJsonSchema(
      RefactoringSuggestionSchema,
      { $refStrategy: 'root' }
    );

    expect(schema).toBeDefined();
    expect(schema).toHaveProperty('type');
    expect(schema).toHaveProperty('properties');
  });

  it('generates JSON Schema for ReviewReport', () => {
    const schema = zodToJsonSchema(
      ReviewReportSchema,
      { $refStrategy: 'root' }
    );

    expect(schema).toBeDefined();
    expect(schema).toHaveProperty('type');
    expect(schema).toHaveProperty('properties');
  });
});