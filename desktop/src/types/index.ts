export type DimensionKey =
  | "writing"
  | "plot"
  | "character"
  | "worldbuilding"
  | "pacing"
  | "creativity"
  | "payoff";

export type ReferenceType = "positive" | "negative";

export interface FeatureItem {
  title: string;
  description: string;
}

export interface ProfilePreferences {
  keywords: string[];
  likes: FeatureItem[];
  dislikes: FeatureItem[];
  dimensionPreferences: Partial<Record<DimensionKey, string>>;
  weights: Partial<Record<DimensionKey, number>>;
  confidence: string;
}

export type ProfileStatus = "draft" | "generated";

export interface Profile {
  id: string;
  name: string;
  genre: string;
  customGenre: string | null;
  summary: string;
  preferences: ProfilePreferences;
  status: ProfileStatus;
  bookCount: number;
  evaluationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceBook {
  id: string;
  profileId: string;
  title: string;
  url: string;
  referenceType: ReferenceType;
  ratings: Partial<Record<DimensionKey, number>>;
  worstDimension: DimensionKey | null;
  secondWorstDimension: DimensionKey | null;
  ready: boolean;
  createdAt: string;
}

export interface EvaluationReport {
  bookTitle: string;
  author: string;
  genre: string;
  tags: string[];
  score: number;
  verdict: string;
  verdictNote: string;
  reasons: FeatureItem[];
  risks: FeatureItem[];
  quote: string;
  quoteSource: string;
  profileName: string;
  chapterRange: string;
  modelName: string;
  baseUrl: string;
  createdAt: string;
}

export interface EvaluationRecord {
  id: string;
  profileId: string;
  bookTitle: string;
  bookUrl: string;
  matchScore: number;
  chapterRange: string;
  report: EvaluationReport;
  status: string;
  modelName: string;
  createdAt: string;
}

export interface ModelConfig {
  configured: boolean;
  modelName: string;
  baseUrl: string;
  apiKeyMasked: string;
}

export interface Bootstrap {
  profiles: Profile[];
  modelConfig: ModelConfig;
  monthlyEvaluations: number;
}

export interface ProgressEvent {
  taskId: string;
  stage: string;
  stageIndex: number;
  totalStages: number;
  progress: number;
  message: string;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  latencyMs: number;
  modelName: string;
}

export interface CommandError {
  code: string;
  message: string;
}

export interface BookMeta {
  title: string;
  author: string;
  url: string;
}
