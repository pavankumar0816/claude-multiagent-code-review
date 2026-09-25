import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
 * Vitest hoists vi.mock() calls.
 * Therefore mockQuery must be created using vi.hoisted().
 */
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn()
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockQuery
}));

vi.mock('../src/agents', () => ({
  codeQualityAnalyzer: {
    description: 'Code quality analyzer',
    prompt: 'Analyze code quality',
    tools: []
  },

  testCoverageAnalyzer: {
    description: 'Test coverage analyzer',
    prompt: 'Analyze test coverage',
    tools: []
  },

  refactoringSuggester: {
    description: 'Refactoring suggester',
    prompt: 'Suggest refactorings',
    tools: []
  }
}));

vi.mock('../src/config/mcp.config', () => ({
  mcpServersConfig: {}
}));

import { CodeReviewOrchestrator } from '../src/orchestrator';
import { ReviewReportSchema } from '../src/types/report-types';

const mockReviewReport = {
  pullRequest: {
    owner: 'octocat',
    repo: 'Hello-World',
    number: 1
  },

  fileReviews: [
    {
      file: 'src/example.ts',

      codeQuality: {
        file: 'src/example.ts',
        issues: [
          {
            line: 10,
            severity: 'medium',
            category: 'maintainability',
            description: 'Example maintainability issue',
            suggestion: 'Improve the implementation'
          }
        ],
        overallScore: 85,
        summary: 'Good code quality with minor improvements needed'
      },

      testCoverage: {
        file: 'src/example.ts',
        hasTests: true,
        testFiles: ['tests/example.test.ts'],
        untestedPaths: [],
        coverageEstimate: 90,
        summary: 'Good test coverage'
      },

      refactorings: {
        file: 'src/example.ts',
        suggestions: [
          {
            type: 'simplify',
            location: 'line 10',
            impact: 'low',
            description: 'Simplify this section',
            before: 'complex implementation',
            after: 'simplified implementation',
            benefits: 'Improves readability'
          }
        ],
        summary: 'Minor refactoring opportunities identified'
      }
    }
  ],

  summary: {
    totalFiles: 1,
    overallScore: 85,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 1
  },

  recommendations: [
    {
      priority: 'medium',
      category: 'maintainability',
      description: 'Improve code readability',
      files: ['src/example.ts']
    }
  ],

  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 1000,
    agentVersions: {
      codeQualityAnalyzer: '1.0.0',
      testCoverageAnalyzer: '1.0.0',
      refactoringSuggester: '1.0.0'
    }
  }
};

/**
 * Creates an async iterable that behaves like the Claude Agent SDK query().
 */
function createMockQueryResult(report = mockReviewReport) {
  return {
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'system'
      };

      yield {
        type: 'assistant'
      };

      yield {
        type: 'result',
        subtype: 'success',
        structured_output: report,
        result: JSON.stringify(report)
      };
    }
  };
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockQuery.mockReturnValue(
      createMockQueryResult()
    );
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator =
        new CodeReviewOrchestrator();

      expect(orchestrator).toBeDefined();
    });

    it('should accept custom model configuration', () => {
      const orchestrator =
        new CodeReviewOrchestrator({
          model: 'haiku'
        });

      expect(orchestrator).toBeDefined();
    });
  });

  describe('reviewPullRequest', () => {
    it('should fetch PR files from GitHub MCP', async () => {
      const orchestrator =
        new CodeReviewOrchestrator();

      const result =
        await orchestrator.reviewPullRequest(
          'octocat',
          'Hello-World',
          1
        );

      expect(result).toBeDefined();

      expect(mockQuery).toHaveBeenCalledTimes(1);

      const queryArguments =
        mockQuery.mock.calls[0]?.[0];

      expect(queryArguments).toBeDefined();

      expect(queryArguments.prompt).toContain(
        'octocat'
      );

      expect(queryArguments.prompt).toContain(
        'Hello-World'
      );

      expect(queryArguments.prompt).toContain('1');
    });

    it('should spawn all 3 subagents in parallel', async () => {
      const orchestrator =
        new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest(
        'octocat',
        'Hello-World',
        1
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);

      const queryArguments =
        mockQuery.mock.calls[0]?.[0];

      expect(queryArguments).toBeDefined();

      expect(queryArguments.options).toBeDefined();
      expect(queryArguments.options.agents).toBeDefined();

      const agents =
        queryArguments.options.agents;

      expect(agents.codeQualityAnalyzer).toBeDefined();
      expect(agents.testCoverageAnalyzer).toBeDefined();
      expect(agents.refactoringSuggester).toBeDefined();

      expect(
        Object.keys(agents)
      ).toHaveLength(3);
    });

    it('should aggregate results into ReviewReport', async () => {
      const orchestrator =
        new CodeReviewOrchestrator();

      const report =
        await orchestrator.reviewPullRequest(
          'octocat',
          'Hello-World',
          1
        );

      expect(report.pullRequest).toEqual({
        owner: 'octocat',
        repo: 'Hello-World',
        number: 1
      });

      expect(report.fileReviews).toHaveLength(1);

      expect(report.fileReviews[0]?.file).toBe(
        'src/example.ts'
      );

      expect(report.summary.totalFiles).toBe(1);

      expect(report.summary.overallScore).toBe(85);

      expect(report.recommendations).toHaveLength(1);
    });

    it('should validate output with Zod schema', async () => {
      const orchestrator =
        new CodeReviewOrchestrator();

      const report =
        await orchestrator.reviewPullRequest(
          'octocat',
          'Hello-World',
          1
        );

      const validation =
        ReviewReportSchema.safeParse(report);

      expect(validation.success).toBe(true);
    });

    it('should use the configured model', async () => {
      const orchestrator =
        new CodeReviewOrchestrator({
          model: 'haiku'
        });

      await orchestrator.reviewPullRequest(
        'octocat',
        'Hello-World',
        1
      );

      const queryArguments =
        mockQuery.mock.calls[0]?.[0];

      expect(
        queryArguments.options.model
      ).toBe('haiku');
    });

    it('should provide structured output configuration', async () => {
      const orchestrator =
        new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest(
        'octocat',
        'Hello-World',
        1
      );

      const queryArguments =
        mockQuery.mock.calls[0]?.[0];

      expect(
        queryArguments.options.outputFormat
      ).toBeDefined();

      expect(
        queryArguments.options.outputFormat.type
      ).toBe('json_schema');

      expect(
        queryArguments.options.outputFormat.schema
      ).toBeDefined();
    });

    it('should reject when no structured result is returned', async () => {
      mockQuery.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          yield {
            type: 'result',
            subtype: 'success',
            result: 'No structured output'
          };
        }
      });

      const orchestrator =
        new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest(
          'octocat',
          'Hello-World',
          1
        )
      ).rejects.toThrow(
        'Code review did not return a structured result'
      );
    });
  });

  describe('Integration', () => {
    /*
     * This test intentionally remains skipped.
     * It requires real Anthropic/GitHub credentials.
     */
    it.skip(
      'should review a real small PR',
      async () => {
        const orchestrator =
          new CodeReviewOrchestrator();

        const report =
          await orchestrator.reviewPullRequest(
            'octocat',
            'Hello-World',
            1
          );

        expect(report).toBeDefined();
      }
    );
  });
});