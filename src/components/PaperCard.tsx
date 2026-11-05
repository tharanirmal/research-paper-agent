/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ExternalLink, BookOpen, Quote, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { RetrievedPaper } from '../types.ts';

interface PaperCardProps {
  paper: RetrievedPaper;
  isExcluded: boolean;
  exclusionReason?: string;
  isCitedInFindingsOrAnswer?: boolean;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  isExcluded,
  exclusionReason,
  isCitedInFindingsOrAnswer,
}) => {
  const [showFullAbstract, setShowFullAbstract] = useState(false);

  const authorsString =
    paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown Authors';

  const primaryLink = paper.doi ? paper.doi : paper.openAlexUrl;
  const isDoi = Boolean(paper.doi);

  const abstractLength = paper.abstract?.length || 0;
  const isLongAbstract = abstractLength > 280;

  return (
    <article
      id={`paper-${paper.id}`}
      className={`rounded-xl border transition-all duration-300 scroll-mt-24 p-5 ${
        isExcluded
          ? 'opacity-65 bg-stone-100/60 border-stone-200 text-stone-600 hover:opacity-90'
          : 'bg-white border-stone-200/90 shadow-2xs hover:border-amber-400/80 hover:shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-mono-code font-bold ${
              isExcluded
                ? 'bg-stone-200 text-stone-600'
                : 'bg-amber-100 text-amber-900 border border-amber-300/80'
            }`}
          >
            #{paper.id}
          </span>

          {isExcluded ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-stone-200 text-stone-700">
              <AlertCircle className="w-3 h-3 text-stone-500" />
              Excluded
            </span>
          ) : isCitedInFindingsOrAnswer ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              Cited in synthesis
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-600">
              Retrieved
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 text-xs text-stone-500 font-mono-code px-2 py-1 rounded bg-stone-50 border border-stone-200/60"
            title={`${paper.citationCount.toLocaleString()} citations recorded in OpenAlex`}
          >
            <Quote className="w-3 h-3 text-stone-400" />
            <span>{paper.citationCount.toLocaleString()} citations</span>
          </div>

          <a
            href={primaryLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-950 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 transition-colors"
            title={isDoi ? `Open DOI: ${paper.doi}` : 'Open in OpenAlex'}
          >
            <span>{isDoi ? 'DOI' : 'OpenAlex'}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Exclusion reason callout */}
      {isExcluded && exclusionReason && (
        <div className="mt-3 px-3 py-2 bg-stone-200/60 border border-stone-300/60 rounded-md text-xs text-stone-700 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-stone-500 mt-0.5 shrink-0" />
          <div>
            <span className="font-semibold text-stone-800">Reason for exclusion:</span>{' '}
            <span>{exclusionReason}</span>
          </div>
        </div>
      )}

      {/* Paper title */}
      <h3
        className={`mt-3 text-base sm:text-lg font-serif-academic font-bold leading-snug ${
          isExcluded ? 'text-stone-700' : 'text-stone-900'
        }`}
      >
        <a
          href={primaryLink}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-amber-900 transition-colors"
        >
          {paper.title}
        </a>
      </h3>

      {/* Authors and metadata */}
      <div className="mt-2 text-xs sm:text-sm text-stone-600 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-stone-700">{authorsString}</span>
        {paper.year && (
          <>
            <span className="text-stone-300">•</span>
            <span className="font-mono-code font-semibold text-stone-800">{paper.year}</span>
          </>
        )}
        {paper.venue && (
          <>
            <span className="text-stone-300">•</span>
            <span className="italic text-stone-600 truncate max-w-xs">{paper.venue}</span>
          </>
        )}
      </div>

      {/* Abstract */}
      <div className="mt-3 pt-3 border-t border-stone-100 text-xs sm:text-sm text-stone-600 font-serif-academic leading-relaxed">
        {paper.abstract ? (
          <div>
            <div className="flex items-center gap-1.5 text-xs font-sans font-semibold text-stone-500 uppercase tracking-wider mb-1">
              <BookOpen className="w-3.5 h-3.5 text-stone-400" />
              <span>Abstract</span>
            </div>
            <p className={!showFullAbstract && isLongAbstract ? 'line-clamp-3' : ''}>
              {paper.abstract}
            </p>
            {isLongAbstract && (
              <button
                type="button"
                onClick={() => setShowFullAbstract(!showFullAbstract)}
                className="mt-1.5 inline-flex items-center gap-1 text-xs font-sans font-medium text-amber-800 hover:text-amber-950 focus:outline-none"
              >
                <span>{showFullAbstract ? 'Show less' : 'Read full abstract'}</span>
                {showFullAbstract ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs font-sans text-stone-400 italic">
            No abstract indexed by OpenAlex. (Per agent ground rules, evaluation relies on title and metadata only.)
          </div>
        )}
      </div>
    </article>
  );
};
