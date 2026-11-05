/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Search,
  BookOpen,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
  Download,
  AlertTriangle,
  HelpCircle,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Layers,
  ArrowUpRight,
  GraduationCap,
} from 'lucide-react';
import {
  AgentResponse,
  ProgressState,
  RetrievedPaper,
  VerificationResult,
} from './types.ts';
import { searchOpenAlexPapers } from './services/openAlex.ts';
import { verifyAndCleanResponse } from './services/verification.ts';
import { ProgressTracker } from './components/ProgressTracker.tsx';
import { ReasoningSection } from './components/ReasoningSection.tsx';
import { PaperCard } from './components/PaperCard.tsx';
import { generateMarkdownReport, downloadJsonFile } from './utils/exportUtils.ts';

const EXAMPLE_QUESTIONS = [
  'Why did attention replace fixed-length encodings in neural machine translation?',
  'What are the primary mechanisms causing lithium-ion battery degradation at low temperatures?',
  'How does microplastic ingestion affect gut microbiome diversity in marine organisms?',
];

export default function App() {
  const [question, setQuestion] = useState('');
  const [activeQuestion, setActiveQuestion] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live progress
  const [progress, setProgress] = useState<ProgressState>({
    planning: 'pending',
    searching: 'pending',
    reasoning: 'pending',
    verifying: 'pending',
  });
  const [generatedQueries, setGeneratedQueries] = useState<string[]>([]);

  // Results
  const [papers, setPapers] = useState<RetrievedPaper[]>([]);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  // Feedback states
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleRunSearch = async (queryToRun?: string) => {
    const targetQuestion = (queryToRun !== undefined ? queryToRun : question).trim();
    if (!targetQuestion) return;

    setQuestion(targetQuestion);
    setActiveQuestion(targetQuestion);
    setIsRunning(true);
    setErrorMessage(null);
    setResponse(null);
    setVerificationResult(null);
    setPapers([]);
    setGeneratedQueries([]);

    try {
      // Step 1: Planning searches
      setProgress({
        planning: 'active',
        searching: 'pending',
        reasoning: 'pending',
        verifying: 'pending',
      });

      const planRes = await fetch('/api/generate-search-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: targetQuestion }),
      });

      if (!planRes.ok) {
        const errorData = await planRes.json().catch(() => ({}));
        throw new Error(errorData.error || `Query planning failed (${planRes.status})`);
      }

      const planData = await planRes.json();
      const queries: string[] = planData.queries || [targetQuestion];
      setGeneratedQueries(queries);

      setProgress({
        planning: 'completed',
        searching: 'active',
        reasoning: 'pending',
        verifying: 'pending',
      });

      // Step 2: Searching OpenAlex (called from browser)
      const retrieved = await searchOpenAlexPapers(queries);

      if (retrieved.length === 0) {
        setProgress({
          planning: 'completed',
          searching: 'completed',
          reasoning: 'pending',
          verifying: 'pending',
        });
        setPapers([]);
        setErrorMessage(
          'No academic papers were found on OpenAlex for the generated search terms. Try refining your question with different academic keywords.'
        );
        setIsRunning(false);
        return;
      }

      setPapers(retrieved);

      // Step 3: Reasoning with Gemini
      setProgress({
        planning: 'completed',
        searching: 'completed',
        reasoning: 'active',
        verifying: 'pending',
      });

      const reasonRes = await fetch('/api/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: targetQuestion,
          retrieved_papers: retrieved.map((p) => ({
            id: p.id,
            title: p.title,
            authors: p.authors,
            year: p.year,
            abstract: p.abstract,
          })),
        }),
      });

      if (!reasonRes.ok) {
        const errJson = await reasonRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Reasoning synthesis failed (${reasonRes.status})`);
      }

      const rawAgentResponse: AgentResponse = await reasonRes.json();

      // Step 4: Verify in code, not in the model
      setProgress({
        planning: 'completed',
        searching: 'completed',
        reasoning: 'completed',
        verifying: 'active',
      });

      const verified = verifyAndCleanResponse(rawAgentResponse, retrieved);
      setVerificationResult(verified);
      setResponse(verified.cleanedResponse);

      setProgress({
        planning: 'completed',
        searching: 'completed',
        reasoning: 'completed',
        verifying: 'completed',
      });
    } catch (err: unknown) {
      console.error('Execution error:', err);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during execution';
      setErrorMessage(msg);
    } finally {
      setIsRunning(false);
    }
  };

  const scrollToPaper = (paperId: number) => {
    const el = document.getElementById(`paper-${paperId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('paper-highlight-target');
      // trigger reflow
      void el.offsetWidth;
      el.classList.add('paper-highlight-target');
      setTimeout(() => {
        el.classList.remove('paper-highlight-target');
      }, 2600);
    }
  };

  const handleCopyMarkdown = () => {
    if (!response || !activeQuestion) return;
    const md = generateMarkdownReport(
      activeQuestion,
      response,
      papers,
      verificationResult?.notes || null
    );
    navigator.clipboard.writeText(md).then(() => {
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2200);
    });
  };

  const handleDownloadJson = () => {
    if (!response || !activeQuestion) return;
    const exportData = {
      question: activeQuestion,
      timestamp: new Date().toISOString(),
      generated_queries: generatedQueries,
      retrieved_papers: papers,
      response,
      verification: verificationResult
        ? {
            dropped_citations_count: verificationResult.droppedCitationsCount,
            dropped_findings_count: verificationResult.droppedFindingsCount,
            invalid_citations_found: verificationResult.invalidCitationsFound,
            notes: verificationResult.notes,
          }
        : null,
    };
    const slug = activeQuestion
      .slice(0, 30)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    downloadJsonFile(`research-agent-${slug || 'report'}.json`, exportData);
  };

  const handleNextStepClick = (rawStep: string) => {
    // Clean string like "Search for: query" -> "query"
    const cleaned = rawStep
      .replace(/^search\s+for:?\s*/i, '')
      .replace(/^[-*•\s"]+|[",]+$/g, '')
      .trim();

    setQuestion(cleaned);
    if (inputRef.current) {
      inputRef.current.focus();
    }
    handleRunSearch(cleaned);
  };

  // Render clickable citation brackets in answer text
  const renderInteractiveAnswer = (text: string) => {
    const regex = /\[([\d\s,]+)\]/g;
    const nodes: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const preceding = text.slice(lastIdx, match.index);
      if (preceding) {
        nodes.push(preceding);
      }

      const ids = match[1]
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      nodes.push(
        <span key={`group-${match.index}`} className="inline-flex items-center gap-1 mx-1 align-baseline">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToPaper(id)}
              title={`Jump to paper #${id}`}
              className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono-code font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 active:bg-amber-300 border border-amber-300 rounded cursor-pointer transition-transform hover:scale-105"
            >
              [{id}]
            </button>
          ))}
        </span>
      );

      lastIdx = regex.lastIndex;
    }

    const trailing = text.slice(lastIdx);
    if (trailing) {
      nodes.push(trailing);
    }

    return nodes;
  };

  // Excluded paper map for easy lookup
  const excludedMap = new Map<number, string>();
  if (response?.excluded_papers) {
    for (const ep of response.excluded_papers) {
      excludedMap.set(ep.id, ep.reason);
    }
  }

  // Set of cited papers
  const citedPaperIds = new Set<number>();
  if (response) {
    // Citations in key findings
    for (const f of response.key_findings) {
      for (const c of f.citations) {
        citedPaperIds.add(c);
      }
    }
    // Citations in answer
    const answerCitations = response.answer.match(/\[([\d\s,]+)\]/g) || [];
    for (const match of answerCitations) {
      const nums = match.replace(/[\[\]]/g, '').split(',');
      for (const n of nums) {
        const id = parseInt(n.trim(), 10);
        if (!isNaN(id)) citedPaperIds.add(id);
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#fafaf8] text-[#1c1917] flex flex-col font-sans">
      {/* Top Academic Header */}
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center text-amber-100 shadow-xs shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-serif-academic font-bold text-stone-900 tracking-tight leading-none whitespace-nowrap truncate">
                Research Paper Agent
              </h1>
              <p className="hidden sm:block text-[11px] font-sans text-stone-500 uppercase tracking-wider mt-1 truncate">
                Verifiable Academic Synthesis • OpenAlex Grounded
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {response && (
              <>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-medium text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 rounded-lg border border-stone-200/80 transition-colors cursor-pointer"
                  title="Copy full synthesis report as formatted Markdown"
                  aria-label="Copy as Markdown"
                >
                  {copiedMarkdown ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline text-emerald-700 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copy as Markdown</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="inline-flex items-center gap-1.5 p-2 sm:px-3 sm:py-1.5 text-xs font-medium text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 rounded-lg border border-stone-200/80 transition-colors cursor-pointer"
                  title="Download JSON dataset (question, papers, response, verification audit)"
                  aria-label="Download JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download JSON</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Research Question Input Area */}
        <section className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-6 shadow-xs">
          <label
            htmlFor="research-question"
            className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2"
          >
            Academic Research Question
          </label>
          <div className="relative">
            <textarea
              id="research-question"
              ref={inputRef}
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleRunSearch();
                }
              }}
              placeholder="e.g. Why did attention replace fixed-length encodings in neural machine translation?"
              className="w-full p-3.5 sm:p-4 text-sm sm:text-base font-serif-academic text-stone-900 bg-stone-50/50 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600 transition-all resize-y placeholder:text-stone-400 placeholder:font-sans"
              disabled={isRunning}
            />
          </div>

          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-stone-400 hidden sm:flex items-center gap-1">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-stone-100 border border-stone-200 font-mono-code text-[11px] text-stone-600">
                ⌘ + Enter
              </kbd>
              <span>or click Run</span>
            </div>

            <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
              {question.trim() && !isRunning && (
                <button
                  type="button"
                  onClick={() => setQuestion('')}
                  className="px-3 py-2 text-xs text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRunSearch()}
                disabled={isRunning || !question.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white text-sm font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Investigating...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Run Synthesis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Live Progress Pipeline (Visible during execution) */}
        {isRunning && (
          <ProgressTracker
            progress={progress}
            queries={generatedQueries}
            paperCount={papers.length > 0 ? papers.length : undefined}
          />
        )}

        {/* Error / Failure State with Retry Button */}
        {errorMessage && !isRunning && (
          <div className="bg-red-50/80 border border-red-200 rounded-xl p-5 text-red-900 shadow-2xs">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-red-950">Synthesis Interrupted</h3>
                <p className="text-xs sm:text-sm text-red-800 mt-1 leading-relaxed">
                  {errorMessage}
                </p>
                <div className="mt-3.5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleRunSearch()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry Pipeline</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="text-xs text-red-700 hover:text-red-900 font-medium cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Verification Audit Notice (Step 3: Verification in code, not in model) */}
        {verificationResult?.notes && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-xs sm:text-sm text-amber-900 shadow-2xs flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-950 flex items-center gap-1.5">
                <span>Code-Level Verification Applied</span>
                <span className="font-mono-code text-[11px] px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900">
                  Ground-Truth Check
                </span>
              </div>
              <p className="mt-0.5 text-amber-800 text-xs sm:text-sm">
                {verificationResult.notes}
              </p>
            </div>
          </div>
        )}

        {/* Results Section */}
        {response && (
          <div className="space-y-8 animate-fadeIn">
            {/* Answer & Synthesis Card */}
            <article className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-8 shadow-xs">
              {/* Card Header: Confidence Badge & Meta */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                    Synthesized Evidence
                  </span>
                </div>

                {/* Confidence Badge */}
                <div className="flex items-center gap-2">
                  {response.confidence === 'high' && (
                    <div
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300"
                      title="High confidence: Three or more relevant records with abstracts agree."
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>High Confidence</span>
                    </div>
                  )}
                  {response.confidence === 'medium' && (
                    <div
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-300"
                      title="Medium confidence: One or two relevant records with abstracts, or the records partly disagree."
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Medium Confidence</span>
                    </div>
                  )}
                  {response.confidence === 'low' && (
                    <div
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-300"
                      title="Low confidence: Only titles or metadata are available, or the records only touch on the question."
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
                      <span>Low Confidence</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Research Question restatement */}
              <div className="mt-4 mb-5">
                <h2 className="text-lg sm:text-xl font-serif-academic font-bold text-stone-900 leading-snug">
                  {activeQuestion}
                </h2>
              </div>

              {/* The Answer with interactive [n] citations */}
              <div className="text-stone-800 font-serif-academic text-base sm:text-lg leading-relaxed whitespace-pre-line">
                {renderInteractiveAnswer(response.answer)}
              </div>

              {/* Key Findings with their citations */}
              {response.key_findings.length > 0 && (
                <div className="mt-8 pt-6 border-t border-stone-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-3 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-amber-700" />
                    <span>Key Empirical Findings & Citations</span>
                  </h3>
                  <ul className="space-y-2.5">
                    {response.key_findings.map((kf, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-stone-800 font-serif-academic leading-normal bg-stone-50/70 border border-stone-200/60 p-3 rounded-lg"
                      >
                        <span className="text-amber-800 font-bold shrink-0 mt-0.5">•</span>
                        <div className="flex-1">
                          <span>{kf.claim}</span>
                          <span className="inline-flex items-center gap-1 ml-2 align-baseline">
                            {kf.citations.map((cid) => (
                              <button
                                key={cid}
                                type="button"
                                onClick={() => scrollToPaper(cid)}
                                className="inline-flex items-center justify-center px-1.5 py-0.2 text-xs font-mono-code font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded cursor-pointer"
                                title={`Jump to paper #${cid}`}
                              >
                                [{cid}]
                              </button>
                            ))}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>

            {/* Collapsed "Show reasoning" Section (Step 4) */}
            <ReasoningSection reasoning={response.reasoning} />

            {/* Gaps and Next Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Knowledge Gaps */}
              <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-2xs">
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle className="w-4 h-4 text-stone-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Gaps & Delimitations
                  </h4>
                </div>
                {response.gaps.length > 0 ? (
                  <ul className="space-y-2">
                    {response.gaps.map((gap, idx) => (
                      <li
                        key={idx}
                        className="text-xs sm:text-sm text-stone-700 font-serif-academic leading-relaxed flex items-start gap-2"
                      >
                        <span className="text-stone-400 mt-0.5">•</span>
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-stone-500 italic">No specific gaps identified.</p>
                )}
              </div>

              {/* Next Steps (Each suggested search is a button that fills question & runs) */}
              <div className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-2xs">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRight className="w-4 h-4 text-amber-700" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Suggested Next Searches
                  </h4>
                </div>
                <p className="text-xs text-stone-500 mb-3">
                  Click any suggested direction to instantly execute a follow-up query:
                </p>
                {response.next_steps.length > 0 ? (
                  <div className="space-y-2">
                    {response.next_steps.map((step, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleNextStepClick(step)}
                        className="w-full text-left p-2.5 rounded-lg border border-amber-200/80 bg-amber-50/50 hover:bg-amber-100/70 text-xs sm:text-sm text-amber-950 font-serif-academic transition-colors flex items-center justify-between gap-2 group cursor-pointer"
                      >
                        <span className="line-clamp-2">{step}</span>
                        <ArrowUpRight className="w-4 h-4 text-amber-700 shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-500 italic">No follow-up terms suggested.</p>
                )}
              </div>
            </div>

            {/* Retrieved Academic Papers List */}
            <section className="space-y-4 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-stone-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-stone-700" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-900">
                    Retrieved Papers ({papers.length})
                  </h3>
                </div>
                <div className="text-xs text-stone-500">
                  Ranked by OpenAlex relevance score
                </div>
              </div>

              <div className="space-y-4">
                {papers.map((paper) => {
                  const isExcluded = excludedMap.has(paper.id);
                  const exclusionReason = excludedMap.get(paper.id);
                  const isCited = citedPaperIds.has(paper.id);

                  return (
                    <PaperCard
                      key={paper.id}
                      paper={paper}
                      isExcluded={isExcluded}
                      exclusionReason={exclusionReason}
                      isCitedInFindingsOrAnswer={isCited}
                    />
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* Empty State: Three Example Questions (Step 5) */}
        {!response && !isRunning && !errorMessage && (
          <div className="space-y-6 pt-4 animate-fadeIn">
            <div className="text-center max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200/80 text-amber-900 mx-auto flex items-center justify-center mb-3">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-serif-academic font-bold text-stone-900">
                Evidence Synthesis from Academic Papers
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 mt-1 leading-relaxed">
                Type an academic research question above to query OpenAlex for live scholarly papers,
                extract findings, reason through evidence, and verify citations in code.
              </p>
            </div>

            <div className="space-y-3">
              <span className="block text-xs font-semibold uppercase tracking-wider text-stone-500 text-center">
                Or try one of these example questions:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {EXAMPLE_QUESTIONS.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuestion(ex);
                      handleRunSearch(ex);
                    }}
                    className="p-4 rounded-xl bg-white border border-stone-200/90 hover:border-amber-400 hover:shadow-xs text-left transition-all group flex flex-col justify-between cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-serif-academic font-medium text-stone-800 group-hover:text-amber-950 leading-snug">
                      "{ex}"
                    </span>
                    <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-sans font-semibold text-amber-800 group-hover:text-amber-950">
                      <span>Explore this</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200/80 py-6 text-center text-xs text-stone-500 font-sans mt-auto">
        <p>
          Research Paper Agent • Direct OpenAlex API Integration • Citations checked against retrieved papers
        </p>
      </footer>
    </div>
  );
}
