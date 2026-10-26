import { Post, Business } from '../src/types';

export interface OliPlanStop {
  postId: string;
  businessId: string;
  businessName: string;
  businessCity: string;
  businessAddress: string;
  businessPhone?: string;
  businessWhatsapp?: string;
  time: string;
  activity: string;
  postTitle: string;
  imageUrl: string;
  cost: number;
  isUnconfirmedPrice?: boolean;
  whySelected: string;
  distanceFromPreviousKm?: number | null;
}

export type OliResponseType = 'plan' | 'search' | 'info';

export interface OliPlanResponse {
  type?: OliResponseType;
  spokenText: string;
  greeting?: string;
  planTitle?: string;
  summary?: string;
  day?: string;
  targetAudience?: string;
  personCount?: number;
  costPerPerson?: number;
  userBudget?: number;
  totalEstimatedCost?: number;
  savingsOrRemaining?: number;
  budgetStatus?: 'under_budget' | 'on_budget' | 'over_budget';
  hasUnconfirmedPrices?: boolean;
  stops?: OliPlanStop[];
  recommendations?: string[];
  alternativeOptions?: string[];
  isAlternativeSuggestion?: boolean;
  alternativeNotice?: string;
  requestedTopic?: string;
  // Search & info capabilities:
  searchQuery?: string;
  matchedBusinesses?: Business[];
  matchedPosts?: Post[];
  matchedBusinessIds?: string[];
  matchedPostIds?: string[];
  searchCategory?: string;
  targetMunicipality?: string;
  auditTrace?: OliAuditTrace;
}

export interface OliAuditStep {
  step: string;
  title: string;
  status: 'info' | 'success' | 'warning';
  details: string;
  data?: any;
}

export interface OliAuditTrace {
  rawPrompt: string;
  timestamp: string;
  executionMode: 'llm' | 'deterministic_fallback';
  modelUsed?: string;
  apiKeyPresent: boolean;
  intentDetected: 'search' | 'plan_creation' | 'plan_refinement';
  interpretation: {
    targetMunicipality: string;
    detectedTopic?: string;
    detectedAudience?: string;
    detectedBudget?: number;
    personCount?: number;
    isSpecificProductOrService?: boolean;
    isRefinementIntent?: boolean;
  };
  databaseFiltering: {
    totalBusinessesInCatalog: number;
    totalPostsInCatalog: number;
    businessesInTargetMunicipality: number;
    eligiblePostsAfterValidity: number;
    matchedBusinessesCount: number;
    matchedPostsCount: number;
    selectedEntities: Array<{ name: string; type: 'business' | 'post'; id: string; category?: string; city?: string }>;
  };
  steps: OliAuditStep[];
  antiHallucination: {
    allEntitiesVerifiedInCatalog: boolean;
    hallucinationsDetected: number;
    correctedEntities: string[];
  };
}

export interface GenerateOliPlanInput {
  userPrompt: string;
  currentCity?: string;
  userBudget?: number;
  previousPlan?: OliPlanResponse | null;
  messageHistory?: Array<{ sender: 'user' | 'oli'; text: string }>;
  catalogPosts: Post[];
  catalogBusinesses: Business[];
  referenceDate?: Date;
  apiKey?: string;
}

export interface TopicDefinition {
  words: string[];
  allowedCategoryIds: string[];
  excludedCategoryIds: string[];
  allowedPlanCategoryIds?: string[];
}
