import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CircleAlert,
  Clock3,
  Cpu,
  Info,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ScanText,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { Topbar } from "../components/layout/Topbar";
import { EvaluationHistoryModal } from "../components/evaluation/EvaluationHistoryModal";
import { EvaluationProgressModal } from "../components/evaluation/EvaluationProgressModal";
import { ProfileEditModal } from "../components/profile/ProfileEditModal";
import { Button, buttonClasses } from "../components/ui/Button";
import { backend } from "../lib/backend";
import { genreIcon, genreTone } from "../lib/constants";
import {
  cn,
  errorMessage,
  formatDate,
  formatDateTime,
  hostnameOf,
  scoreTone,
  uid,
} from "../lib/utils";
import { useAppStore } from "../stores/appStore";
import type { EvaluationRecord, Profile } from "../types";

export function WorkspacePage() {
  const { profileId = "" } = useParams();
  const navigate = useNavigate();
  const modelConfig = useAppStore((state) => state.modelConfig);
  const setModelModalOpen = useAppStore((state) => state.setModelModalOpen);
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const upsertProfile = useAppStore((state) => state.upsertProfile);
  const removeProfile = useAppStore((state) => state.removeProfile);
  const refreshProfiles = useAppStore((state) => state.refreshProfiles);
  const showToast = useAppStore((state) => state.showToast);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [novelUrl, setNovelUrl] = useState("");
  const [formError, setFormError] = useState("");

  const [evalOpen, setEvalOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(4);
  const [progressMessage, setProgressMessage] = useState("");
  const [evalError, setEvalError] = useState("");
  const taskRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const load = useCallback(async () => {
    const [nextProfile, nextEvaluations] = await Promise.all([
      backend.getProfile(profileId),
      backend.listEvaluations(profileId),
    ]);
    setProfile(nextProfile);
    setEvaluations(nextEvaluations);
    setActiveProfile(nextProfile.id);
    return nextProfile;
  }, [profileId, setActiveProfile]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError("");
    load()
      .catch((error) => {
        if (mounted) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      unlistenRef.current?.();
      unlistenRef.current = null;
    };
  }, [load]);

  const handleSaved = (next: Profile) => {
    setProfile(next);
    upsertProfile(next);
    setEditOpen(false);
  };

  const handleDeleted = async () => {
    removeProfile(profileId);
    setEditOpen(false);
    await refreshProfiles();
    navigate("/");
  };

  const handleHistoryDelete = async (record: EvaluationRecord) => {
    try {
      await backend.deleteEvaluation(record.id);
      setEvaluations((current) => current.filter((item) => item.id !== record.id));
      showToast("评估记录已删除", "info");
    } catch (error) {
      showToast(errorMessage(error), "error");
    }
  };

  const startEvaluation = async () => {
    if (!profile) return;
    const url = novelUrl.trim();
    if (!url) {
      setFormError("请先粘贴小说链接，再开始评估。");
      return;
    }
    if (!/^https?:\/\/\S+/i.test(url)) {
      setFormError("小说链接需以 http:// 或 https:// 开头。");
      return;
    }
    if (!modelConfig.configured) {
      setModelModalOpen(true);
      showToast("评估前请先完成模型设置", "error");
      return;
    }

    setFormError("");
    setEvalError("");
    setEvalOpen(true);
    setRunning(true);
    setStageIndex(0);
    setProgress(4);
    setProgressMessage("正在获取小说信息…");

    const taskId = uid("evaluation");
    taskRef.current = taskId;

    try {
      unlistenRef.current?.();
      unlistenRef.current = await backend.onEvaluationProgress((event) => {
        if (event.taskId !== taskId) return;
        setStageIndex(event.stageIndex);
        setProgress(event.progress);
        setProgressMessage(event.message);
      });

      const record = await backend.evaluateNovel(profile.id, url, taskId);
      if (taskRef.current !== taskId) return;
      setProgress(100);
      setEvaluations((current) => [
        record,
        ...current.filter((item) => item.id !== record.id),
      ]);
      showToast("评估报告已生成", "sparkles");
      setEvalOpen(false);
      await refreshProfiles();
      navigate(`/report/${record.id}`);
    } catch (error) {
      if (taskRef.current !== taskId) return;
      const err = error as { code?: string; message?: string };
      if (err.code === "CANCELLED") {
        setEvalOpen(false);
        showToast("已取消本次评估", "info");
      } else {
        setEvalError(errorMessage(error));
        setProgressMessage("");
      }
    } finally {
      if (taskRef.current === taskId) taskRef.current = null;
      unlistenRef.current?.();
      unlistenRef.current = null;
      setRunning(false);
    }
  };

  const cancelEvaluation = async () => {
    const taskId = taskRef.current;
    taskRef.current = null;
    if (taskId) {
      try {
        await backend.cancelTask(taskId);
      } catch {
        // 前端不再等待任务结果
      }
    }
    setRunning(false);
    setEvalOpen(false);
    showToast("已取消本次评估", "info");
  };

  if (loading) {
    return (
      <>
        <Topbar breadcrumb={[{ label: "画像工作台", to: "/" }, { label: "加载中" }]} />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-[12.5px] text-[#9691A6]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载画像…
          </div>
        </main>
      </>
    );
  }

  if (loadError || !profile) {
    return (
      <>
        <Topbar breadcrumb={[{ label: "画像工作台", to: "/" }, { label: "未找到" }]} />
        <main className="flex flex-1 items-center justify-center px-9">
          <div className="max-w-[420px] rounded-2xl border border-[#F5DCE0] bg-white p-7 text-center shadow-card">
            <CircleAlert className="mx-auto h-6 w-6 text-[#C25867]" />
            <h2 className="mt-3 text-[15px] font-semibold text-[#2B273C]">
              无法打开这套画像
            </h2>
            <p className="mt-2 text-[12px] leading-6 text-[#8D889C]">
              {loadError || "画像不存在或已被删除。"}
            </p>
            <Link className={`mt-5 ${buttonClasses("outline", "sm")}`} to="/">
              返回首页
            </Link>
          </div>
        </main>
      </>
    );
  }

  const Icon = genreIcon(profile.genre);
  const keywords = profile.preferences.keywords;
  const confidence = profile.preferences.confidence || "建立中";
  const recent = evaluations.slice(0, 3);

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "画像工作台", to: "/" },
          { label: profile.name },
        ]}
        actions={
          <>
            <Link
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[#E6E3EE] bg-white px-3 text-[12.5px] font-medium text-[#5E5971] transition hover:border-[#D5CDF6] hover:text-[#4E3FC7]"
              to={`/setup/${profile.id}`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              参考小说
            </Link>
            <button
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[#E6E3EE] bg-white px-3 text-[12.5px] font-medium text-[#5E5971] transition hover:border-[#D5CDF6] hover:text-[#4E3FC7]"
              onClick={() => setEditOpen(true)}
              type="button"
            >
              <Pencil className="h-3.5 w-3.5" />
              编辑画像
            </button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-[1220px] flex-1 px-9 pb-16 pt-7">
        <section className="relative overflow-hidden rounded-2xl border border-[#E8E6F1] bg-white shadow-[0_20px_50px_-38px_rgba(44,36,96,0.5)]">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#6C5CE7] via-[#9A8DEE] to-[#D8CFFB]" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-[260px] w-[260px] rounded-full bg-[#F6F3FF]" />
          <div className="relative p-6 lg:p-7">
            <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
              <div className="flex items-start gap-4">
                <span
                  className={cn(
                    "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border border-[#E8E2FC]",
                    genreTone(profile.genre),
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#211E31]">
                      {profile.name}
                    </h1>
                    <span className="rounded-md border border-[#E4DDFB] bg-[#F6F3FF] px-2 py-0.5 text-[10.5px] font-medium text-[#6557C4]">
                      {profile.customGenre || profile.genre}
                    </span>
                    {profile.status === "generated" ? (
                      <span className="flex items-center gap-1 rounded-md bg-[#EEF9F3] px-2 py-0.5 text-[10.5px] font-medium text-[#268B5D]">
                        <span className="h-1 w-1 rounded-full bg-[#34A874]" />
                        当前使用
                      </span>
                    ) : (
                      <span className="rounded-md bg-[#FFF7ED] px-2 py-0.5 text-[10.5px] font-medium text-[#B4742E]">
                        待完善
                      </span>
                    )}
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#9691A6]">
                    <span>
                      最近更新：
                      <span className="text-[#6F6A80]">{formatDate(profile.updatedAt)}</span>
                    </span>
                    <span className="text-[#D6D2E0]">·</span>
                    <span>画像 ID：{profile.id.slice(0, 16)}</span>
                  </p>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-3 divide-x divide-[#F0EDF6] rounded-xl border border-[#F0EDF6] bg-[#FCFBFE] px-2 py-3 xl:min-w-[318px]">
                <div className="px-4 text-center">
                  <p className="text-[16px] font-semibold tabular-nums text-[#2B273C]">
                    {profile.bookCount}
                    <span className="ml-0.5 text-[10px] font-normal text-[#A29DAF]">本</span>
                  </p>
                  <p className="mt-1 text-[10px] text-[#918CA2]">参考作品</p>
                </div>
                <div className="px-4 text-center">
                  <p className="text-[16px] font-semibold text-[#2B273C]">{confidence}</p>
                  <p className="mt-1 text-[10px] text-[#918CA2]">画像置信度</p>
                </div>
                <div className="px-4 text-center">
                  <p className="text-[16px] font-semibold tabular-nums text-[#2B273C]">
                    {keywords.length}
                    <span className="ml-0.5 text-[10px] font-normal text-[#A29DAF]">个</span>
                  </p>
                  <p className="mt-1 text-[10px] text-[#918CA2]">偏好关键词</p>
                </div>
              </div>
            </div>

            {profile.status === "draft" ? (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#F0E8D8] bg-[#FFFBF4] px-4 py-3.5">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#B4742E]" />
                  <div>
                    <p className="text-[12px] font-medium text-[#8E5E26]">
                      这套画像还没有生成阅读品味总结
                    </p>
                    <p className="mt-0.5 text-[10.5px] leading-5 text-[#A98354]">
                      补充参考小说和评价后，AI 才能归纳你的偏好。
                    </p>
                  </div>
                </div>
                <Link
                  className={buttonClasses("primary", "sm")}
                  to={`/setup/${profile.id}`}
                >
                  继续完善
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_274px]">
                <div className="rounded-xl border border-[#F2EFF8] bg-[#FBFAFE] p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#F0EBFF] text-[#6C5CE7]">
                      <ScanText className="h-3 w-3" />
                    </span>
                    <h2 className="text-[11.5px] font-semibold tracking-wide text-[#5B5471]">
                      阅读品味总结
                    </h2>
                    <button
                      className="ml-auto text-[10px] text-[#A6A1B2] transition hover:text-[#5B4BD6]"
                      onClick={() => setEditOpen(true)}
                      type="button"
                    >
                      AI 归纳 · 可编辑
                    </button>
                  </div>
                  <p className="mt-3 text-[13px] leading-[1.85] text-[#4F4A61]">
                    {profile.summary}
                  </p>
                </div>
                <div className="rounded-xl border border-[#F2EFF8] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[11.5px] font-semibold tracking-wide text-[#5B5471]">
                      偏好关键词
                    </h2>
                    <span className="text-[10px] text-[#A6A1B2]">按强度排序</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {keywords.length ? (
                      keywords.map((keyword) => (
                        <span
                          className="inline-flex items-center rounded-lg border border-[#E6E1FA] bg-[#F7F5FF] px-2.5 py-1 text-[11px] font-medium text-[#5A4BC8]"
                          key={keyword}
                        >
                          {keyword}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-[#A29DAD]">暂无关键词</span>
                    )}
                  </div>
                  <p className="mt-3 text-[10.5px] leading-5 text-[#9E99AC]">
                    这些关键词由你的作品记录与评价自动归纳，可随画像一起编辑。
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {profile.status === "generated" ? (
          <>
            <section className="mt-6">
              <div className="mb-3.5 flex flex-wrap items-end justify-between gap-2 px-0.5">
                <div>
                  <h2 className="text-[14.5px] font-semibold text-[#2C283C]">
                    你的口味边界
                  </h2>
                  <p className="mt-1 text-[11.5px] text-[#918CA2]">
                    NovelMatch 会优先寻找命中左侧特征的作品，并对右侧风险保持敏感。
                  </p>
                </div>
                <span className="flex items-center gap-1.5 text-[10.5px] text-[#9B96A9]">
                  <RefreshCw className="h-3 w-3" />
                  依据 {profile.bookCount} 本作品记录生成
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <FeatureCard
                  emptyText="还没有记录喜欢的特征，补充正向参考小说后会自动沉淀。"
                  icon="like"
                  items={profile.preferences.likes}
                  title="喜欢的特征"
                  hint="看到这些，通常会更投入"
                />
                <FeatureCard
                  emptyText="还没有记录不喜欢的特征，标记弃书原因后会形成避雷清单。"
                  icon="dislike"
                  items={profile.preferences.dislikes}
                  title="不喜欢的特征"
                  hint="出现这些，容易让你弃书"
                />
              </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border border-[#E8E6F1] bg-white shadow-card">
              <div className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#5B4BD6]">
                      <Link2 className="h-[17px] w-[17px]" />
                    </span>
                    <div>
                      <h2 className="text-[15px] font-semibold text-[#2A263B]">
                        评估一本新小说
                      </h2>
                      <p className="mt-1 text-[11.5px] leading-5 text-[#8D889C]">
                        粘贴作品链接，看看它与你当前阅读品味的匹配程度。
                      </p>
                    </div>
                  </div>
                  <span className="rounded-lg border border-[#EAE6F6] bg-[#FBFAFE] px-2.5 py-1 text-[10.5px] text-[#7B7492]">
                    基于「{profile.name}」
                  </span>
                </div>

                <form
                  className="mt-5 flex flex-col gap-2.5 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void startEvaluation();
                  }}
                >
                  <div className="relative flex-1">
                    <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8A3B6]" />
                    <input
                      autoComplete="off"
                      className={cn(
                        "h-11 w-full rounded-xl border bg-[#FCFCFE] pl-10 pr-3.5 text-[12.5px] text-[#2A263B] outline-none transition placeholder:text-[#AAA5B7] focus:border-[#8E80E8] focus:bg-white focus:ring-4 focus:ring-[#EFEBFF]",
                        formError ? "border-[#E45B6B]" : "border-[#E4E1EC]",
                      )}
                      onChange={(event) => {
                        setNovelUrl(event.target.value);
                        setFormError("");
                      }}
                      placeholder="粘贴小说链接，例如 https://www.qidian.com/book/1043210/"
                      value={novelUrl}
                    />
                  </div>
                  <Button className="h-11" disabled={running} type="submit">
                    {running ? "评估中" : "评估"}
                    {running ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </form>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[10.5px] text-[#9E99AC]">
                    <Info className="h-3 w-3" />
                    支持起点、晋江、番茄等平台公开链接，分析范围默认前十章
                  </p>
                  <button
                    className="text-[10.5px] font-medium text-[#6C5CE7] transition hover:text-[#4C3DC4]"
                    onClick={() => {
                      setNovelUrl("https://www.qidian.com/book/1043210/");
                      setFormError("");
                    }}
                    type="button"
                  >
                    填入示例链接
                  </button>
                </div>

                {formError ? (
                  <p className="mt-2 text-[11px] text-[#B04A5D]">{formError}</p>
                ) : null}

                {!modelConfig.configured ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#B4742E]">
                    <TriangleAlert className="h-[13px] w-[13px]" />
                    <span>尚未配置模型，评估前请先填写你的 API Key。</span>
                    <button
                      className="font-medium text-[#5B4BD6] underline decoration-[#C9BFF4] underline-offset-2 transition hover:text-[#4C3DC4]"
                      onClick={() => setModelModalOpen(true)}
                      type="button"
                    >
                      去设置
                    </button>
                  </p>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#A09BAC]">
                    <Cpu className="h-3 w-3" />
                    当前模型：{modelConfig.modelName}
                  </p>
                )}
              </div>
            </section>

            <section className="mt-6 overflow-hidden rounded-2xl border border-[#E8E6F1] bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-[#F2EFF8] px-5 py-4">
                <div>
                  <h2 className="text-[13.5px] font-semibold text-[#2C283C]">最近评估</h2>
                  <p className="mt-0.5 text-[10.5px] text-[#9A95A8]">
                    每份报告都关联当前画像，可随时回看。
                  </p>
                </div>
                <button
                  className="flex items-center gap-1 text-[11px] font-medium text-[#6C5CE7] transition hover:text-[#4C3DC4]"
                  onClick={() => setHistoryOpen(true)}
                  type="button"
                >
                  查看全部
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
              {recent.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <p className="text-[11.5px] text-[#9A95A9]">
                    还没有评估记录。粘贴一本小说链接，生成第一份匹配报告。
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#F4F1FA]">
                  {recent.map((record) => {
                    const tone = scoreTone(record.matchScore);
                    return (
                      <button
                        className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[#FCFBFE]"
                        key={record.id}
                        onClick={() => navigate(`/report/${record.id}`)}
                        type="button"
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg ${tone.bg} ${tone.text}`}
                        >
                          <span className="text-[13px] font-semibold leading-none tabular-nums">
                            {record.matchScore}
                          </span>
                          <span className="mt-0.5 text-[8px] opacity-70">匹配</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-[#2B273B]">
                            《{record.bookTitle}》
                          </span>
                          <span className="mt-1 flex items-center gap-1.5 text-[10px] text-[#9A95A8]">
                            <Clock3 className="h-2.5 w-2.5" />
                            {formatDateTime(record.createdAt)} · {record.chapterRange}
                          </span>
                        </span>
                        <span className="flex items-center gap-1 text-[10.5px] font-medium text-[#6C5CE7]">
                          打开报告
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>

      <ProfileEditModal
        onClose={() => setEditOpen(false)}
        onDeleted={handleDeleted}
        onSaved={handleSaved}
        open={editOpen}
        profile={profile}
      />

      <EvaluationProgressModal
        currentIndex={stageIndex}
        error={evalError}
        message={progressMessage}
        modelName={modelConfig.modelName}
        onCancel={() => void cancelEvaluation()}
        onClose={() => setEvalOpen(false)}
        onRetry={() => void startEvaluation()}
        open={evalOpen}
        profileName={profile.name}
        progress={progress}
      />

      <EvaluationHistoryModal
        evaluations={evaluations}
        onClose={() => setHistoryOpen(false)}
        onDelete={handleHistoryDelete}
        onOpen={(record) => {
          setHistoryOpen(false);
          navigate(`/report/${record.id}`);
        }}
        open={historyOpen}
        profileName={profile.name}
      />
    </>
  );
}

interface FeatureCardProps {
  title: string;
  hint: string;
  icon: "like" | "dislike";
  items: { title: string; description: string }[];
  emptyText: string;
}

function FeatureCard({ title, hint, icon, items, emptyText }: FeatureCardProps) {
  const isLike = icon === "like";
  return (
    <div className="rounded-2xl border border-[#E8E6F1] bg-white p-5 shadow-[0_14px_34px_-32px_rgba(44,36,96,0.45)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              isLike ? "bg-[#ECF9F2] text-[#249667]" : "bg-[#FFF3F4] text-[#C25867]",
            )}
          >
            {isLike ? <ThumbsUp className="h-[15px] w-[15px]" /> : <ThumbsDown className="h-[15px] w-[15px]" />}
          </span>
          <div>
            <h3 className="text-[13px] font-semibold text-[#2E2A40]">{title}</h3>
            <p className="mt-0.5 text-[10.5px] text-[#9A95A8]">{hint}</p>
          </div>
        </div>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-medium",
            isLike ? "bg-[#F0FAF5] text-[#2E9467]" : "bg-[#FFF5F5] text-[#B75A68]",
          )}
        >
          {items.length} 项
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-[#E6E2F0] bg-[#FCFBFE] px-4 py-6 text-center text-[11px] leading-5 text-[#9A95A9]">
          {emptyText}
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((item, index) => (
            <li
              className="flex items-start gap-3 rounded-xl border border-[#F0EDF8] bg-[#FCFBFE] p-3.5"
              key={`${item.title}-${index}`}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  isLike
                    ? "bg-[#E9F8EF] text-[#1F9D62]"
                    : "bg-[#FFF0F2] text-[#C25867]",
                )}
              >
                {isLike ? <Check className="h-[11px] w-[11px]" /> : <span className="text-[12px] leading-none">−</span>}
              </span>
              <span>
                <span className="block text-[12.5px] font-medium text-[#2B273B]">
                  {item.title}
                </span>
                <span className="mt-1 block text-[11.5px] leading-5 text-[#7B768C]">
                  {item.description}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
