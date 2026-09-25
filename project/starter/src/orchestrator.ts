import 'dotenv/config';

import { query } from '@anthropic-ai/claude-agent-sdk';

import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
} from './agents';

import {
  ReviewReport,
  ReviewReportSchema,
  ReviewReportJSONSchema
} from './types/report-types';

import { buildOrchestratorPrompt } from './prompts/orchestrator.prompt';

import { mcpServersConfig } from './config/mcp.config';

export interface OrchestratorOptions {
  model?: 'sonnet' | 'opus' | 'haiku';
}

export class CodeReviewOrchestrator {
  private options: OrchestratorOptions;

  constructor(options: OrchestratorOptions = {}) {
    this.options = options;
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const startTime = Date.now();

    const prompt = buildOrchestratorPrompt(
      owner,
      repo,
      prNumber
    );

    const agents = {
      codeQualityAnalyzer,
      testCoverageAnalyzer,
      refactoringSuggester
    };

    let result: unknown;

    console.log('🔄 Starting Claude Agent SDK query...');

    for await (const message of query({
      prompt,

      options: {
        model: this.options.model ?? 'sonnet',

        agents,

        // Give the orchestrator access to GitHub and ESLint MCP servers
        mcpServers: mcpServersConfig,

        // Force the final response to match our ReviewReport schema
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema
        },

        // Allow the orchestrator to use the configured MCP tools
        allowedTools: [
          'mcp__github__*',
          'mcp__eslint__*'
        ]
      }
    })) {
      console.log(`📨 Received message: ${message.type}`);

      if (message.type === 'result') {
        console.log(`📋 Result subtype: ${message.subtype}`);

        if (
          'structured_output' in message &&
          message.structured_output
        ) {
          result = message.structured_output;
          console.log('✅ Structured output received');
        }

        if ('result' in message && message.result) {
          console.log('📝 Result text received');
        }
      }
    }

    if (!result) {
      throw new Error(
        'Code review did not return a structured result'
      );
    }

    const parsed = ReviewReportSchema.safeParse(result);

    if (!parsed.success) {
      throw new Error(
        `Invalid review report: ${parsed.error.message}`
      );
    }

    return {
      ...parsed.data,

      metadata: {
        ...parsed.data.metadata,
        duration: Date.now() - startTime
      }
    };
  }
}