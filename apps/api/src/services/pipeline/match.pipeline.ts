import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { jobDescriptions, candidates, matchResults } from '../../db/schema.js';
import {
  embedder,
  buildJDEmbeddingText,
} from '../embeddings/openai.embedder.js';
import { rerankCandidates } from '../ranking/llm-reranker.js';
import { cache } from '../../cache/redis.cache.js';
import type { MatchResponse, JobDescriptionProfile, CandidateProfile } from '../../types/shared.js';

// Candidates with cosine similarity below this value are excluded before LLM ranking.
// Setting to 0.25 eliminates clearly unrelated profiles (e.g. nutrition vs. software).
const MIN_SIMILARITY = 0.25;

// Maximum candidates to retrieve from the vector index before domain filtering.
const RECALL_LIMIT = 30;

// After domain overlap filtering, pass at most this many to the LLM re-ranker.
const RERANK_LIMIT = 20;

const CACHE_TTL_SECONDS = 30 * 60; // 30 minutes

// ── Domain / category pre-filter ─────────────────────────────────────────────
// Returns true if the candidate has at least one skill keyword that appears in
// the JD's required skills, preferred skills, job title, or industry.
// This is intentionally loose: a single matching keyword is enough to pass.
function hasRelevantDomainOverlap(
  candidate: CandidateProfile,
  jd: JobDescriptionProfile,
): boolean {
  // Build a normalised keyword set from the JD
  const jdKeywords = new Set<string>();

  const addKeywords = (text: string) => {
    text
      .toLowerCase()
      .split(/[\s,/()&+]+/)
      .filter((w) => w.length > 2)
      .forEach((w) => jdKeywords.add(w));
  };

  addKeywords(jd.jobTitle);
  if (jd.industry) addKeywords(jd.industry);
  if (jd.department) addKeywords(jd.department);
  jd.requiredSkills.forEach((s) => addKeywords(s.name));
  jd.preferredSkills.forEach((s) => addKeywords(s));

  // Common stop-words that shouldn't count as domain overlap
  const stopWords = new Set([
    'and', 'the', 'for', 'with', 'from', 'that', 'this', 'are', 'have',
    'not', 'but', 'its', 'was', 'all', 'can', 'who', 'been', 'one', 'has',
  ]);
  stopWords.forEach((w) => jdKeywords.delete(w));

  // Check candidate's skill names
  const candidateSkillNames = candidate.skills.map((s) => s.name.toLowerCase());
  for (const skillName of candidateSkillNames) {
    const words = skillName.split(/[\s,/()&+]+/).filter((w) => w.length > 2);
    if (words.some((w) => jdKeywords.has(w))) return true;
  }

  // Check candidate's title and summary for JD domain keywords
  const candidateText = [
    candidate.currentTitle ?? '',
    candidate.summary,
    ...candidate.workExperience.slice(0, 2).map((w) => w.title),
  ]
    .join(' ')
    .toLowerCase();

  for (const keyword of jdKeywords) {
    if (candidateText.includes(keyword)) return true;
  }

  return false;
}

export async function runMatchPipeline(jobId: string): Promise<MatchResponse> {
  // ── Cache check ──────────────────────────────────────────────────
  const cacheKey = `matches:${jobId}`;
  const cached = await cache.get<MatchResponse>(cacheKey);
  if (cached) return cached;

  // ── Load JD ──────────────────────────────────────────────────────
  const [jd] = await db
    .select()
    .from(jobDescriptions)
    .where(eq(jobDescriptions.id, jobId))
    .limit(1);

  if (!jd) throw new Error(`Job description ${jobId} not found`);

  // ── Ensure JD embedding ──────────────────────────────────────────
  let jdVector = jd.embedding;
  if (!jdVector) {
    const jdProfile = jd.profile as unknown as JobDescriptionProfile;
    const embeddingText = buildJDEmbeddingText(jdProfile);
    jdVector = await embedder.embed(embeddingText);
    await db
      .update(jobDescriptions)
      .set({ embedding: jdVector })
      .where(eq(jobDescriptions.id, jobId));
  }

  // ── pgvector cosine similarity recall (top-N, above similarity floor) ───────
  // The similarity floor (MIN_SIMILARITY) rejects clearly unrelated profiles
  // before the expensive LLM re-ranking step.
  const vectorString = `[${jdVector.join(',')}]`;

  const recalled = await db.execute<{
    id: string;
    profile: Record<string, unknown>;
    similarity: number;
  }>(sql`
    SELECT
      id,
      profile,
      1 - (embedding <=> ${vectorString}::vector) AS similarity
    FROM candidates
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${vectorString}::vector) >= ${MIN_SIMILARITY}
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${RECALL_LIMIT}
  `);

  if (recalled.length === 0) {
    throw new Error('No sufficiently similar candidates found. Try lowering the similarity threshold or adding more candidates.');
  }

  // ── Domain overlap filter ────────────────────────────────────────
  // Remove candidates whose background is entirely unrelated to the JD.
  // Any candidate that passes the keyword overlap check is kept.
  const jdProfile = jd.profile as unknown as JobDescriptionProfile;

  const domainFiltered = recalled.filter((row) => {
    const profile = row.profile as unknown as CandidateProfile;
    return hasRelevantDomainOverlap(profile, jdProfile);
  });

  // If domain filtering eliminated everything, fall back to the top similarity
  // results with a warning (prefer some result over an empty list).
  const pool = domainFiltered.length > 0 ? domainFiltered : recalled;

  const candidatesForRanking = pool.slice(0, RERANK_LIMIT).map((row) => ({
    id: row.id,
    vectorSimilarity: Number(row.similarity),
    profile: row.profile as unknown as CandidateProfile,
  }));
  let ranked = await rerankCandidates(jdProfile, candidatesForRanking).catch(
    () => {
      // Graceful fallback: use vector similarity order directly
      return candidatesForRanking.slice(0, 10).map((c, i) => ({
        rank: i + 1,
        candidateId: c.id,
        matchScore: c.vectorSimilarity,
        vectorSimilarity: c.vectorSimilarity,
        candidate: {
          fullName: c.profile.fullName,
          currentTitle: c.profile.currentTitle,
          totalYearsExperience: c.profile.totalYearsExperience,
          skills: c.profile.skills.map((s) => s.name),
        },
        strengths: [],
        gaps: [],
        reasoning: 'Ranked by semantic similarity (re-ranking unavailable).',
      }));
    },
  );

  // ── Persist result ────────────────────────────────────────────────
  const [saved] = await db
    .insert(matchResults)
    .values({
      jobId,
      results: ranked as unknown as Record<string, unknown>[],
    })
    .returning({ id: matchResults.id, runAt: matchResults.runAt });

  const response: MatchResponse = {
    jobId,
    runId: saved!.id,
    ranAt: saved!.runAt.toISOString(),
    modelUsed: 'gpt-4o',
    candidates: ranked,
  };

  // ── Cache result ──────────────────────────────────────────────────
  await cache.set(cacheKey, response, CACHE_TTL_SECONDS);

  return response;
}
