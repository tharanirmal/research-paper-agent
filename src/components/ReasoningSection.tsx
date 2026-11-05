/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Brain, FileCheck, Layers, GitCompare, ShieldCheck, Sparkles } from 'lucide-react';
import { ReasoningStep, ReasoningStepName } from '../types.ts';

interface ReasoningSectionProps {
  reasoning: ReasoningStep[];
}

const STEP_ICONS: Record<ReasoningStepName, React.ReactNode> = {
  Understand: <Brain className="w-4 h-4 text-indigo-600" />,
  Screen: <FileCheck className="w-4 h-4 text-amber-600" />,
  Extract: <Layers className="w-4 h-4 text-blue-600" />,
  Compare: <GitCompare className="w-4 h-4 text-purple-600" />,
  Check: <ShieldCheck className="w-4 h-4 text-emerald-600" />,
  Conclude: <Sparkles className="w-4 h-4 text-amber-700" />,
};

const STEP_DESCRIPTIONS: Record<ReasoningStepName, string> = {
  Understand: 'Restate question & identify core concepts',
  Screen: 'Evaluate paper relevance with justification',
  Extract: 'Extract methodology, empirical data & main findings',
  Compare: 'Analyze agreement, conflict & divergent metrics',
  Check: 'Verify claim-to-record citation backing',
  Conclude: 'Formulate conclusion & calibrate confidence',
};

export const ReasoningSection: React.FC<ReasoningSectionProps> = ({ reasoning }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!reasoning || reasoning.length === 0) {
    return null;
  }

  return (
    <div className="border border-stone-200/90 rounded-xl bg-stone-50/50 overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-stone-100/70 transition-colors focus:outline-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-stone-200/70 flex items-center justify-center text-stone-700">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-stone-900">
              Agent Reasoning Process
            </h4>
            <p className="text-xs text-stone-500">
              6-step verifiable deduction chain ({isOpen ? 'Click to collapse' : 'Click to inspect steps'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-stone-600 text-xs font-medium">
          <span>{isOpen ? 'Hide reasoning' : 'Show reasoning'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-stone-200/60 space-y-3.5">
          {reasoning.map((r, idx) => {
            const icon = STEP_ICONS[r.step] || <Brain className="w-4 h-4" />;
            const desc = STEP_DESCRIPTIONS[r.step] || '';

            return (
              <div
                key={idx}
                className="bg-white border border-stone-200/70 rounded-lg p-3.5 shadow-2xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-stone-100 text-stone-700 text-xs font-mono-code font-bold">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                      {icon}
                      {r.step}
                    </span>
                  </div>
                  {desc && (
                    <span className="text-[11px] text-stone-400 font-sans hidden sm:inline">
                      {desc}
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-stone-700 font-serif-academic leading-relaxed whitespace-pre-line pl-7">
                  {r.result}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
