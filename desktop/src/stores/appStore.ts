import { create } from "zustand";
import { backend } from "../lib/backend";
import { errorMessage } from "../lib/utils";
import type { ModelConfig, Profile } from "../types";

export type ToastIcon = "success" | "error" | "info" | "sparkles" | "bookmark";

interface ToastState {
  id: number;
  message: string;
  icon: ToastIcon;
}

interface AppState {
  profiles: Profile[];
  modelConfig: ModelConfig;
  monthlyEvaluations: number;
  activeProfileId: string | null;
  loading: boolean;
  bootError: string | null;
  toast: ToastState | null;
  modelModalOpen: boolean;
  helpModalOpen: boolean;
  init: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  refreshModel: () => Promise<void>;
  setActiveProfile: (id: string | null) => void;
  upsertProfile: (profile: Profile) => void;
  removeProfile: (id: string) => void;
  showToast: (message: string, icon?: ToastIcon) => void;
  hideToast: () => void;
  setModelModalOpen: (open: boolean) => void;
  setHelpModalOpen: (open: boolean) => void;
}

const emptyModel: ModelConfig = {
  configured: false,
  modelName: "",
  baseUrl: "",
  apiKeyMasked: "",
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  profiles: [],
  modelConfig: emptyModel,
  monthlyEvaluations: 0,
  activeProfileId: null,
  loading: true,
  bootError: null,
  toast: null,
  modelModalOpen: false,
  helpModalOpen: false,

  init: async () => {
    set({ loading: true, bootError: null });
    try {
      const data = await backend.bootstrap();
      set({
        profiles: data.profiles,
        modelConfig: data.modelConfig,
        monthlyEvaluations: data.monthlyEvaluations,
        activeProfileId:
          get().activeProfileId ?? data.profiles[0]?.id ?? null,
        loading: false,
      });
    } catch (error) {
      set({ loading: false, bootError: errorMessage(error) });
    }
  },

  refreshProfiles: async () => {
    try {
      const profiles = await backend.listProfiles();
      set((state) => ({
        profiles,
        activeProfileId:
          state.activeProfileId &&
          profiles.some((item) => item.id === state.activeProfileId)
            ? state.activeProfileId
            : profiles[0]?.id ?? null,
      }));
    } catch (error) {
      get().showToast(errorMessage(error), "error");
    }
  },

  refreshModel: async () => {
    try {
      const modelConfig = await backend.getModelConfig();
      set({ modelConfig });
    } catch (error) {
      get().showToast(errorMessage(error), "error");
    }
  },

  setActiveProfile: (id) => set({ activeProfileId: id }),

  upsertProfile: (profile) =>
    set((state) => {
      const exists = state.profiles.some((item) => item.id === profile.id);
      const profiles = exists
        ? state.profiles.map((item) => (item.id === profile.id ? profile : item))
        : [profile, ...state.profiles];
      return {
        profiles: profiles.sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
        activeProfileId: profile.id,
      };
    }),

  removeProfile: (id) =>
    set((state) => {
      const profiles = state.profiles.filter((item) => item.id !== id);
      return {
        profiles,
        activeProfileId:
          state.activeProfileId === id
            ? profiles[0]?.id ?? null
            : state.activeProfileId,
      };
    }),

  showToast: (message, icon = "success") => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: { id: Date.now(), message, icon } });
    toastTimer = setTimeout(() => {
      set({ toast: null });
    }, 2600);
  },

  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: null });
  },

  setModelModalOpen: (open) => set({ modelModalOpen: open }),
  setHelpModalOpen: (open) => set({ helpModalOpen: open }),
}));
