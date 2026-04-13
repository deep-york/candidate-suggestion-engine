import { z } from 'zod';

// ─── Document ─────────────────────────────────────────────────────
export const DocTypeSchema = z.enum(['resume', 'jd']);
export type DocType = z.infer<typeof DocTypeSchema>;

export const DocStatusSchema = z.enum([
  'pending',
  'parsing',
  'parsed',
  'extracting',
  'extracted',
  'embedding',
  'ready',
  'failed',
]);
export type DocStatus = z.infer<typeof DocStatusSchema>;

// ─── Candidate Profile ────────────────────────────────────────────
export const SkillSchema = z.object({
  name: z.string(),
  category: z.enum(['technical', 'soft', 'domain', 'tool', 'language']),
  proficiency: z
    .enum(['beginner', 'intermediate', 'advanced', 'expert'])
    .optional(),
});

export const WorkExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  description: z.string(),
  technologies: z.array(z.string()),
});

export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string(),
  graduationYear: z.number().optional(),
});

export const CandidateProfileSchema = z.object({
  fullName: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  currentTitle: z.string().optional(),
  totalYearsExperience: z.number(),
  seniorityLevel: z
    .enum(['junior', 'mid', 'senior', 'lead', 'principal', 'c-level'])
    .optional(),
  skills: z.array(SkillSchema),
  workExperience: z.array(WorkExperienceSchema),
  education: z.array(EducationSchema),
  certifications: z.array(z.string()),
  languages: z.array(z.string()),
  summary: z.string(),
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

// ─── Job Description Profile ─────────────────────────────────────
export const RequiredSkillSchema = z.object({
  name: z.string(),
  required: z.boolean(),
});

export const JobDescriptionProfileSchema = z.object({
  jobTitle: z.string(),
  department: z.string().optional(),
  requiredSkills: z.array(RequiredSkillSchema),
  preferredSkills: z.array(z.string()),
  minYearsExperience: z.number(),
  maxYearsExperience: z.number().optional(),
  educationRequirement: z.string().optional(),
  responsibilities: z.array(z.string()),
  industry: z.string().optional(),
  seniority: z.enum([
    'junior',
    'mid',
    'senior',
    'lead',
    'principal',
    'c-level',
  ]),
  summary: z.string(),
});

export type JobDescriptionProfile = z.infer<typeof JobDescriptionProfileSchema>;

// ─── Match Result ─────────────────────────────────────────────────
export const RankedCandidateSchema = z.object({
  rank: z.number().int().min(1).max(10),
  candidateId: z.string().uuid(),
  matchScore: z.number().min(0).max(1),
  vectorSimilarity: z.number().min(0).max(1),
  candidate: z.object({
    fullName: z.string().optional(),
    currentTitle: z.string().optional(),
    totalYearsExperience: z.number().optional(),
    skills: z.array(z.string()),
  }),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  reasoning: z.string(),
});

export const MatchResultsSchema = z.array(RankedCandidateSchema);
export type RankedCandidate = z.infer<typeof RankedCandidateSchema>;
export type MatchResults = z.infer<typeof MatchResultsSchema>;

// ─── API Response shapes ──────────────────────────────────────────
export interface UploadResponse {
  documentId: string;
  status: DocStatus;
}

export interface MatchResponse {
  jobId: string;
  runId: string;
  ranAt: string;
  modelUsed: string;
  candidates: RankedCandidate[];
}
