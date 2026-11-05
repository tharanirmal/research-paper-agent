/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RetrievedPaper } from '../types.ts';

interface OpenAlexAuthor {
  author?: {
    display_name?: string;
  };
}

interface OpenAlexWork {
  id: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  relevance_score?: number | null;
  cited_by_count?: number | null;
  authorships?: OpenAlexAuthor[];
  primary_location?: {
    source?: {
      display_name?: string | null;
    } | null;
    landing_page_url?: string | null;
  } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

interface OpenAlexResponse {
  results?: OpenAlexWork[];
}

/**
 * Reconstructs clean abstract text from OpenAlex's abstract_inverted_index.
 * If the work has no abstract, returns null.
 */
export function reconstructAbstract(invertedIndex?: Record<string, number[]> | null): string | null {
  if (!invertedIndex || typeof invertedIndex !== 'object') {
    return null;
  }

  const entries = Object.entries(invertedIndex);
  if (entries.length === 0) {
    return null;
  }

  let maxIndex = -1;
  const wordPositionMap: Map<number, string> = new Map();

  for (const [word, positions] of entries) {
    if (Array.isArray(positions)) {
      for (const pos of positions) {
        if (typeof pos === 'number' && pos >= 0) {
          wordPositionMap.set(pos, word);
          if (pos > maxIndex) {
            maxIndex = pos;
          }
        }
      }
    }
  }

  if (maxIndex < 0) {
    return null;
  }

  const words: string[] = [];
  for (let i = 0; i <= maxIndex; i++) {
    const w = wordPositionMap.get(i);
    if (w !== undefined) {
      words.push(w);
    }
  }

  const joined = words.join(' ').trim();
  return joined.length > 0 ? joined : null;
}

/**
 * Executes queries against OpenAlex API, merges results, deduplicates by ID,
 * sorts by relevance_score descending, retains top 10, and assigns IDs from 1.
 */
export async function searchOpenAlexPapers(queries: string[]): Promise<RetrievedPaper[]> {
  let successfulQueries = 0;
  let lastError: Error | null = null;

  const fetchPromises = queries.map(async (query) => {
    try {
      const sanitized = encodeURIComponent(query.trim());
      const url = `https://api.openalex.org/works?search=${sanitized}&per-page=8`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`OpenAlex returned HTTP ${response.status}`);
      }

      const data: OpenAlexResponse = await response.json();
      successfulQueries++;
      return data.results || [];
    } catch (err) {
      console.warn(`Error querying OpenAlex for "${query}":`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
      return [];
    }
  });

  const resultsByQuery = await Promise.all(fetchPromises);

  // If every query failed, throw an error instead of returning an empty list
  if (queries.length > 0 && successfulQueries === 0) {
    throw (
      lastError ||
      new Error('Failed to connect to the OpenAlex academic API. Please check your connection and retry.')
    );
  }

  const allWorks = resultsByQuery.flat();

  if (allWorks.length === 0) {
    return [];
  }

  // Deduplicate by OpenAlex ID
  const uniqueWorksMap = new Map<string, OpenAlexWork>();
  for (const work of allWorks) {
    if (!work || !work.id) continue;
    if (!uniqueWorksMap.has(work.id)) {
      uniqueWorksMap.set(work.id, work);
    } else {
      // Keep work with highest relevance score if already present
      const existing = uniqueWorksMap.get(work.id)!;
      const existingScore = existing.relevance_score ?? 0;
      const currentScore = work.relevance_score ?? 0;
      if (currentScore > existingScore) {
        uniqueWorksMap.set(work.id, work);
      }
    }
  }

  const uniqueWorks = Array.from(uniqueWorksMap.values());

  // Sort by relevance_score descending
  uniqueWorks.sort((a, b) => {
    const scoreA = a.relevance_score ?? 0;
    const scoreB = b.relevance_score ?? 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    // secondary sort by citation count
    return (b.cited_by_count ?? 0) - (a.cited_by_count ?? 0);
  });

  // Keep top 10
  const top10 = uniqueWorks.slice(0, 10);

  // Map to RetrievedPaper and number from 1
  return top10.map((work, index) => {
    const rawTitle = work.title || work.display_name || 'Untitled Paper';
    const authors = (work.authorships || [])
      .map((a) => a.author?.display_name?.trim())
      .filter((name): name is string => Boolean(name));

    const abstract = reconstructAbstract(work.abstract_inverted_index);
    const venue = work.primary_location?.source?.display_name || null;
    const doi = work.doi || null;
    const openAlexUrl = work.id;

    return {
      id: index + 1,
      title: rawTitle,
      authors: authors.length > 0 ? authors : ['Unknown Author'],
      year: work.publication_year ?? null,
      abstract,
      venue,
      citationCount: work.cited_by_count ?? 0,
      doi,
      openAlexId: work.id,
      openAlexUrl,
      relevanceScore: work.relevance_score ?? 0,
    };
  });
}
