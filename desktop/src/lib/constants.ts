import {
  BookOpen,
  Building2,
  Compass,
  Ellipsis,
  Gamepad2,
  Heart,
  Layers,
  Mountain,
  Rocket,
  ScrollText,
  Search,
  Sparkles,
  Swords,
  type LucideIcon,
} from "lucide-react";
import type { DimensionKey } from "../types";

export interface DimensionMeta {
  key: DimensionKey;
  label: string;
  short: string;
  description: string;
}

export const DIMENSIONS: DimensionMeta[] = [
  {
    key: "writing",
    label: "文笔",
    short: "文笔",
    description: "语言表达、描写能力、行文流畅度与叙述风格",
  },
  {
    key: "plot",
    label: "剧情",
    short: "剧情",
    description: "情节设计、逻辑连贯性、冲突安排与故事推进",
  },
  {
    key: "character",
    label: "人物塑造",
    short: "人物",
    description: "人物性格、动机、成长与人物关系",
  },
  {
    key: "worldbuilding",
    label: "世界观",
    short: "世界观",
    description: "世界设定、规则体系、背景完整性与设定一致性",
  },
  {
    key: "pacing",
    label: "节奏",
    short: "节奏",
    description: "信息密度、推进速度、铺垫与高潮的安排",
  },
  {
    key: "creativity",
    label: "创意",
    short: "创意",
    description: "题材新颖性、设定独特性与情节创新",
  },
  {
    key: "payoff",
    label: "爽点",
    short: "爽点",
    description: "情绪反馈、期待兑现、成长反馈与冲突释放",
  },
];

export const DIMENSION_LABELS: Record<DimensionKey, string> = DIMENSIONS.reduce(
  (acc, item) => {
    acc[item.key] = item.label;
    return acc;
  },
  {} as Record<DimensionKey, string>,
);

export const RATING_LABELS: Record<number, string> = {
  1: "非常不满意",
  2: "不满意",
  3: "一般",
  4: "满意",
  5: "非常满意",
};

export interface GenreMeta {
  name: string;
  subtitle: string;
  icon: LucideIcon;
}

export const GENRES: GenreMeta[] = [
  { name: "玄幻", subtitle: "东方幻想 · 升级体系", icon: Sparkles },
  { name: "仙侠", subtitle: "修真问道 · 宗门江湖", icon: Mountain },
  { name: "都市", subtitle: "现实背景 · 都市生活", icon: Building2 },
  { name: "历史", subtitle: "朝代风云 · 权谋争锋", icon: ScrollText },
  { name: "科幻", subtitle: "未来科技 · 星际想象", icon: Rocket },
  { name: "悬疑", subtitle: "推理探案 · 谜题反转", icon: Search },
  { name: "言情", subtitle: "情感关系 · 人物成长", icon: Heart },
  { name: "武侠", subtitle: "江湖侠义 · 刀光剑影", icon: Swords },
  { name: "游戏竞技", subtitle: "虚拟世界 · 战队成长", icon: Gamepad2 },
  { name: "其他", subtitle: "尚未归类的偏好", icon: Ellipsis },
];

export function genreIcon(genre: string): LucideIcon {
  return GENRES.find((item) => item.name === genre)?.icon ?? Compass;
}

const GENRE_TONES: Record<string, string> = {
  玄幻: "bg-[#F3F0FF] text-[#5B4BD6]",
  仙侠: "bg-[#F3F0FF] text-[#5B4BD6]",
  都市: "bg-[#F1F7F4] text-[#4C8069]",
  历史: "bg-[#FBF4EA] text-[#A57436]",
  科幻: "bg-[#EEF4FF] text-[#4B6DB5]",
  悬疑: "bg-[#F1F5F9] text-[#5C6B80]",
  言情: "bg-[#FFF2F5] text-[#B65A78]",
  武侠: "bg-[#F4F3EE] text-[#776B46]",
  游戏竞技: "bg-[#F0F4FF] text-[#5669B6]",
  其他: "bg-[#F4F1FF] text-[#5B4BD6]",
};

export function genreTone(genre: string): string {
  return GENRE_TONES[genre] ?? "bg-[#F4F1FF] text-[#5B4BD6]";
}

export const APP_NAME = "NovelMatch";
export const APP_TAGLINE = "Taste Intelligence";
export const MAX_PROFILE_NAME = 20;
export const MAX_KEYWORDS = 8;
