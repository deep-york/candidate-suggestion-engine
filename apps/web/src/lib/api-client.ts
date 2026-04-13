const API_BASE = '/api';

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export interface DocumentStatusResponse {
  id: string;
  status: string;
  error: string | null;
  updatedAt: string;
}

export interface UploadResponse {
  documentId: string;
  status: string;
}

export interface CandidateListItem {
  id: string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
  profile: Record<string, unknown>;
}

// Full candidate profile (for view/edit modal)
export interface CandidateSkill {
  name: string;
  category: string;
  proficiency?: string;
}
export interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate?: string;
  description: string;
  technologies: string[];
}
export interface Education {
  institution: string;
  degree: string;
  field: string;
  graduationYear?: number;
}
export interface CandidateProfile {
  fullName: string;
  email?: string;
  phone?: string;
  currentTitle?: string;
  totalYearsExperience: number;
  seniorityLevel?: string;
  skills: CandidateSkill[];
  workExperience: WorkExperience[];
  education: Education[];
  certifications: string[];
  languages: string[];
  summary: string;
}
export interface CandidateDetail {
  id: string;
  fullName: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
  profile: CandidateProfile;
}

export interface JobListItem {
  id: string;
  title: string;
  createdAt: string;
}

// Full JD detail (for view/edit modal)
export interface JobDescriptionProfile {
  jobTitle: string;
  department?: string;
  requiredSkills: Array<{ name: string; required: boolean }>;
  preferredSkills: string[];
  minYearsExperience: number;
  maxYearsExperience?: number;
  educationRequirement?: string;
  responsibilities: string[];
  industry?: string;
  seniority?: string;
  summary: string;
}

export interface JobDetail {
  id: string;
  title: string;
  createdAt: string;
  profile: JobDescriptionProfile;
}

export interface RankedCandidate {
  rank: number;
  candidateId: string;
  matchScore: number;
  vectorSimilarity: number;
  candidate: {
    fullName?: string;
    currentTitle?: string;
    totalYearsExperience?: number;
    skills: string[];
  };
  strengths: string[];
  gaps: string[];
  reasoning: string;
}

export interface MatchResponse {
  jobId: string;
  runId: string;
  ranAt: string;
  modelUsed: string;
  candidates: RankedCandidate[];
}

export const apiClient = {
  uploadFile(file: File, type: 'resume' | 'jd'): Promise<UploadResponse> {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    return request<UploadResponse>('/uploads', {
      method: 'POST',
      body: form,
      headers: {}, // Let browser set multipart Content-Type
    });
  },

  getUploadStatus(id: string): Promise<DocumentStatusResponse> {
    return request<DocumentStatusResponse>(`/uploads/${id}/status`);
  },

  listCandidates(
    page = 1,
    search = '',
  ): Promise<{ data: CandidateListItem[]; page: number; limit: number; total: number }> {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('q', search);
    return request(`/candidates?${params}`);
  },

  listJobs(
    search = '',
    page = 1,
  ): Promise<{ data: JobListItem[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('q', search);
    return request(`/jobs?${params}`);
  },

  getJob(id: string): Promise<JobDetail> {
    return request<JobDetail>(`/jobs/${id}`);
  },

  updateJob(
    id: string,
    data: { title?: string; profile?: Partial<JobDescriptionProfile> },
  ): Promise<{ id: string; title: string }> {
    return request(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteJob(id: string): Promise<{ deleted: string }> {
    return request(`/jobs/${id}`, { method: 'DELETE' });
  },

  deleteCandidate(id: string): Promise<{ deleted: string }> {
    return request(`/candidates/${id}`, { method: 'DELETE' });
  },

  getCandidate(id: string): Promise<CandidateDetail> {
    return request<CandidateDetail>(`/candidates/${id}`);
  },

  updateCandidate(
    id: string,
    data: { fullName?: string; email?: string; profile?: Partial<CandidateProfile> },
  ): Promise<{ id: string; fullName: string | null }> {
    return request(`/candidates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  runMatch(jobId: string): Promise<MatchResponse> {
    return request<MatchResponse>(`/jobs/${jobId}/match`, { method: 'POST' });
  },

  getLatestMatches(jobId: string): Promise<MatchResponse> {
    return request<MatchResponse>(`/jobs/${jobId}/matches`);
  },
};
