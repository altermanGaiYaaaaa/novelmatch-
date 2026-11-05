import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CommandError } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeError(error: unknown): CommandError {
  if (typeof error === "object" && error !== null) {
    const maybe = error as Partial<CommandError> & { message?: string };
    if (typeof maybe.code === "string" && typeof maybe.message === "string") {
      return { code: maybe.code, message: maybe.message };
    }
    if (typeof maybe.message === "string") {
      return { code: "UNKNOWN", message: maybe.message };
    }
  }
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error) as Partial<CommandError>;
      if (parsed.code && parsed.message) {
        return { code: parsed.code, message: parsed.message };
      }
    } catch {
      // 保持原始字符串
    }
    return { code: "UNKNOWN", message: error };
  }
  return { code: "UNKNOWN", message: "发生未知错误，请稍后重试。" };
}

export function errorMessage(error: unknown): string {
  return normalizeError(error).message;
}

export function uid(prefix = "task"): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function scoreTone(score: number): {
  label: string;
  text: string;
  bg: string;
  border: string;
  ring: string;
} {
  if (score >= 85) {
    return {
      label: "高匹配",
      text: "text-[#1E9C62]",
      bg: "bg-[#EDF9F2]",
      border: "border-[#DDF3E8]",
      ring: "#5B4BD6",
    };
  }
  if (score >= 70) {
    return {
      label: "较匹配",
      text: "text-[#5B4BD6]",
      bg: "bg-[#F1EDFF]",
      border: "border-[#E6E0FB]",
      ring: "#6C5CE7",
    };
  }
  if (score >= 55) {
    return {
      label: "部分契合",
      text: "text-[#B4742E]",
      bg: "bg-[#FFF7ED]",
      border: "border-[#F5E3CC]",
      ring: "#C58A45",
    };
  }
  return {
    label: "契合度低",
    text: "text-[#B04A5D]",
    bg: "bg-[#FFF3F4]",
    border: "border-[#F5DCE0]",
    ring: "#C25867",
  };
}

export function concatDescription(title: string, description: string): string {
  return [title, description].filter(Boolean).join("：");
}
