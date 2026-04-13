import { z } from 'zod';
import { openai } from '../../lib/openai.js';
import { env } from '../../lib/env.js';
import { MatchResultsSchema, type RankedCandidate } from '../../types/shared.js';
import type { JobDescriptionProfile, CandidateProfile } from '../../types/shared.js';

interface CandidateForRanking {
  id: string;
  vectorSimilarity: number;
  profile: CandidateProfile;
}

const RERANK_SYSTEM_PROMPT = `You are a senior technical recruiter with 20 years of experience.
Given a job description and a list of candidate profiles retrieved by semantic similarity,
re-rank and select the TOP 10 best-fitting candidates.

CRITICAL DOMAIN RULES — apply these BEFORE scoring:
1. If a candidate's background is in a completely different domain from the job (e.g., a nutrition
   specialist or healthcare worker for a software engineering role, or a software engineer for a
   medical/culinary role), their matchScore MUST be 0.0 and they MUST NOT appear in the top 10.
2. A candidate must have at least some overlap with the required skills or industry to be included.
3. The matchScore should reflect true holistic fit — a weak keyword match with no relevant
   experience should score below 0.30.

For each selected candidate provide:
- rank (1-10, 1 = best)
- candidateId (exact UUID from input)
- matchScore (0.0 to 1.0, your holistic assessment — must be ≥ 0.30 to be included)
- vectorSimilarity (pass through the provided value unchanged)
- candidate summary (fullName, currentTitle, totalYearsExperience, top skills array)
- strengths: 2-4 concise bullet points of why this candidate fits
- gaps: 1-3 concise bullet points of what they're missing (empty array if none)
- reasoning: one clear paragraph explaining the ranking decision

Be objective, precise, and focus on domain and technical fit. Penalise significant over/under-qualification.
If fewer than 10 candidates are genuinely relevant, return only the relevant ones.
Return valid JSON matching the schema.`;

export async function rerankCandidates(
  jdProfile: JobDescriptionProfile,
  candidates: CandidateForRanking[],
): Promise<RankedCandidate[]> {
  const input = candidates.map((c, i) => ({
    index: i + 1,
    candidateId: c.id,
    vectorSimilarity: c.vectorSimilarity,
    profile: c.profile,
  }));

  const response = await openai.beta.chat.completions.parse({
    model: env.OPENAI_MODEL,
    messages: [
      { role: 'system', content: RERANK_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          jobDescription: jdProfile,
          candidates: input,
        }),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'ranked_candidates',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            candidates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  rank: { type: 'number' },
                  candidateId: { type: 'string' },
                  matchScore: { type: 'number' },
                  vectorSimilarity: { type: 'number' },
                  candidate: {
                    type: 'object',
                    properties: {
                      fullName: { type: 'string' },
                      currentTitle: { type: 'string' },
                      totalYearsExperience: { type: 'number' },
                      skills: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['skills'],
                    additionalProperties: false,
                  },
                  strengths: { type: 'array', items: { type: 'string' } },
                  gaps: { type: 'array', items: { type: 'string' } },
                  reasoning: { type: 'string' },
                },
                required: [
                  'rank',
                  'candidateId',
                  'matchScore',
                  'vectorSimilarity',
                  'candidate',
                  'strengths',
                  'gaps',
                  'reasoning',
                ],
                additionalProperties: false,
              },
            },
          },
          required: ['candidates'],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.2,
  });

  const raw = response.choices[0]?.message.content;
  if (!raw) throw new Error('LLM re-ranker returned empty response');

  const parsed = JSON.parse(raw) as { candidates: unknown[] };
  return MatchResultsSchema.parse(parsed.candidates);
}
