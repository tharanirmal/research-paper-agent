/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentResponse, KeyFinding, RetrievedPaper, VerificationResult } from '../types.ts';

/**
 * Step 3: Verify in code, not in the model.
 * After the response arrives, drop any citation number that is not in the retrieved list,
 * and drop any key finding left with no citations.
 * If anything was dropped, return a note saying how many.
 */
export function verifyAndCleanResponse(
  rawResponse: AgentResponse,
  retrievedPapers: RetrievedPaper[]
): VerificationResult {
  const validIds = new Set(retrievedPapers.map((p) => p.id));
  const invalidCitationsFound: number[] = [];
  let droppedCitationCount = 0;
  let droppedFindingsCount = 0;

  // 1. Clean key findings
  const cleanedFindings: KeyFinding[] = [];

  for (const finding of rawResponse.key_findings || []) {
    const validCitations: number[] = [];
    for (const cid of finding.citations || []) {
      if (validIds.has(cid)) {
        if (!validCitations.includes(cid)) {
          validCitations.push(cid);
        }
      } else {
        droppedCitationCount++;
        invalidCitationsFound.push(cid);
      }
    }

    if (validCitations.length > 0) {
      cleanedFindings.push({
        claim: finding.claim,
        citations: validCitations,
      });
    } else {
      // Key finding left with no citations is dropped!
      droppedFindingsCount++;
    }
  }

  // 2. Clean citations in the answer text [n]
  // Matches brackets like [1], [99], or [1, 2]
  let cleanedAnswer = rawResponse.answer || '';
  const bracketCitationRegex = /\[([\d\s,]+)\]/g;

  cleanedAnswer = cleanedAnswer.replace(bracketCitationRegex, (match, inner) => {
    const numbers = inner
      .split(',')
      .map((s: string) => parseInt(s.trim(), 10))
      .filter((n: number) => !isNaN(n));

    const keptNumbers = numbers.filter((num: number) => {
      if (validIds.has(num)) {
        return true;
      }
      droppedCitationCount++;
      invalidCitationsFound.push(num);
      return false;
    });

    if (keptNumbers.length === 0) {
      return ''; // drop entire bracket
    }
    return `[${keptNumbers.join(', ')}]`;
  });

  // Clean double spaces or trailing punctuation spaces left by dropped citations
  cleanedAnswer = cleanedAnswer.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1');

  // 3. Clean excluded papers to ensure only valid retrieved IDs are shown
  const cleanedExcluded = (rawResponse.excluded_papers || []).filter((ep) =>
    validIds.has(ep.id)
  );

  // 4. Construct human-readable note if anything was dropped
  let notes: string | null = null;
  const parts: string[] = [];
  if (droppedCitationCount > 0) {
    parts.push(
      `${droppedCitationCount} ungrounded citation${droppedCitationCount > 1 ? 's' : ''} (ID: ${Array.from(new Set(invalidCitationsFound)).join(', ')})`
    );
  }
  if (droppedFindingsCount > 0) {
    parts.push(
      `${droppedFindingsCount} key finding${droppedFindingsCount > 1 ? 's' : ''} left without citations`
    );
  }

  if (parts.length > 0) {
    notes = `Verification filter applied: Dropped ${parts.join(' and ')} not present in the retrieved paper list.`;
  }

  const cleanedResponse: AgentResponse = {
    ...rawResponse,
    answer: cleanedAnswer,
    key_findings: cleanedFindings,
    excluded_papers: cleanedExcluded,
  };

  return {
    cleanedResponse,
    droppedCitationsCount: droppedCitationCount,
    droppedFindingsCount: droppedFindingsCount,
    invalidCitationsFound,
    notes,
  };
}
