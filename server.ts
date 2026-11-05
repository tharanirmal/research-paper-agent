/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import { SYSTEM_PROMPT } from './src/systemPrompt.ts';
import { FEW_SHOT_EXAMPLES } from './src/fewShotExamples.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({
  apiKey: apiKey || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

async function generateWithModelFallback(
  params: {
    contents: string;
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: any;
  }
) {
  let lastErr: unknown;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: params.responseMimeType || 'application/json',
          responseSchema: params.responseSchema,
        },
      });
      return response;
    } catch (err: unknown) {
      lastErr = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`Model ${model} unavailable (${errMsg.slice(0, 100)}). Trying next candidate...`);
      continue;
    }
  }

  throw lastErr || new Error('All models temporarily unavailable. Please retry shortly.');
}

function extractFallbackKeywords(question: string): string[] {
  const stopWords = new Set([
    'why', 'did', 'do', 'does', 'is', 'are', 'what', 'how', 'the', 'in', 'of', 'and', 'to',
    'a', 'an', 'for', 'on', 'with', 'at', 'by', 'from', 'between', 'causing', 'cause', 'causes'
  ]);
  const words = question
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const q1 = words.slice(0, 4).join(' ');
  const q2 = words.slice(2, 6).join(' ');
  const q3 = words.filter((_, i) => i % 2 === 0).slice(0, 4).join(' ');

  const unique = Array.from(new Set([q1, q2, q3].filter(Boolean)));
  return unique.length > 0 ? unique : [question.slice(0, 40)];
}

function formatApiError(err: unknown): string {
  const rawMsg = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed?.error?.message) {
      if (parsed.error.code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED') {
        return 'Gemini API free tier limit reached (5 requests/min). Please wait 10 seconds and click Retry.';
      }
      if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE') {
        return 'Gemini is currently experiencing temporary high demand. Please click Retry in a few moments.';
      }
      return parsed.error.message;
    }
  } catch {
    // not JSON
  }

  if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
    return 'Gemini API free tier limit reached (5 requests/min). Please wait 10 seconds and click Retry.';
  }
  if (rawMsg.includes('503') || rawMsg.includes('high demand')) {
    return 'Gemini is experiencing temporary high demand. Please click Retry in a few moments.';
  }

  return rawMsg;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));

  // 1. Generate 2 to 3 keyword searches based on research question
  app.post('/api/generate-search-queries', async (req: Request, res: Response) => {
    try {
      const { question } = req.body;
      if (!question || typeof question !== 'string') {
        res.status(400).json({ error: 'Question is required' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please add your key in Settings > Secrets.',
        });
        return;
      }

      const prompt = `You are a scientific research assistant. A student asked the following research question:
"${question.trim()}"

Generate 2 to 3 distinct, short keyword search queries (each 2 to 4 words, plain academic terms without boolean operators or punctuation, suitable for querying the OpenAlex academic paper database).
Focus on core mechanisms, concepts, and domain terms.`;

      let queries: string[] = [];

      try {
        const response = await generateWithModelFallback({
          contents: prompt,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: 'List of 2 to 3 short keyword queries',
          },
        });

        const rawText = response.text?.trim() || '[]';
        try {
          queries = JSON.parse(rawText);
        } catch {
          queries = rawText
            .split('\n')
            .map((line) => line.replace(/^[-*0-9.\s"]+|[",]+$/g, '').trim())
            .filter(Boolean);
        }
      } catch (geminiErr) {
        console.warn('Gemini query generation experienced an issue, using fallback heuristic:', geminiErr);
        queries = extractFallbackKeywords(question);
      }

      if (!Array.isArray(queries) || queries.length === 0) {
        queries = extractFallbackKeywords(question);
      }

      // Ensure 2 to 3 queries
      queries = queries.slice(0, 3).map((q) => q.replace(/["']/g, '').trim());

      res.json({ queries });
    } catch (err: unknown) {
      console.error('Error generating search queries:', err);
      res.status(500).json({ error: formatApiError(err) });
    }
  });

  // 2. Reason and synthesize answer from retrieved papers
  app.post('/api/reason', async (req: Request, res: Response) => {
    try {
      const { question, retrieved_papers } = req.body;
      if (!question || typeof question !== 'string') {
        res.status(400).json({ error: 'Question is required' });
        return;
      }

      if (!Array.isArray(retrieved_papers) || retrieved_papers.length === 0) {
        res.status(400).json({ error: 'Retrieved papers list cannot be empty' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({
          error: 'GEMINI_API_KEY is not configured on the server. Please add your key in Settings > Secrets.',
        });
        return;
      }

      // Format the prompt with RETRIEVED_PAPERS block followed by QUESTION
      const papersBlock = retrieved_papers.map((p) => ({
        id: p.id,
        title: p.title,
        authors: p.authors,
        year: p.year,
        abstract: p.abstract ?? null,
      }));

      const contents = `RETRIEVED_PAPERS:
${JSON.stringify(papersBlock, null, 2)}

QUESTION:
${question.trim()}`;

      const systemInstruction = `${SYSTEM_PROMPT}

===== FEW-SHOT EXAMPLES JSON =====
${JSON.stringify(FEW_SHOT_EXAMPLES, null, 2)}`;

      const responseSchema = {
        type: Type.OBJECT,
        required: [
          'reasoning',
          'answer',
          'key_findings',
          'excluded_papers',
          'gaps',
          'next_steps',
          'confidence',
        ],
        properties: {
          reasoning: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ['step', 'result'],
              properties: {
                step: {
                  type: Type.STRING,
                  enum: ['Understand', 'Screen', 'Extract', 'Compare', 'Check', 'Conclude'],
                },
                result: { type: Type.STRING },
              },
            },
          },
          answer: { type: Type.STRING },
          key_findings: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ['claim', 'citations'],
              properties: {
                claim: { type: Type.STRING },
                citations: {
                  type: Type.ARRAY,
                  items: { type: Type.INTEGER },
                },
              },
            },
          },
          excluded_papers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ['id', 'reason'],
              properties: {
                id: { type: Type.INTEGER },
                reason: { type: Type.STRING },
              },
            },
          },
          gaps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          next_steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          confidence: {
            type: Type.STRING,
            enum: ['high', 'medium', 'low'],
          },
        },
      };

      const response = await generateWithModelFallback({
        contents,
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema,
      });

      const responseText = response.text?.trim() || '{}';
      const parsedData = JSON.parse(responseText);

      res.json(parsedData);
    } catch (err: unknown) {
      console.error('Error reasoning with Gemini:', err);
      res.status(500).json({ error: formatApiError(err) });
    }
  });

  // In development, hook Vite middleware; in production, serve dist static files
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Research Paper Agent server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
