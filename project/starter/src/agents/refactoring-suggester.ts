import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring.prompt';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Analyzes source code and suggests practical refactorings to improve readability, maintainability, and structure.',
  tools: ['Read', 'Glob', 'Grep', 'Skill'],
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit'
};