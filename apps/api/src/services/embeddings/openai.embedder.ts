import { openai } from '../../lib/openai.js';
import { env } from '../../lib/env.js';
import type { IEmbeddingProvider } from './index.js';
import type { CandidateProfile, JobDescriptionProfile } from '../../types/shared.js';

export class OpenAIEmbedder implements IEmbeddingProvider {
  private readonly model = env.OPENAI_EMBEDDING_MODEL;

  async embed(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({
      model: this.model,
      input: text.slice(0, 8_000),
    });
    return response.data[0]!.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await openai.embeddings.create({
      model: this.model,
      input: texts.map((t) => t.slice(0, 8_000)),
    });
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }
}

// ─── Embedding text builders ──────────────────────────────────────
// We embed the LLM-synthesised summary + key structured fields rather
// than raw resume text. This produces cleaner, more consistent vectors.

export function buildCandidateEmbeddingText(profile: CandidateProfile): string {
  const skillNames = profile.skills.map((s) => s.name).join(', ');
  const titles = profile.workExperience
    .slice(0, 3)
    .map((w) => `${w.title} at ${w.company}`)
    .join('; ');
  const edu = profile.education
    .map((e) => `${e.degree} ${e.field} from ${e.institution}`)
    .join(', ');

  return [
    profile.summary,
    `Skills: ${skillNames}`,
    `Experience: ${profile.totalYearsExperience} years. ${titles}`,
    edu ? `Education: ${edu}` : '',
    profile.certifications.length
      ? `Certifications: ${profile.certifications.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildJDEmbeddingText(profile: JobDescriptionProfile): string {
  const required = profile.requiredSkills
    .filter((s) => s.required)
    .map((s) => s.name)
    .join(', ');
  const preferred = profile.preferredSkills.join(', ');

  return [
    profile.summary,
    `Role: ${profile.jobTitle} (${profile.seniority})`,
    `Required skills: ${required}`,
    preferred ? `Preferred skills: ${preferred}` : '',
    `Experience: ${profile.minYearsExperience}+ years`,
    profile.industry ? `Industry: ${profile.industry}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const embedder = new OpenAIEmbedder();
