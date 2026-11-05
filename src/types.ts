/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PaperForModel {
  id: number;
  title: string;
  authors: string[];
  year: number | null;
  abstract: string | null;
}

export interface RetrievedPaper extends PaperForModel {
  venue: string | null;
  citationCount: number;
  doi: string | null;
  openAlexId: string;
  openAlexUrl: string;
  relevanceScore: number;
}

export type ReasoningStepName =
  | 'Understand'
  | 'Screen'
  | 'Extract'
  | 'Compare'
  | 'Check'
  | 'Conclude';

export interface ReasoningStep {
  step: ReasoningStepName;
  result: string;
}

export interface KeyFinding {
  claim: string;
  citations: number[];
}

export interface ExcludedPaper {
  id: number;
  reason: string;
}

export interface AgentResponse {
  reasoning: ReasoningStep[];
  answer: string;
  key_findings: KeyFinding[];
  excluded_papers: ExcludedPaper[];
  gaps: string[];
  next_steps: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface VerificationResult {
  cleanedResponse: AgentResponse;
  droppedCitationsCount: number;
  droppedFindingsCount: number;
  invalidCitationsFound: number[];
  notes: string | null;
}

export type StepStatus = 'pending' | 'active' | 'completed';

export interface ProgressState {
  planning: StepStatus;
  searching: StepStatus;
  reasoning: StepStatus;
  verifying: StepStatus;
}
