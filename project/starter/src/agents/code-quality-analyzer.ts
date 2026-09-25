import { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality.prompt';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes source code for security, performance, maintainability, style, bug risks, and best practices.',

  tools: ['Read', 'Glob', 'Grep', 'Skill'],

  prompt: `${CODE_QUALITY_ANALYZER_PROMPT}

You have access to the Claude Skills library.

For JavaScript or TypeScript code, use the javascript-best-practices skill
from .claude/skills/javascript-best-practices/SKILL.md when it is relevant
to the code being reviewed.

Use the skill's guidance to identify modern JavaScript/TypeScript best-practice
issues, async-pattern problems, common pitfalls, performance concerns, and
security concerns.

Do not use the skill mechanically when it is not relevant.
`,

  model: 'inherit'
};