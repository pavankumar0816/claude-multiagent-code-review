import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import { CodeReviewOrchestrator } from './orchestrator';
import { ReportGenerator } from './utils/report-generator';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  // Validate command line arguments
  if (!owner || !repo || !prStr) {
    console.error(
      'Usage: npm run dev <owner> <repo> <pr-number>'
    );
    process.exit(1);
  }

  const prNumber = Number(prStr);

  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    console.error('Error: PR number must be a valid positive integer.');
    process.exit(1);
  }

  // Validate authentication
  const hasAnthropicApiKey = Boolean(
    process.env.ANTHROPIC_API_KEY
  );

  const hasAwsCredentials =
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  if (hasAwsCredentials) {
    if (!process.env.AWS_REGION) {
      console.error(
        'Error: AWS_REGION is required when using AWS Bedrock authentication.'
      );
      process.exit(1);
    }

    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicApiKey) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error('Authentication is not configured.');
    console.error('');
    console.error('Option 1 - Anthropic API:');
    console.error('  Set ANTHROPIC_API_KEY');
    console.error('');
    console.error('Option 2 - AWS Bedrock:');
    console.error('  Set AWS_ACCESS_KEY_ID');
    console.error('  Set AWS_SECRET_ACCESS_KEY');
    console.error('  Set AWS_REGION');
    process.exit(1);
  }

  // Validate model
  if (!process.env.ANTHROPIC_MODEL) {
    console.error(
      'Error: ANTHROPIC_MODEL environment variable is required.'
    );
    console.error('');
    console.error(
      'Anthropic API example: claude-sonnet-4-5-20250929'
    );
    console.error(
      'AWS Bedrock example: us.anthropic.claude-sonnet-4-5-20250929-v1:0'
    );
    process.exit(1);
  }

  console.log(`🤖 Model: ${process.env.ANTHROPIC_MODEL}`);
  console.log(`🔍 Reviewing PR: ${owner}/${repo}#${prNumber}`);

  const startTime = Date.now();

  try {
    // Create orchestrator
    const orchestrator = new CodeReviewOrchestrator();

    // Review the pull request
    console.log('🚀 Starting code review...');

    const report = await orchestrator.reviewPullRequest(
      owner,
      repo,
      prNumber
    );

    // Create report generator
    const reportGenerator = new ReportGenerator();

    // Generate all three report formats
    const markdown =
      reportGenerator.generateMarkdownReport(report);

    const html =
      reportGenerator.generateHTMLReport(report);

    const json =
      reportGenerator.generateJSONReport(report);

    // Create reports directory
    await fs.mkdir('reports', { recursive: true });

    // Save Markdown report
await fs.writeFile(
  `reports/${owner}_${repo}_${prNumber}.md`,
  markdown,
  'utf-8'
);

// Save HTML report
await fs.writeFile(
  `reports/${owner}_${repo}_${prNumber}.html`,
  html,
  'utf-8'
);

// Save JSON report
await fs.writeFile(
  `reports/${owner}_${repo}_${prNumber}.json`,
  json,
  'utf-8'
);

    const duration = Date.now() - startTime;

    console.log('');
    console.log('✅ Code review completed!');
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log('');
    console.log('📄 Reports generated:');
    console.log(
  `   Markdown: reports/${owner}_${repo}_${prNumber}.md`
);
console.log(
  `   HTML:     reports/${owner}_${repo}_${prNumber}.html`
);
console.log(
  `   JSON:     reports/${owner}_${repo}_${prNumber}.json`
);
  } catch (error) {
    console.error('');
    console.error('❌ Error during code review:');

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

main();
