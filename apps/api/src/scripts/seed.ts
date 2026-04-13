/**
 * Seed script — inserts dummy candidates, a job description, and a pre-built
 * top-10 match result directly into the DB.
 *
 * Run from inside the API container:
 *   bun run seed
 *
 * Or from the host (requires DATABASE_URL in .env):
 *   cd apps/api && bun run seed
 *
 * No OpenAI key required — all embeddings are random unit vectors.
 */

import { db } from '../db/index.js';
import { documents, candidates, jobDescriptions, matchResults } from '../db/schema.js';
import { sql } from 'drizzle-orm';

// ─── Helpers ──────────────────────────────────────────────────────

/** Generate a random 1536-dim unit vector (valid for cosine similarity). */
function randomUnitVector(dim = 1536): number[] {
  const v = Array.from({ length: dim }, () => Math.random() * 2 - 1);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

// ─── Dummy candidate data ─────────────────────────────────────────

const DUMMY_CANDIDATES = [
  {
    fullName: 'Alice Chen',
    email: 'alice.chen@example.com',
    currentTitle: 'Senior Software Engineer',
    yearsExp: 8,
    seniority: 'senior',
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker'],
    summary: 'Senior full-stack engineer with 8 years building scalable web applications in TypeScript and React.',
  },
  {
    fullName: 'Bob Martinez',
    email: 'bob.martinez@example.com',
    currentTitle: 'Lead Backend Engineer',
    yearsExp: 10,
    seniority: 'lead',
    skills: ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Kubernetes', 'GCP'],
    summary: 'Lead backend engineer specialising in Python microservices and cloud-native architecture.',
  },
  {
    fullName: 'Carol Patel',
    email: 'carol.patel@example.com',
    currentTitle: 'Principal Engineer',
    yearsExp: 13,
    seniority: 'principal',
    skills: ['TypeScript', 'Go', 'Kubernetes', 'Terraform', 'AWS', 'PostgreSQL'],
    summary: 'Principal engineer with 13 years leading platform and infrastructure engineering at scale.',
  },
  {
    fullName: 'David Kim',
    email: 'david.kim@example.com',
    currentTitle: 'Mid-Level Full Stack Developer',
    yearsExp: 4,
    seniority: 'mid',
    skills: ['JavaScript', 'Vue.js', 'Node.js', 'MongoDB', 'Docker'],
    summary: 'Mid-level full-stack developer with 4 years building product features in JavaScript ecosystems.',
  },
  {
    fullName: 'Eva Novak',
    email: 'eva.novak@example.com',
    currentTitle: 'Senior Frontend Engineer',
    yearsExp: 7,
    seniority: 'senior',
    skills: ['TypeScript', 'React', 'Next.js', 'GraphQL', 'Figma', 'TailwindCSS'],
    summary: 'Senior frontend engineer passionate about design systems and performant React applications.',
  },
  {
    fullName: 'Frank Osei',
    email: 'frank.osei@example.com',
    currentTitle: 'DevOps Engineer',
    yearsExp: 6,
    seniority: 'senior',
    skills: ['Kubernetes', 'Terraform', 'AWS', 'CI/CD', 'Docker', 'Prometheus'],
    summary: 'DevOps engineer with 6 years automating deployments and managing cloud infrastructure at scale.',
  },
  {
    fullName: 'Grace Liu',
    email: 'grace.liu@example.com',
    currentTitle: 'Software Engineer',
    yearsExp: 3,
    seniority: 'mid',
    skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Kafka', 'Docker'],
    summary: 'Backend engineer with 3 years building event-driven systems with Java and Spring Boot.',
  },
  {
    fullName: 'Hiro Tanaka',
    email: 'hiro.tanaka@example.com',
    currentTitle: 'Staff Engineer',
    yearsExp: 11,
    seniority: 'lead',
    skills: ['TypeScript', 'Rust', 'PostgreSQL', 'Kafka', 'AWS', 'System Design'],
    summary: 'Staff engineer with 11 years of experience in distributed systems and TypeScript platform engineering.',
  },
  {
    fullName: 'Isla Brown',
    email: 'isla.brown@example.com',
    currentTitle: 'Junior Developer',
    yearsExp: 1,
    seniority: 'junior',
    skills: ['JavaScript', 'React', 'HTML', 'CSS', 'Git'],
    summary: 'Junior developer with 1 year of experience building React frontends and eager to grow.',
  },
  {
    fullName: 'Jose Ramirez',
    email: 'jose.ramirez@example.com',
    currentTitle: 'Senior Data Engineer',
    yearsExp: 9,
    seniority: 'senior',
    skills: ['Python', 'Spark', 'dbt', 'Snowflake', 'Airflow', 'AWS'],
    summary: 'Senior data engineer with 9 years building scalable data pipelines and analytics platforms.',
  },
  {
    fullName: 'Karen White',
    email: 'karen.white@example.com',
    currentTitle: 'Engineering Manager',
    yearsExp: 12,
    seniority: 'lead',
    skills: ['TypeScript', 'Node.js', 'Leadership', 'Agile', 'AWS', 'PostgreSQL'],
    summary: 'Engineering manager with 12 years combining hands-on engineering with team leadership skills.',
  },
  {
    fullName: 'Leo Zhang',
    email: 'leo.zhang@example.com',
    currentTitle: 'Platform Engineer',
    yearsExp: 5,
    seniority: 'mid',
    skills: ['Go', 'Kubernetes', 'Helm', 'Terraform', 'AWS', 'Prometheus'],
    summary: 'Platform engineer with 5 years building internal developer platform tooling using Go and Kubernetes.',
  },
  {
    fullName: 'Maya Singh',
    email: 'maya.singh@example.com',
    currentTitle: 'Senior Software Engineer',
    yearsExp: 8,
    seniority: 'senior',
    skills: ['TypeScript', 'React', 'GraphQL', 'PostgreSQL', 'Node.js', 'AWS'],
    summary: 'Senior engineer with 8 years specialising in full-stack TypeScript applications and GraphQL APIs.',
  },
  {
    fullName: 'Noah Davis',
    email: 'noah.davis@example.com',
    currentTitle: 'Backend Engineer',
    yearsExp: 4,
    seniority: 'mid',
    skills: ['Ruby', 'Rails', 'PostgreSQL', 'Redis', 'Docker', 'Sidekiq'],
    summary: 'Backend engineer with 4 years of Ruby on Rails experience delivering high-quality web APIs.',
  },
  {
    fullName: 'Olivia Johnson',
    email: 'olivia.johnson@example.com',
    currentTitle: 'Cloud Architect',
    yearsExp: 14,
    seniority: 'principal',
    skills: ['AWS', 'Azure', 'Terraform', 'TypeScript', 'CDK', 'Security'],
    summary: 'Cloud architect with 14 years designing secure, multi-cloud infrastructure for enterprise clients.',
  },
] as const;

const JD_PROFILE = {
  jobTitle: 'Senior Software Engineer',
  department: 'Platform Engineering',
  requiredSkills: [
    { name: 'TypeScript', required: true },
    { name: 'Node.js', required: true },
    { name: 'PostgreSQL', required: true },
  ],
  preferredSkills: ['React', 'AWS', 'Docker', 'Kubernetes'],
  minYearsExperience: 5,
  maxYearsExperience: 12,
  seniority: 'senior',
  industry: 'Technology',
  responsibilities: [
    'Design and implement scalable backend services in TypeScript',
    'Collaborate with product and design teams',
    'Mentor junior engineers',
    'Contribute to platform architecture decisions',
  ],
  summary:
    'We are looking for a Senior Software Engineer with strong TypeScript and Node.js skills to join our platform team. You will design scalable APIs, work closely with cross-functional teams, and help mentor junior developers.',
};

// ─── Main ────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Starting seed...');

  // ── 1. Insert dummy documents ────────────────────────────────────
  const docRows = await db
    .insert(documents)
    .values(
      DUMMY_CANDIDATES.map((c) => ({
        filename: `${c.fullName.toLowerCase().replace(/ /g, '-')}-resume.pdf`,
        mimeType: 'application/pdf',
        storageKey: `seed/resume/${c.email}`,
        docType: 'resume' as const,
        status: 'ready' as const,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: documents.id });

  if (docRows.length === 0) {
    console.log('⚠️  Seed data already present — skipping candidate insertion.');
  } else {
    // ── 2. Insert dummy candidates with random embeddings ──────────
    await db.insert(candidates).values(
      DUMMY_CANDIDATES.map((c, i) => ({
        documentId: docRows[i]!.id,
        fullName: c.fullName,
        email: c.email,
        embeddingModel: 'seed-random',
        profile: {
          fullName: c.fullName,
          email: c.email,
          currentTitle: c.currentTitle,
          totalYearsExperience: c.yearsExp,
          seniorityLevel: c.seniority,
          skills: c.skills.map((name) => ({ name, category: 'technical', proficiency: 'advanced' })),
          workExperience: [],
          education: [],
          certifications: [],
          languages: ['English'],
          summary: c.summary,
        },
        embedding: randomUnitVector(),
      })),
    );
    console.log(`✅ Inserted ${DUMMY_CANDIDATES.length} dummy candidates.`);
  }

  // ── 3. Insert dummy job description ──────────────────────────────
  const [jdDoc] = await db
    .insert(documents)
    .values({
      filename: 'senior-software-engineer-jd.pdf',
      mimeType: 'application/pdf',
      storageKey: 'seed/jd/senior-software-engineer',
      docType: 'jd' as const,
      status: 'ready' as const,
    })
    .onConflictDoNothing()
    .returning({ id: documents.id });

  let jdId: string;

  if (!jdDoc) {
    console.log('⚠️  Job description already seeded — looking up existing ID.');
    const [existing] = await db.execute<{ id: string }>(sql`
      SELECT jd.id FROM job_descriptions jd
      JOIN documents d ON d.id = jd.document_id
      WHERE d.storage_key = 'seed/jd/senior-software-engineer'
      LIMIT 1
    `);
    jdId = existing!.id;
  } else {
    const [jd] = await db
      .insert(jobDescriptions)
      .values({
        documentId: jdDoc.id,
        title: JD_PROFILE.jobTitle,
        profile: JD_PROFILE as Record<string, unknown>,
        embedding: randomUnitVector(),
      })
      .returning({ id: jobDescriptions.id });

    jdId = jd!.id;
    console.log(`✅ Inserted dummy job description: "${JD_PROFILE.jobTitle}" (id: ${jdId})`);
  }

  // ── 4. Fetch candidate IDs and build a pre-built match result ────
  const allCandidates = await db
    .select({ id: candidates.id, fullName: candidates.fullName, profile: candidates.profile })
    .from(candidates)
    .limit(10);

  if (allCandidates.length === 0) {
    console.log('⚠️  No candidates found — skipping match result insertion.');
  } else {
    const prebuiltResults = allCandidates.slice(0, 10).map((c, i) => {
      const profile = c.profile as {
        currentTitle?: string;
        totalYearsExperience?: number;
        skills?: Array<{ name: string }>;
        summary?: string;
      };
      const score = parseFloat((0.95 - i * 0.04).toFixed(2));
      return {
        rank: i + 1,
        candidateId: c.id,
        matchScore: score,
        vectorSimilarity: parseFloat((score - 0.03).toFixed(2)),
        candidate: {
          fullName: c.fullName ?? undefined,
          currentTitle: profile.currentTitle,
          totalYearsExperience: profile.totalYearsExperience,
          skills: (profile.skills ?? []).slice(0, 5).map((s) => s.name),
        },
        strengths: [
          'Strong TypeScript background matching core requirement',
          'Relevant experience with Node.js and PostgreSQL',
          `${profile.totalYearsExperience ?? 0}+ years aligns with seniority expectation`,
        ],
        gaps: i > 5 ? ['No Kubernetes experience listed'] : [],
        reasoning: profile.summary ?? 'Candidate profile closely matches the job requirements based on semantic similarity.',
      };
    });

    await db
      .insert(matchResults)
      .values({
        jobId: jdId,
        results: prebuiltResults as unknown as Record<string, unknown>[],
        modelUsed: 'seed-prebuilt',
      })
      .onConflictDoNothing();

    console.log(`✅ Inserted pre-built top-${prebuiltResults.length} match result for job ${jdId}.`);
  }

  console.log('\n🎉 Seed complete!');
  console.log(`   Open http://localhost:3000/jobs to see the seeded job.`);
  console.log(`   Click "Run Match" (or the pre-built result is already loaded).`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
