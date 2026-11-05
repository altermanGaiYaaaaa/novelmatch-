import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  CircleHelp,
  Cpu,
  LayoutDashboard,
  Library,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";
import { APP_NAME, APP_TAGLINE, genreIcon, genreTone } from "../../lib/constants";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../stores/appStore";

const navBase =
  "flex h-10 items-center gap-3 rounded-xl px-3 text-[13.5px] transition";
const navIdle = "text-[#5F5A72] hover:bg-[#F7F6FB] hover:text-[#2E2942]";
const navActive =
  "bg-[#F3F1FF] font-medium text-[#5342D6]";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const profiles = useAppStore((state) => state.profiles);
  const modelConfig = useAppStore((state) => state.modelConfig);
  const monthlyEvaluations = useAppStore((state) => state.monthlyEvaluations);
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  const setModelModalOpen = useAppStore((state) => state.setModelModalOpen);
  const setHelpModalOpen = useAppStore((state) => state.setHelpModalOpen);

  const routeProfile =
    location.pathname.match(/^\/(?:workspace|setup)\/([^/]+)/)?.[1] ?? null;
  const currentId = routeProfile ?? activeProfileId;
  const isHome = location.pathname === "/";
  const isCreate = location.pathname.startsWith("/create");
  const workspaceTarget = currentId
    ? `/workspace/${currentId}`
    : profiles[0]
      ? `/workspace/${profiles[0].id}`
      : "/create";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[272px] flex-col border-r border-[#EAE9F2] bg-white">
      <Link
        className="flex h-[68px] shrink-0 items-center gap-2.5 border-b border-[#F0EFF6] px-6"
        to="/"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#6C5CE7] to-[#8B7CF6] text-white shadow-[0_8px_18px_-8px_rgba(91,75,214,0.85)]">
          <BookOpen className="h-[18px] w-[18px]" />
        </span>
        <span className="block">
          <span className="block text-[15px] font-semibold tracking-[-0.01em] text-[#211E31]">
            {APP_NAME}
          </span>
          <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.18em] text-[#A19DB0]">
            {APP_TAGLINE}
          </span>
        </span>
      </Link>

      <div className="shrink-0 px-4 pt-5">
        <Link
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#5B4BD6] text-[13px] font-medium text-white shadow-[0_10px_22px_-12px_rgba(91,75,214,0.95)] transition hover:bg-[#4C3DC4]"
          to="/create"
        >
          <Plus className="h-4 w-4" />
          新建画像
        </Link>
      </div>

      <nav className="shrink-0 px-4 pt-4">
        <div className="space-y-1">
          <Link
            className={cn(navBase, isHome ? navActive : navIdle)}
            to="/"
          >
            <LayoutDashboard className="h-[17px] w-[17px]" />
            <span>首页</span>
          </Link>
          <button
            className={cn(
              navBase,
              "w-full",
              !isHome && !isCreate ? navActive : navIdle,
            )}
            onClick={() => navigate(workspaceTarget)}
            type="button"
          >
            <Library className="h-[17px] w-[17px]" />
            <span>我的画像</span>
            <span className="ml-auto rounded-md bg-[#F1EFF7] px-1.5 py-0.5 text-[10px] font-medium text-[#8B869E]">
              {profiles.length}
            </span>
          </button>
          <Link
            className={cn(navBase, isCreate ? navActive : navIdle)}
            to="/create"
          >
            <Plus className="h-[17px] w-[17px]" />
            <span>新建画像</span>
          </Link>
          <button
            className={cn(navBase, "w-full", navIdle)}
            onClick={() => setModelModalOpen(true)}
            type="button"
          >
            <Cpu className="h-[17px] w-[17px]" />
            <span>模型设置</span>
            <span
              className={cn(
                "ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                modelConfig.configured
                  ? "bg-[#EAF8F0] text-[#258A5C]"
                  : "bg-[#F1EFF7] text-[#8B869E]",
              )}
            >
              {modelConfig.configured ? "已配置" : "未配置"}
            </span>
          </button>
        </div>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col px-4 pt-6">
        <div className="flex items-center justify-between px-3 pb-2.5">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#AAA6B8]">
            我的画像
          </p>
          <span className="rounded-md bg-[#F2F0F7] px-1.5 py-0.5 text-[10px] font-medium text-[#8B869E]">
            {profiles.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pb-4 scrollbar-none">
          {profiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E6E2F0] px-3 py-5 text-center">
              <p className="text-[11.5px] leading-5 text-[#9A95A9]">
                还没有画像
                <br />
                从选择一个题材开始
              </p>
            </div>
          ) : (
            profiles.map((profile) => {
              const Icon = genreIcon(profile.genre);
              const isActive = profile.id === currentId;
              return (
                <button
                  key={profile.id}
                  aria-pressed={isActive}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition",
                    isActive
                      ? "bg-[#F4F1FF] shadow-[inset_0_0_0_1px_#E4DEFF]"
                      : "hover:bg-[#F8F7FC]",
                  )}
                  onClick={() => navigate(`/workspace/${profile.id}`)}
                  type="button"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      genreTone(profile.genre),
                    )}
                  >
                    <Icon className="h-[15px] w-[15px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[12.5px] font-medium",
                        isActive ? "text-[#4E3FC7]" : "text-[#3A344C]",
                      )}
                    >
                      {profile.name}
                    </span>
                    <span className="mt-1 block truncate text-[10.5px] text-[#9A95A9]">
                      {profile.customGenre || profile.genre} ·{" "}
                      {profile.status === "draft"
                        ? "待完成"
                        : `${profile.bookCount} 本已分析`}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                      isActive ? "bg-[#6C5CE7]" : "bg-transparent",
                    )}
                  />
                </button>
              );
            })
          )}
        </div>

        <div className="mb-4 shrink-0 rounded-xl border border-[#EFEDF6] bg-[#FBFAFE] p-3.5">
          <div className="flex items-center gap-2 text-[11.5px] font-medium text-[#5A5470]">
            <Sparkles className="h-[13px] w-[13px] text-[#8D7FE0]" />
            本月评估
          </div>
          <p className="mt-1.5 text-[10.5px] leading-5 text-[#9893A7]">
            已生成 <span className="font-semibold text-[#5B4BD6]">{monthlyEvaluations}</span>{" "}
            份评估报告，全部记录只保存在本机。
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#F0EFF6] p-3">
        <button
          className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[12px] text-[#77728A] transition hover:bg-[#F7F6FB] hover:text-[#4E3FC7]"
          onClick={() => setHelpModalOpen(true)}
          type="button"
        >
          <CircleHelp className="h-[15px] w-[15px]" />
          使用指南
        </button>
        <button
          className="mt-1 flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-[12px] text-[#77728A] transition hover:bg-[#F7F6FB] hover:text-[#4E3FC7]"
          onClick={() => setModelModalOpen(true)}
          type="button"
        >
          <Cpu className="h-[15px] w-[15px]" />
          模型设置
          <span
            className={cn(
              "ml-auto rounded-md px-1.5 py-0.5 text-[10px] font-medium",
              modelConfig.configured
                ? "bg-[#EAF8F0] text-[#258A5C]"
                : "bg-[#F1EFF7] text-[#8B869E]",
            )}
          >
            {modelConfig.configured ? "已配置" : "未配置"}
          </span>
        </button>
        <div className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EDE9FF] text-[12px] font-semibold text-[#5B4BD6]">
            读
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-medium text-[#2C283C]">
              本地读者
            </p>
            <p className="text-[10.5px] text-[#9A96A9]">离线数据 · 仅自己可见</p>
          </div>
          <button
            aria-label="模型设置"
            className="ml-auto text-[#A6A2B4] transition hover:text-[#5B4BD6]"
            onClick={() => setModelModalOpen(true)}
            type="button"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
