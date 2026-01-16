// PR creation module for GitHub Action

import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';

export interface PRConfig {
  title: string;
  labels: string[];
  reviewers?: string[];
  branchName: string;
  baseBranch: string;
  prBodyPath?: string;
}

export interface PRResult {
  prNumber: number;
  prUrl: string;
  created: boolean;
}

/**
 * Create or update a PR with design changes
 * @param config PR configuration
 * @returns PR result with number and URL
 */
export async function createOrUpdatePR(config: PRConfig): Promise<PRResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is required for PR creation');
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;

  // Read PR body from file if provided
  let body = 'Design specs have been updated by Figma Sentinel.';
  if (config.prBodyPath && fs.existsSync(config.prBodyPath)) {
    body = fs.readFileSync(config.prBodyPath, 'utf-8');
    core.debug(`Loaded PR body from: ${config.prBodyPath}`);
  }

  // Check if PR already exists for this branch
  const existingPR = await findExistingPR(octokit, owner, repo, config.branchName, config.baseBranch);

  if (existingPR) {
    core.info(`Updating existing PR #${existingPR.number}`);

    // Update the PR
    await octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: existingPR.number,
      title: config.title,
      body,
    });

    // Update labels
    if (config.labels.length > 0) {
      await octokit.rest.issues.setLabels({
        owner,
        repo,
        issue_number: existingPR.number,
        labels: config.labels,
      });
    }

    // Add reviewers if specified
    if (config.reviewers && config.reviewers.length > 0) {
      try {
        await octokit.rest.pulls.requestReviewers({
          owner,
          repo,
          pull_number: existingPR.number,
          reviewers: config.reviewers,
        });
      } catch (error) {
        core.warning(`Failed to add reviewers: ${error}`);
      }
    }

    return {
      prNumber: existingPR.number,
      prUrl: existingPR.html_url,
      created: false,
    };
  }

  // Create new PR
  core.info(`Creating new PR: ${config.title}`);

  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: config.title,
    body,
    head: config.branchName,
    base: config.baseBranch,
  });

  core.info(`Created PR #${pr.number}: ${pr.html_url}`);

  // Add labels
  if (config.labels.length > 0) {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: config.labels,
    });
    core.debug(`Added labels: ${config.labels.join(', ')}`);
  }

  // Add reviewers if specified
  if (config.reviewers && config.reviewers.length > 0) {
    try {
      await octokit.rest.pulls.requestReviewers({
        owner,
        repo,
        pull_number: pr.number,
        reviewers: config.reviewers,
      });
      core.debug(`Added reviewers: ${config.reviewers.join(', ')}`);
    } catch (error) {
      core.warning(`Failed to add reviewers: ${error}`);
    }
  }

  return {
    prNumber: pr.number,
    prUrl: pr.html_url,
    created: true,
  };
}

/**
 * Find an existing PR for the given branch
 */
async function findExistingPR(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  head: string,
  base: string
): Promise<{ number: number; html_url: string } | null> {
  try {
    const { data: prs } = await octokit.rest.pulls.list({
      owner,
      repo,
      head: `${owner}:${head}`,
      base,
      state: 'open',
    });

    if (prs.length > 0) {
      const firstPr = prs[0];
      if (firstPr) {
        return {
          number: firstPr.number,
          html_url: firstPr.html_url,
        };
      }
    }

    return null;
  } catch (error) {
    core.debug(`Error checking for existing PR: ${error}`);
    return null;
  }
}

/**
 * Get the current branch name from GitHub context
 */
export function getCurrentBranch(): string {
  // For pull_request events, use the head ref
  if (github.context.eventName === 'pull_request') {
    return github.context.payload.pull_request?.head?.ref || '';
  }

  // For push events, extract from ref (refs/heads/branch-name)
  const ref = github.context.ref;
  if (ref.startsWith('refs/heads/')) {
    return ref.replace('refs/heads/', '');
  }

  return ref;
}

/**
 * Get the base branch (default branch) from GitHub context
 */
export function getBaseBranch(): string {
  // For pull_request events, use the base ref
  if (github.context.eventName === 'pull_request') {
    return github.context.payload.pull_request?.base?.ref || 'main';
  }

  // Default to main
  return process.env.GITHUB_BASE_REF || 'main';
}

/**
 * Parse comma-separated labels string into array
 */
export function parseLabels(labelsInput: string): string[] {
  if (!labelsInput || labelsInput.trim() === '') {
    return [];
  }

  return labelsInput
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}

/**
 * Parse comma-separated reviewers string into array
 */
export function parseReviewers(reviewersInput: string): string[] {
  if (!reviewersInput || reviewersInput.trim() === '') {
    return [];
  }

  return reviewersInput
    .split(',')
    .map((reviewer) => reviewer.trim())
    .filter((reviewer) => reviewer.length > 0);
}
