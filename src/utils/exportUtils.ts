/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentResponse, RetrievedPaper } from '../types.ts';

export function generateMarkdownReport(
  question: string,
  response: AgentResponse,
  papers: RetrievedPaper[],
  verificationNote: string | null
): string {
  const dateStr = new Date().toISOString().split('T')[0];

  const citationsBlock = papers
    .map((p) => {
      const authorsStr = p.authors.slice(0, 3).join(', ') + (p.authors.length > 3 ? ' et al.' : '');
      const yearStr = p.year ? `(${p.year})` : '(n.d.)';
      const venueStr = p.venue ? `_${p.venue}_.` : '';
      const linkStr = p.doi ? `[DOI: ${p.doi}](${p.doi})` : `[OpenAlex](${p.openAlexUrl})`;
      return `[${p.id}] ${authorsStr} ${yearStr}. "${p.title}". ${venueStr} ${linkStr}`;
    })
    .join('\n\n');

  const reasoningBlock = response.reasoning
    .map((r) => `### ${r.step}\n${r.result}`)
    .join('\n\n');

  const findingsBlock =
    response.key_findings.length > 0
      ? response.key_findings
          .map((f) => `- ${f.claim} ${f.citations.map((c) => `[${c}]`).join(' ')}`)
          .join('\n')
      : '_No key findings extracted from retrieved records._';

  const excludedBlock =
    response.excluded_papers.length > 0
      ? response.excluded_papers
          .map((e) => `- Paper [${e.id}]: ${e.reason}`)
          .join('\n')
      : '_None._';

  const gapsBlock =
    response.gaps.length > 0
      ? response.gaps.map((g) => `- ${g}`).join('\n')
      : '_No gaps noted._';

  const nextStepsBlock =
    response.next_steps.length > 0
      ? response.next_steps.map((n) => `- ${n}`).join('\n')
      : '_None._';

  return `# Research Paper Agent Report

**Question:** ${question}  
**Date:** ${dateStr}  
**Confidence:** ${response.confidence.toUpperCase()}  
${verificationNote ? `**Verification Audit:** ${verificationNote}\n` : ''}

---

## Synthesized Answer

${response.answer}

---

## Key Findings

${findingsBlock}

---

## Step-by-Step Reasoning

${reasoningBlock}

---

## Excluded Records

${excludedBlock}

---

## Knowledge Gaps & Limitations

${gapsBlock}

---

## Suggested Next Searches

${nextStepsBlock}

---

## References (Retrieved Papers)

${citationsBlock}
`;
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
