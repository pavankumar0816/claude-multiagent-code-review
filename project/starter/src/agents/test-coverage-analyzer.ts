import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage.prompt';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Analyzes source code and tests to identify missing test coverage, untested paths, branches, and edge cases.',
  tools: ['Read', 'Glob', 'Grep', 'Skill'],
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'inherit'
};