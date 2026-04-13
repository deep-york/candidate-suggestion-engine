import { zodResponseFormat } from 'openai/helpers/zod';
import { openai } from '../../lib/openai.js';
import { env } from '../../lib/env.js';
import {
  CandidateProfileSchema,
  JobDescriptionProfileSchema,
  type CandidateProfile,
  type JobDescriptionProfile,
} from '../../types/shared.js';

const RESUME_SYSTEM_PROMPT = `You are an expert resume parser.
Extract a structured candidate profile from the provided resume text.
Normalise job titles and skills (e.g. "JS" → "JavaScript", "k8s" → "Kubernetes").
Infer seniority level from total years of experience and titles held.
Write a rich, concise "summary" field (3-5 sentences) suitable for semantic embedding.
Never fabricate information. If a field cannot be determined, omit it.`;

const JD_SYSTEM_PROMPT = `You are an expert job description analyst.
Extract a structured job requirement profile from the provided job description text.
Normalise skill names (e.g. "JS" → "JavaScript").
Distinguish required vs preferred skills based on language ("must have" vs "nice to have").
Write a rich "summary" field (3-5 sentences) capturing the role's essence, suitable for semantic embedding.
Never fabricate information. Use sensible defaults only when explicitly stated.`;

export async function extractCandidateProfile(
  rawText: string,
): Promise<CandidateProfile> {
  const response = await openai.beta.chat.completions.parse({
    model: env.OPENAI_MODEL,
    messages: [
      { role: 'system', content: RESUME_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Resume text:\n\n${rawText.slice(0, 12_000)}`,
      },
    ],
    response_format: zodResponseFormat(CandidateProfileSchema, 'candidate_profile'),
    temperature: 0,
  });

  const parsed = response.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error('LLM extraction returned no parsed output');
  }
  return parsed;
}

export async function extractJobDescriptionProfile(
  rawText: string,
): Promise<JobDescriptionProfile> {
  const response = await openai.beta.chat.completions.parse({
    model: env.OPENAI_MODEL,
    messages: [
      { role: 'system', content: JD_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Job description text:\n\n${rawText.slice(0, 12_000)}`,
      },
    ],
    response_format: zodResponseFormat(
      JobDescriptionProfileSchema,
      'jd_profile',
    ),
    temperature: 0,
  });

  const parsed = response.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error('LLM extraction returned no parsed output');
  }
  return parsed;
}
