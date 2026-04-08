/**
 * ResultAggregator — Claude Cowork parity
 *
 * Merges sub-agent outputs into a structured summary with grouped artifacts.
 * Used downstream by the UI to render aggregated multi-agent results.
 *
 * @module main/agent/result-aggregator
 */

export interface AgentResultInput {
  role: string;
  agentId?: string;
  nickname?: string;
  success: boolean;
  output: string;
  duration?: number;
  artifacts?: Record<string, unknown>;
  errors?: string[];
}

export interface AggregatedArtifact {
  key: string;
  value: unknown;
  contributors: string[];
}

export interface AggregatedSection {
  role: string;
  nickname: string;
  success: boolean;
  duration: number;
  summary: string;
  fullOutput: string;
  errors: string[];
}

export interface AggregatedResult {
  totalAgents: number;
  successCount: number;
  failureCount: number;
  totalDuration: number;
  summary: string;
  sections: AggregatedSection[];
  artifacts: AggregatedArtifact[];
  errors: string[];
}

const OUTPUT_SUMMARY_MAX_CHARS = 400;

export class ResultAggregator {
  aggregate(results: AgentResultInput[]): AggregatedResult {
    const sections: AggregatedSection[] = [];
    const artifactMap = new Map<string, { value: unknown; contributors: Set<string> }>();
    const errors: string[] = [];
    let successCount = 0;
    let failureCount = 0;
    let totalDuration = 0;

    for (const result of results) {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      totalDuration += result.duration ?? 0;

      if (result.errors) {
        for (const err of result.errors) {
          errors.push(`[${result.role}] ${err}`);
        }
      }

      sections.push({
        role: result.role,
        nickname: result.nickname ?? result.role,
        success: result.success,
        duration: result.duration ?? 0,
        summary: this.summarizeOutput(result.output),
        fullOutput: result.output,
        errors: result.errors ?? [],
      });

      // Merge artifacts
      if (result.artifacts) {
        for (const [key, value] of Object.entries(result.artifacts)) {
          if (!artifactMap.has(key)) {
            artifactMap.set(key, { value, contributors: new Set() });
          }
          artifactMap.get(key)!.contributors.add(result.role);
        }
      }
    }

    const artifacts: AggregatedArtifact[] = Array.from(artifactMap.entries()).map(
      ([key, entry]) => ({
        key,
        value: entry.value,
        contributors: Array.from(entry.contributors),
      })
    );

    return {
      totalAgents: results.length,
      successCount,
      failureCount,
      totalDuration,
      summary: this.buildTopSummary(results, successCount, failureCount),
      sections,
      artifacts,
      errors,
    };
  }

  private summarizeOutput(output: string): string {
    if (output.length <= OUTPUT_SUMMARY_MAX_CHARS) return output;
    // Extract first meaningful sentence or the first chunk
    const firstLine = output.split('\n').find((l) => l.trim().length > 30) ?? output;
    if (firstLine.length <= OUTPUT_SUMMARY_MAX_CHARS) return firstLine.trim();
    return firstLine.slice(0, OUTPUT_SUMMARY_MAX_CHARS - 3).trim() + '...';
  }

  private buildTopSummary(
    results: AgentResultInput[],
    successCount: number,
    failureCount: number
  ): string {
    if (results.length === 0) return 'No agents executed.';
    if (failureCount === 0) {
      return `All ${results.length} agents completed successfully.`;
    }
    if (successCount === 0) {
      return `All ${results.length} agents failed.`;
    }
    return `${successCount} of ${results.length} agents succeeded, ${failureCount} failed.`;
  }
}
