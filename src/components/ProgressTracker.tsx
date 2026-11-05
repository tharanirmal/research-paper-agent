/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, Loader2, CircleDot, Clock } from 'lucide-react';
import { ProgressState, StepStatus } from '../types.ts';

interface ProgressTrackerProps {
  progress: ProgressState;
  queries?: string[];
  paperCount?: number;
}

const stepsConfig = [
  {
    key: 'planning' as const,
    label: 'Planning searches',
    description: 'Asking Gemini for 2 to 3 targeted keyword search queries',
  },
  {
    key: 'searching' as const,
    label: 'Searching OpenAlex',
    description: 'Retrieving papers from OpenAlex, deduplicating, and ranking top 10',
  },
  {
    key: 'reasoning' as const,
    label: 'Reasoning',
    description: 'Synthesizing evidence through 6 structured reasoning steps',
  },
  {
    key: 'verifying' as const,
    label: 'Verifying citations',
    description: 'Filtering ungrounded citations and validating key findings in code',
  },
];

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  progress,
  queries,
  paperCount,
}) => {
  const renderIcon = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
      case 'active':
        return <Loader2 className="w-5 h-5 text-amber-700 animate-spin shrink-0" />;
      case 'pending':
      default:
        return <Clock className="w-5 h-5 text-stone-300 shrink-0" />;
    }
  };

  return (
    <div className="bg-white border border-stone-200/80 rounded-xl p-5 shadow-sm max-w-2xl mx-auto my-6">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-100">
        <CircleDot className="w-4 h-4 text-amber-700" />
        <h3 className="text-sm font-semibold tracking-wide uppercase text-stone-700">
          Agent Execution Pipeline
        </h3>
      </div>

      <div className="space-y-3.5">
        {stepsConfig.map((step, idx) => {
          const status = progress[step.key];
          const isDone = status === 'completed';
          const isActive = status === 'active';

          return (
            <div
              key={step.key}
              className={`flex items-start gap-3.5 p-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-amber-50/70 border border-amber-200/70'
                  : isDone
                  ? 'bg-stone-50/60'
                  : 'opacity-50'
              }`}
            >
              <div className="mt-0.5">{renderIcon(status)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-medium ${
                      isActive
                        ? 'text-amber-950 font-semibold'
                        : isDone
                        ? 'text-stone-800'
                        : 'text-stone-500'
                    }`}
                  >
                    {idx + 1}. {step.label}
                  </span>
                  {isActive && (
                    <span className="text-xs font-mono-code px-2 py-0.5 rounded bg-amber-200/60 text-amber-900 animate-pulse">
                      In progress...
                    </span>
                  )}
                  {isDone && (
                    <span className="text-xs font-mono-code text-emerald-700 font-medium">
                      Done
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{step.description}</p>

                {step.key === 'planning' && isDone && queries && queries.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {queries.map((q, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2 py-0.5 text-xs bg-stone-100 text-stone-700 border border-stone-200 rounded font-mono-code"
                      >
                        "{q}"
                      </span>
                    ))}
                  </div>
                )}

                {step.key === 'searching' && isDone && paperCount !== undefined && (
                  <div className="mt-1 text-xs text-emerald-800 font-medium">
                    Retrieved and ranked {paperCount} paper{paperCount !== 1 ? 's' : ''} from OpenAlex
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
