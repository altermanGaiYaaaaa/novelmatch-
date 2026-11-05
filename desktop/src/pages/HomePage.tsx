import { useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  PencilLine,
  Plus,
  ScanText,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Topbar } from "../components/layout/Topbar";
import { Button } from "../components/ui/Button";
import { useAppStore } from "../stores/appStore";
import { genreIcon, genreTone } from "../lib/constants";
import { formatDate } from "../lib/utils";

const steps = [
  {
    icon: PencilLine,
    no: "01",
    title: "记录喜欢与不喜欢",
    text: "添加读过的小说，标记打动你的部分，也标记让你弃书的瞬间。",
  },
  {
    icon: ScanText,
    no: "02",
    title: "提炼个人品味画像",
    text: "AI 归纳你的偏好关键词、喜欢和不喜欢的特征，形成可解释的阅读画像。",
  },
  {
    icon: Target,
    no: "03",
    title: "评估下一本书",
    text: "粘贴小说链接，得到匹配度、推荐理由和可能踩中的雷点。",
  },
];

export function HomePage() {
  const profiles = useAppStore((state) => state.profiles);
  const refreshProfiles = useAppStore((state) => state.refreshProfiles);
  const navigate = useNavigate();
  const howRef = useRef<HTMLElement>(null);
  const hasProfiles = profiles.length > 0;

  useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  return (
    <>
      <Topbar
        breadcrumb={[{ label: "首页", to: "/" }, { label: "开始使用" }]}
      />
      <main className="mx-auto w-full max-w-[1220px] flex-1 px-9 pb-16 pt-10">
        <section className="mx-auto max-w-[780px] text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E2FA] bg-white px-3 py-1.5 text-[11.5px] font-medium text-[#6355B8] shadow-[0_4px_12px_-8px_rgba(91,75,214,0.6)]">
            <Sparkles className="h-[13px] w-[13px] text-[#6C5CE7]" />
            NovelMatch · AI 个性化小说筛选
          </span>
          <h1 className="mt-6 text-[38px] font-semibold leading-[1.28] tracking-[-0.025em] text-[#1C1A2A]">
            只读对味的小说<span className="text-[#6C5CE7]">。</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[590px] text-[14.5px] leading-7 text-[#6F6B82]">
            从你喜欢与讨厌的小说中，提炼出独属于你的阅读品味，
            <br className="hidden sm:block" />
            再据此判断下一本是否值得打开。
          </p>
        </section>

        {!hasProfiles ? (
          <section className="relative mt-10 overflow-hidden rounded-[24px] border border-[#E9E7F2] bg-white shadow-panel">
            <div className="pointer-events-none absolute -right-24 -top-28 h-[340px] w-[340px] rounded-full bg-[#F1EDFF] blur-[10px]" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-[220px] w-[220px] rounded-full bg-[#F7F5FF]" />
            <div className="relative grid items-center gap-8 p-10 lg:grid-cols-[1.02fr_0.98fr] lg:p-12">
              <div className="max-w-[500px]">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#E6E0FB] bg-[#F6F3FF] text-[#5B4BD6]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-[22px] font-semibold leading-8 tracking-[-0.01em] text-[#232034]">
                  还没有建立你的第一套阅读画像
                </h2>
                <p className="mt-3 text-[13.5px] leading-6 text-[#726E84]">
                  选一个你最常读的题材，告诉 NovelMatch 你偏爱什么。之后再补充喜欢和不喜欢的小说，画像会随着你的选择越来越准。
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#5B4BD6] px-5 text-[13.5px] font-medium text-white shadow-[0_12px_24px_-12px_rgba(91,75,214,0.95)] transition hover:bg-[#4C3DC4]"
                    to="/create"
                  >
                    创建我的画像
                    <ArrowRight className="h-[15px] w-[15px]" />
                  </Link>
                  <Button
                    className="h-11"
                    onClick={() =>
                      howRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      })
                    }
                    variant="secondary"
                  >
                    它是如何工作的
                  </Button>
                </div>
                <p className="mt-5 flex items-center gap-1.5 text-[11.5px] text-[#9B97AC]">
                  <ShieldCheck className="h-[14px] w-[14px] text-[#8C87A0]" />
                  画像只保存在你的电脑中，可随时编辑或删除
                </p>
              </div>

              <div className="relative mx-auto h-[292px] w-full max-w-[380px] select-none">
                <div className="absolute left-2 top-7 h-[224px] w-[188px] -rotate-[8deg] rounded-2xl border border-[#E9E4FA] bg-[#F7F4FF] p-4 shadow-[0_16px_30px_-24px_rgba(58,44,120,0.5)]">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-md bg-[#E3DBFF]" />
                    <span className="h-2 w-16 rounded-full bg-[#DCD4F5]" />
                  </div>
                  <div className="mt-5 space-y-2.5">
                    <div className="h-2 w-full rounded-full bg-[#E8E1FA]" />
                    <div className="h-2 w-4/5 rounded-full bg-[#EDE7FB]" />
                    <div className="h-2 w-11/12 rounded-full bg-[#EDE7FB]" />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    <span className="h-5 w-14 rounded-md bg-[#E6DEF9]" />
                    <span className="h-5 w-11 rounded-md bg-[#EFEAFA]" />
                    <span className="h-5 w-16 rounded-md bg-[#EFEAFA]" />
                  </div>
                </div>
                <div className="absolute right-0 top-2 h-[214px] w-[180px] rotate-[7deg] rounded-2xl border border-[#E8E5F0] bg-white p-4 shadow-[0_18px_34px_-26px_rgba(48,38,100,0.55)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-[#A09BAF]">
                      阅读偏好
                    </span>
                    <Sparkles className="h-3 w-3 text-[#B7ADEB]" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      ["世界观", 92, "w-[92%]", "bg-[#8172E8]"],
                      ["群像", 84, "w-[84%]", "bg-[#9A8DEE]"],
                      ["节奏", 76, "w-[76%]", "bg-[#B6ACF3]"],
                    ].map(([label, value, width, tone]) => (
                      <div key={String(label)}>
                        <div className="mb-1.5 flex justify-between text-[9px] text-[#8B86A0]">
                          <span>{label}</span>
                          <span>{value}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#F0EDF8]">
                          <div className={`h-full rounded-full ${width} ${tone}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="absolute left-1/2 top-1/2 w-[252px] -translate-x-1/2 -translate-y-[42%] rounded-2xl border border-[#EBE8F4] bg-white p-5 shadow-[0_26px_46px_-22px_rgba(52,40,110,0.38)]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10.5px] font-medium text-[#9A95AA]">
                      画像匹配预览
                    </span>
                    <span className="rounded-md bg-[#EDF9F2] px-1.5 py-0.5 text-[9.5px] font-medium text-[#1E9C62]">
                      高匹配
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#5B4BD6]">
                      <BookOpen className="h-[18px] w-[18px]" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#262236]">
                        玄幻严选
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-[#9590A6]">
                        玄幻 · 已分析 12 本
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {["世界观缜密", "升级有代价", "群像权谋"].map((tag) => (
                      <span
                        className="rounded-md bg-[#F6F3FF] px-2 py-1 text-[9.5px] text-[#6557C4]"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#F0EDF6] pt-3">
                    <span className="text-[10.5px] text-[#9691A7]">
                      下一本《归墟剑主》
                    </span>
                    <span className="text-[15px] font-semibold text-[#5B4BD6]">
                      88
                      <span className="ml-0.5 text-[9px] font-normal text-[#A09BB0]">
                        %
                      </span>
                    </span>
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-[#ECE9F5] bg-white px-3 py-1.5 text-[10.5px] text-[#6D6880] shadow-sm">
                  <CheckCircle2 className="h-[13px] w-[13px] text-[#25A56A]" />
                  基于你的真实偏好
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between px-1">
              <div>
                <h2 className="text-[17px] font-semibold text-[#2E2A40]">
                  继续你的阅读判断
                </h2>
                <p className="mt-1 text-[12px] text-[#8F8B9E]">
                  切换画像，或为下一本书补充新的口味参考。
                </p>
              </div>
              <Link
                className="flex items-center gap-1 text-[12px] font-medium text-[#6C5CE7] transition hover:text-[#4C3DC4]"
                to="/create"
              >
                新建画像
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {profiles.slice(0, 5).map((profile) => {
                const Icon = genreIcon(profile.genre);
                const target =
                  profile.status === "draft"
                    ? `/setup/${profile.id}`
                    : `/workspace/${profile.id}`;
                return (
                  <button
                    className="group flex text-left"
                    key={profile.id}
                    onClick={() => navigate(target)}
                    type="button"
                  >
                    <div className="flex w-full flex-col rounded-2xl border border-[#E8E6F1] bg-white p-5 shadow-[0_14px_34px_-32px_rgba(44,36,96,0.45)] transition hover:-translate-y-0.5 hover:border-[#D8CFF6] hover:shadow-[0_18px_38px_-30px_rgba(44,36,96,0.55)]">
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${genreTone(profile.genre)}`}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span
                          className={
                            profile.status === "draft"
                              ? "rounded-md bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-medium text-[#B4742E]"
                              : "rounded-md bg-[#EDF9F2] px-2 py-0.5 text-[10px] font-medium text-[#1E9C62]"
                          }
                        >
                          {profile.status === "draft" ? "待完成" : "可评估"}
                        </span>
                      </div>
                      <h3 className="mt-4 truncate text-[14px] font-semibold text-[#2B273C]">
                        {profile.name}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="rounded-md border border-[#E4DDFB] bg-[#F6F3FF] px-1.5 py-0.5 text-[10px] font-medium text-[#6557C4]">
                          {profile.customGenre || profile.genre}
                        </span>
                        <span className="text-[10.5px] text-[#9A95A9]">
                          {profile.bookCount} 本参考 · {profile.evaluationCount} 次评估
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 min-h-[40px] text-[11.5px] leading-5 text-[#7E798F]">
                        {profile.summary ||
                          "画像正在建立中，补充参考小说后即可生成专属阅读偏好。"}
                      </p>
                      <div className="mt-4 flex items-center justify-between border-t border-[#F2EFF8] pt-3">
                        <span className="text-[10px] text-[#A29DAD]">
                          {profile.status === "draft"
                            ? "继续完善参考小说"
                            : `更新于 ${formatDate(profile.updatedAt)}`}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-[#5B4BD6]">
                          {profile.status === "draft" ? "继续设置" : "进入工作台"}
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}

              <Link
                className="flex min-h-[214px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#DCD6EC] bg-[#FAF9FE] p-5 text-center transition hover:border-[#C9BFF4] hover:bg-[#F8F5FF]"
                to="/create"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#6C5CE7] shadow-sm">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="mt-3 text-[12.5px] font-medium text-[#5342D6]">
                  新建一套画像
                </span>
                <span className="mt-1 max-w-[180px] text-[10.5px] leading-5 text-[#9A95A9]">
                  按题材或阅读阶段分开管理，评估时切换使用。
                </span>
              </Link>
            </div>
          </section>
        )}

        <section className="mt-10 scroll-mt-24" id="how" ref={howRef}>
          <div className="mb-4 flex items-end justify-between px-1">
            <div>
              <h3 className="text-[15px] font-semibold text-[#2E2A40]">
                三步，把“好看”变成可判断的标准
              </h3>
              <p className="mt-1 text-[12px] text-[#8F8B9E]">
                不需要打分表，只需记录真实的阅读感受。
              </p>
            </div>
            <Link
              className="hidden items-center gap-1 text-[12px] font-medium text-[#6C5CE7] transition hover:text-[#4C3DC4] sm:flex"
              to="/create"
            >
              创建第一套画像
              <ArrowUpRight className="h-[13px] w-[13px]" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <div
                className="rounded-2xl border border-[#EBE9F2] bg-white p-5 shadow-[0_10px_24px_-24px_rgba(44,36,96,0.5)]"
                key={step.no}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F4F1FF] text-[#5B4BD6]">
                    <step.icon className="h-[17px] w-[17px]" />
                  </span>
                  <span className="text-[11px] font-medium tracking-[0.1em] text-[#D3CEDF]">
                    {step.no}
                  </span>
                </div>
                <h4 className="mt-4 text-[13.5px] font-semibold text-[#2B273C]">
                  {step.title}
                </h4>
                <p className="mt-1.5 text-[12px] leading-5 text-[#7E798F]">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#ECEBF2] px-9 py-5">
        <div className="mx-auto flex max-w-[1220px] items-center justify-between text-[11px] text-[#A09CAC]">
          <span>NovelMatch · 让每一次开书更有把握</span>
          <span className="flex items-center gap-4">
            <span>本地数据 · 仅自己可见</span>
            <span>V1.0</span>
          </span>
        </div>
      </footer>
    </>
  );
}
