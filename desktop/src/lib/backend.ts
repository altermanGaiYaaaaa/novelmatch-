import type {
  Bootstrap,
  BookMeta,
  CommandError,
  DimensionKey,
  EvaluationRecord,
  ModelConfig,
  Profile,
  ProgressEvent,
  ReferenceBook,
  TestConnectionResult,
} from "../types";
import { call, subscribe } from "./api";

export const backend = {
  bootstrap: () => call<Bootstrap>("bootstrap"),

  listProfiles: () => call<Profile[]>("list_profiles"),

  getProfile: (profileId: string) =>
    call<Profile>("get_profile", { profileId }),

  createProfile: (name: string, genre: string, customGenre?: string) =>
    call<Profile>("create_profile", { name, genre, customGenre }),

  updateProfile: (
    profileId: string,
    payload: { name: string; summary: string; keywords: string[] },
  ) => call<Profile>("update_profile", { profileId, ...payload }),

  deleteProfile: (profileId: string) =>
    call<void>("delete_profile", { profileId }),

  listBooks: (profileId: string) =>
    call<ReferenceBook[]>("list_reference_books", { profileId }),

  addBook: (
    profileId: string,
    url: string,
    referenceType: "positive" | "negative",
    title?: string,
  ) =>
    call<ReferenceBook>("add_reference_book", {
      profileId,
      url,
      referenceType,
      title,
    }),

  saveRating: (bookId: string, ratings: Record<DimensionKey, number>) =>
    call<ReferenceBook>("save_book_rating", { bookId, ratings }),

  saveNegatives: (
    bookId: string,
    worstDimension: DimensionKey,
    secondWorstDimension: DimensionKey,
  ) =>
    call<ReferenceBook>("save_book_negatives", {
      bookId,
      worstDimension,
      secondWorstDimension,
    }),

  deleteBook: (bookId: string) =>
    call<void>("delete_reference_book", { bookId }),

  generateProfile: (profileId: string, taskId: string) =>
    call<Profile>("generate_profile", { profileId, taskId }),

  evaluateNovel: (profileId: string, url: string, taskId: string) =>
    call<EvaluationRecord>("evaluate_novel", { profileId, url, taskId }),

  cancelTask: (taskId: string) => call<boolean>("cancel_task", { taskId }),

  listEvaluations: (profileId: string) =>
    call<EvaluationRecord[]>("list_evaluations", { profileId }),

  getEvaluation: (evaluationId: string) =>
    call<EvaluationRecord>("get_evaluation", { evaluationId }),

  deleteEvaluation: (evaluationId: string) =>
    call<void>("delete_evaluation", { evaluationId }),

  getModelConfig: () => call<ModelConfig>("get_model_config"),

  saveModelConfig: (payload: {
    apiKey: string;
    modelName: string;
    baseUrl: string;
  }) => call<ModelConfig>("save_model_config", payload),

  clearModelConfig: () => call<ModelConfig>("clear_model_config"),

  testModelConnection: (payload: {
    apiKey?: string;
    modelName: string;
    baseUrl: string;
  }) => call<TestConnectionResult>("test_model_connection", payload),

  fetchBookMeta: (url: string) => call<BookMeta>("fetch_book_meta", { url }),

  onProfileProgress: (handler: (event: ProgressEvent) => void) =>
    subscribe<ProgressEvent>("profile-progress", handler),

  onEvaluationProgress: (handler: (event: ProgressEvent) => void) =>
    subscribe<ProgressEvent>("evaluation-progress", handler),
};

export function isCommandError(value: unknown): value is CommandError {
  return Boolean(
    value &&
      typeof value === "object" &&
      "code" in value &&
      "message" in value,
  );
}
