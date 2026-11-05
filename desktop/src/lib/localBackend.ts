import type {
  Bootstrap,
  DimensionKey,
  EvaluationRecord,
  FeatureItem,
  ModelConfig,
  Profile,
  ProfilePreferences,
  ReferenceBook,
} from "../types";
import { DIMENSIONS } from "./constants";
import { uid } from "./utils";

const STORAGE_KEY = "novelmatch_preview_db_v1";

interface LocalDatabase {
  profiles: Profile[];
  books: ReferenceBook[];
  evaluations: EvaluationRecord[];
  model: {
    modelName: string;
    baseUrl: string;
    apiKey: string;
    apiKeyMasked: string;
  };
}

interface CommandErrorShape {
  code: string;
  message: string;
}

function fail(code: string, message: string): never {
  const error: CommandErrorShape = { code, message };
  throw error;
}

function emptyDb(): LocalDatabase {
  return {
    profiles: [],
    books: [],
    evaluations: [],
    model: { modelName: "", baseUrl: "", apiKey: "", apiKeyMasked: "" },
  };
}

function loadDb(): LocalDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDb();
    const parsed = JSON.parse(raw) as LocalDatabase;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      books: Array.isArray(parsed.books) ? parsed.books : [],
      evaluations: Array.isArray(parsed.evaluations) ? parsed.evaluations : [],
      model: parsed.model ?? emptyDb().model,
    };
  } catch {
    return emptyDb();
  }
}

function saveDb(db: LocalDatabase) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function defaultPreferences(genre: string): ProfilePreferences {
  return {
    keywords: genre ? [genre] : [],
    likes: [],
    dislikes: [],
    dimensionPreferences: {},
    weights: {},
    confidence: "建立中",
  };
}

function hydrateProfile(db: LocalDatabase, profile: Profile): Profile {
  const books = db.books.filter((book) => book.profileId === profile.id);
  const evaluations = db.evaluations.filter(
    (item) => item.profileId === profile.id,
  );
  const preferences: ProfilePreferences = {
    ...defaultPreferences(profile.genre),
    ...(profile.preferences ?? {}),
    keywords: profile.preferences?.keywords ?? [profile.genre],
    likes: profile.preferences?.likes ?? [],
    dislikes: profile.preferences?.dislikes ?? [],
    dimensionPreferences: profile.preferences?.dimensionPreferences ?? {},
    weights: profile.preferences?.weights ?? {},
    confidence: profile.preferences?.confidence || "建立中",
  };
  return {
    ...profile,
    preferences,
    bookCount: books.length,
    evaluationCount: evaluations.length,
  };
}

function touchProfile(db: LocalDatabase, profileId: string) {
  const profile = db.profiles.find((item) => item.id === profileId);
  if (profile) {
    profile.updatedAt = new Date().toISOString();
  }
}

function ensureProfile(db: LocalDatabase, id: string): Profile {
  const profile = db.profiles.find((item) => item.id === id);
  if (!profile) fail("PROFILE_NOT_FOUND", "画像不存在或已被删除。");
  return profile as Profile;
}

function ensureBook(db: LocalDatabase, id: string): ReferenceBook {
  const book = db.books.find((item) => item.id === id);
  if (!book) fail("BOOK_NOT_FOUND", "参考小说不存在或已被删除。");
  return book as ReferenceBook;
}

function modelView(db: LocalDatabase): ModelConfig {
  const configured = Boolean(
    db.model.apiKey && db.model.modelName && db.model.baseUrl,
  );
  return {
    configured,
    modelName: db.model.modelName,
    baseUrl: db.model.baseUrl,
    apiKeyMasked: db.model.apiKeyMasked,
  };
}

function assertHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      fail("INVALID_URL", "小说链接需以 http:// 或 https:// 开头。");
    }
  } catch (error) {
    if ((error as CommandErrorShape).code) throw error;
    fail("INVALID_URL", "小说链接格式不正确，请检查后重试。");
  }
}

function titleFromUrl(value: string): string {
  try {
    const url = new URL(value);
    const last = url.pathname.split("/").filter(Boolean).pop();
    if (last) {
      const decoded = decodeURIComponent(last)
        .replace(/\.(html?|php|aspx?)$/i, "")
        .replace(/[-_]+/g, " ")
        .trim();
      if (decoded) return decoded;
    }
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "未命名作品";
  }
}

function monthlyCount(db: LocalDatabase): number {
  const now = new Date();
  return db.evaluations.filter((item) => {
    const date = new Date(item.createdAt);
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }).length;
}

export async function localBackend<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const db = loadDb();
  const profileId = String(args?.profileId ?? "");
  const bookId = String(args?.bookId ?? "");

  switch (command) {
    case "bootstrap": {
      const result: Bootstrap = {
        profiles: [...db.profiles]
          .map((profile) => hydrateProfile(db, profile))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        modelConfig: modelView(db),
        monthlyEvaluations: monthlyCount(db),
      };
      return result as T;
    }

    case "list_profiles": {
      const result = [...db.profiles]
        .map((profile) => hydrateProfile(db, profile))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return result as T;
    }

    case "get_profile": {
      const profile = ensureProfile(db, profileId);
      return hydrateProfile(db, profile) as T;
    }

    case "create_profile": {
      const name = String(args?.name ?? "").trim();
      const genre = String(args?.genre ?? "").trim();
      const customGenre = String(args?.customGenre ?? "").trim();
      if (!name) fail("VALIDATION", "请填写画像名称。");
      if (!genre) fail("VALIDATION", "请选择一个偏好题材。");
      const now = new Date().toISOString();
      const profile: Profile = {
        id: `local-${uid("profile")}`,
        name,
        genre,
        customGenre: customGenre || null,
        summary: "",
        preferences: defaultPreferences(genre),
        status: "draft",
        bookCount: 0,
        evaluationCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      db.profiles.push(profile);
      saveDb(db);
      return profile as T;
    }

    case "update_profile": {
      const profile = ensureProfile(db, profileId);
      const name = String(args?.name ?? profile.name).trim();
      if (!name) fail("VALIDATION", "画像名称不能为空。");
      const summary = String(args?.summary ?? profile.summary);
      const keywords = Array.isArray(args?.keywords)
        ? (args?.keywords as string[]).filter(Boolean).slice(0, 8)
        : profile.preferences.keywords;
      profile.name = name;
      profile.summary = summary;
      profile.preferences = {
        ...profile.preferences,
        keywords: keywords.length ? keywords : profile.preferences.keywords,
      };
      profile.updatedAt = new Date().toISOString();
      saveDb(db);
      return hydrateProfile(db, profile) as T;
    }

    case "delete_profile": {
      ensureProfile(db, profileId);
      db.profiles = db.profiles.filter((item) => item.id !== profileId);
      db.books = db.books.filter((item) => item.profileId !== profileId);
      db.evaluations = db.evaluations.filter(
        (item) => item.profileId !== profileId,
      );
      saveDb(db);
      return undefined as T;
    }

    case "list_reference_books": {
      const result = db.books
        .filter((book) => book.profileId === profileId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return result as T;
    }

    case "add_reference_book": {
      ensureProfile(db, profileId);
      const url = String(args?.url ?? "").trim();
      const referenceType = String(args?.referenceType ?? "");
      if (!["positive", "negative"].includes(referenceType)) {
        fail("VALIDATION", "参考小说类型不正确。");
      }
      assertHttpUrl(url);
      const providedTitle = String(args?.title ?? "").trim();
      const book: ReferenceBook = {
        id: `local-${uid("book")}`,
        profileId,
        title: providedTitle || titleFromUrl(url),
        url,
        referenceType: referenceType as "positive" | "negative",
        ratings: {},
        worstDimension: null,
        secondWorstDimension: null,
        ready: false,
        createdAt: new Date().toISOString(),
      };
      db.books.push(book);
      touchProfile(db, profileId);
      saveDb(db);
      return book as T;
    }

    case "save_book_rating": {
      const book = ensureBook(db, bookId);
      const ratings = (args?.ratings ?? {}) as Record<string, number>;
      const nextRatings: Partial<Record<DimensionKey, number>> = {};
      for (const dimension of DIMENSIONS) {
        const value = Number(ratings[dimension.key]);
        if (!Number.isInteger(value) || value < 1 || value > 5) {
          fail("VALIDATION", `请为「${dimension.label}」选择 1–5 星。`);
        }
        nextRatings[dimension.key] = value;
      }
      book.ratings = nextRatings;
      book.ready = true;
      touchProfile(db, book.profileId);
      saveDb(db);
      return book as T;
    }

    case "save_book_negatives": {
      const book = ensureBook(db, bookId);
      const worst = String(args?.worstDimension ?? "") as DimensionKey;
      const second = String(args?.secondWorstDimension ?? "") as DimensionKey;
      const keys = DIMENSIONS.map((item) => item.key);
      if (!keys.includes(worst) || !keys.includes(second)) {
        fail("VALIDATION", "请选择两个有效的评价维度。");
      }
      if (worst === second) {
        fail("VALIDATION", "第一差和第二差的维度不能重复。");
      }
      book.worstDimension = worst;
      book.secondWorstDimension = second;
      book.ready = true;
      touchProfile(db, book.profileId);
      saveDb(db);
      return book as T;
    }

    case "delete_reference_book": {
      const book = ensureBook(db, bookId);
      db.books = db.books.filter((item) => item.id !== bookId);
      touchProfile(db, book.profileId);
      saveDb(db);
      return undefined as T;
    }

    case "list_evaluations": {
      const result = db.evaluations
        .filter((item) => item.profileId === profileId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return result as T;
    }

    case "get_evaluation": {
      const evaluation = db.evaluations.find(
        (item) => item.id === String(args?.evaluationId ?? ""),
      );
      if (!evaluation) fail("EVALUATION_NOT_FOUND", "评估记录不存在。");
      return evaluation as T;
    }

    case "delete_evaluation": {
      db.evaluations = db.evaluations.filter(
        (item) => item.id !== String(args?.evaluationId ?? ""),
      );
      saveDb(db);
      return undefined as T;
    }

    case "get_model_config":
      return modelView(db) as T;

    case "save_model_config": {
      const modelName = String(args?.modelName ?? "").trim();
      const baseUrl = String(args?.baseUrl ?? "")
        .trim()
        .replace(/\/+$/, "");
      const apiKey = String(args?.apiKey ?? "").trim();
      if (!modelName) fail("VALIDATION", "请填写要调用的模型名称。");
      if (!/^https?:\/\/\S+/i.test(baseUrl)) {
        fail("VALIDATION", "模型网址需以 http:// 或 https:// 开头。");
      }
      const nextKey = apiKey || db.model.apiKey;
      if (!nextKey) fail("VALIDATION", "请填写你的 API Key。");
      db.model = {
        modelName,
        baseUrl,
        apiKey: nextKey,
        apiKeyMasked:
          nextKey.length > 8
            ? `${nextKey.slice(0, 3)}••••${nextKey.slice(-4)}`
            : "••••",
      };
      saveDb(db);
      return modelView(db) as T;
    }

    case "clear_model_config": {
      db.model = emptyDb().model;
      saveDb(db);
      return modelView(db) as T;
    }

    case "test_model_connection":
    case "generate_profile":
    case "evaluate_novel": {
      fail(
        "PREVIEW_MODE",
        "浏览器预览模式不支持模型调用。请在 Tauri 桌面端中运行，并在模型设置里填写 API Key。",
      );
    }

    case "cancel_task":
      return true as T;

    case "fetch_book_meta": {
      const url = String(args?.url ?? "").trim();
      assertHttpUrl(url);
      return {
        title: titleFromUrl(url),
        author: "",
        url,
      } as T;
    }

    default:
      fail("UNKNOWN_COMMAND", `未知的本地命令：${command}`);
  }
}
