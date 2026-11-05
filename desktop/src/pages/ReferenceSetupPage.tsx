import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Cpu,
  Loader2,
  Plus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Topbar } from "../components/layout/Topbar";
import { BookImportModal } from "../components/book/BookImportModal";
import { BookRow } from "../components/book/BookRow";
import { NegativeModal } from "../components/book/NegativeModal";
import { RatingModal } from "../components/book/RatingModal";
import { Button, buttonClasses } from "../components/ui/Button";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Modal } from "../components/ui/Modal";
import { ProgressStages } from "../components/ui/ProgressStages";
import { backend } from "../lib/backend";
import { cn, errorMessage, uid } from "../lib/utils";
import { useAppStore } from "../stores/appStore";
import type { Profile, ReferenceBook, ReferenceType } from "../types";

const GEN_STAGES = ["获取参考小说", "AI 分析作品", "生成品味画像"];

export function ReferenceSetupPage() {
  const { profileId = "" } = useParams();
  const navigate = useNavigate();
  const modelConfig = useAppStore((state) => state.modelConfig);
  const setModelModalOpen = useAppStore((state) => state.setModelModalOpen);
  const refreshProfiles = useAppStore((state) => state.refreshProfiles);
  const upsertProfile = useAppStore((state) => state.upsertProfile);
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const showToast = useAppStore((state) => state.showToast);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [books, setBooks] = useState<ReferenceBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [importType, setImportType] = useState<ReferenceType | null>(null);
  const [ratingBook, setRatingBook] = useState<ReferenceBook | null>(null);
  const [negativeBook, setNegativeBook] = useState<ReferenceBook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReferenceBook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const [genOpen, setGenOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStage, setGenStage] = useState(0);
  const [genProgress, setGenProgress] = useState(4);
  const [genMessage, setGenMessage] = useState("");
  const [genError, setGenError] = useState("");
  const taskRef = useRef<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const autoOpenedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!profileId) return;
    const [nextProfile, nextBooks] = await Promise.all([
      backend.getProfile(profileId),
      backend.listBooks(profileId),
    ]);
    setProfile(nextProfile);
    setBooks(nextBooks);
    setActiveProfile(nextProfile.id);
    return { nextProfile, nextBooks };
  }, [profileId, setActiveProfile]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError("");
    reload()
      .then((data) => {
        if (!mounted || !data) return;
        if (
          !autoOpenedRef.current &&
          data.nextBooks.length === 0 &&
          data.nextProfile.status === "draft"
        ) {
          autoOpenedRef.current = true;
          setImportType("positive");
        }
      })
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
  }, [reload]);

  const positiveBooks = books.filter((book) => book.referenceType === "positive");
  const negativeBooks = books.filter((book) => book.referenceType === "negative");
  const readyCount = books.filter((book) => book.ready).length;
  const allReady = books.length > 0 && readyCount === books.length;

  const handleAdded = async (book: ReferenceBook) => {
    setBooks((current) => [...current, book]);
    setImportType(null);
    if (book.referenceType === "positive") {
      setRatingBook(book);
    } else {
      setNegativeBook(book);
    }
    try {
      const nextProfile = await backend.getProfile(profileId);
      setProfile(nextProfile);
      setActiveProfile(nextProfile.id);
    } catch {
      // 保持当前页面状态即可
    }
  };

  const handleSaved = async (book: ReferenceBook) => {
    setBooks((current) =>
      current.map((item) => (item.id === book.id ? book : item)),
    );
    setRatingBook(null);
    setNegativeBook(null);
    showToast("参考小说评价已保存");
    try {
      const nextProfile = await backend.getProfile(profileId);
      setProfile(nextProfile);
      upsertProfile(nextProfile);
    } catch {
      // 忽略刷新失败，保存本身已经成功
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await backend.deleteBook(deleteTarget.id);
      setBooks((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      showToast("参考小说已移除", "info");
      const nextProfile = await backend.getProfile(profileId);
      setProfile(nextProfile);
      upsertProfile(nextProfile);
    } catch (error) {
      showToast(errorMessage(error), "error");
    } finally {
      setDeleting(false);
    }
  };

  const openGenerate = () => {
    if (!allReady) {
      showToast("请先完成每一本参考小说的评价", "error");
      return;
    }
    if (!modelConfig.configured) {
      setModelModalOpen(true);
      showToast("生成画像前请先完成模型设置", "error");
      return;
    }
    if (profile?.status === "generated") {
      setConfirmRegen(true);
      return;
    }
    void handleGenerate();
  };

  const handleGenerate = async () => {
    if (!profile) return;
    setConfirmRegen(false);
    setGenError("");
    setGenOpen(true);
    setGenerating(true);
    setGenStage(0);
    setGenProgress(4);
    setGenMessage("正在读取参考小说…");

    const taskId = uid("profile");
    taskRef.current = taskId;
    try {
      unlistenRef.current?.();
      unlistenRef.current = await backend.onProfileProgress((event) => {
        if (event.taskId !== taskId) return;
        setGenStage(event.stageIndex);
        setGenProgress(event.progress);
        setGenMessage(event.message);
      });

      const result = await backend.generateProfile(profile.id, taskId);
      if (taskRef.current !== taskId) return;
      setGenStage(GEN_STAGES.length);
      setGenProgress(100);
      setGenMessage("画像已生成，正在进入工作台…");
      upsertProfile(result);
      await refreshProfiles();
      showToast("阅读品味画像已生成", "sparkles");
      setGenOpen(false);
      navigate(`/workspace/${result.id}`);
    } catch (error) {
      if (taskRef.current !== taskId) return;
      const err = error as { code?: string; message?: string };
      if (err.code === "CANCELLED") {
        setGenOpen(false);
        showToast("已取消画像生成", "info");
      } else {
        setGenError(errorMessage(error));
        setGenMessage("");
      }
    } finally {
      if (taskRef.current === taskId) taskRef.current = null;
      unlistenRef.current?.();
      unlistenRef.current = null;
      setGenerating(false);
    }
  };

  const handleCancel = async () => {
    const taskId = taskRef.current;
    taskRef.current = null;
    if (taskId) {
      try {
        await backend.cancelTask(taskId);
      } catch {
        // 即使取消请求失败，也结束前端等待
      }
    }
    setGenerating(false);
    setGenOpen(false);
    showToast("已取消画像生成", "info");
  };

  if (loading) {
    return (
      <>
        <Topbar breadcrumb={[{ label: "我的画像", to: "/" }, { label: "参考小说" }]} />
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
        <Topbar breadcrumb={[{ label: "我的画像", to: "/" }, { label: "参考小说" }]} />
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

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "我的画像", to: "/" },
          { label: profile.name, to: `/workspace/${profile.id}` },
          { label: "参考小说" },
        ]}
        actions={
          <Link
            className="flex items-center gap-1.5 text-[12.5px] text-[#7C7790] transition hover:text-[#5B4BD6]"
            to={`/workspace/${profile.id}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回工作台
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-[1220px] flex-1 px-9 pb-16 pt-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#1F1C30]">
                完善「{profile.name}」的参考小说
              </h1>
              <span className="rounded-md border border-[#E4DDFB] bg-[#F6F3FF] px-2 py-0.5 text-[10.5px] font-medium text-[#6557C4]">
                {profile.customGenre || profile.genre}
              </span>
              {profile.status === "generated" ? (
                <span className="rounded-md bg-[#EDF9F2] px-2 py-0.5 text-[10.5px] font-medium text-[#1E9C62]">
                  已生成
                </span>
              ) : null}
            </div>
            <p className="mt-2.5 text-[13px] leading-6 text-[#7A758C]">
              喜欢和讨厌的样本都可以单独存在，但至少需要一本参考小说才能生成画像。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[
              ["01", "题材与名称", true],
              ["02", "参考小说", true],
              ["03", "生成画像", profile.status === "generated"],
            ].map(([no, label, done]) => (
              <div
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10.5px]",
                  done
                    ? "border-[#DDF3E8] bg-[#F4FBF7] text-[#227A50]"
                    : "border-[#EAE6F6] bg-white text-[#8A859C]",
                )}
                key={String(no)}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold",
                    done ? "bg-[#DDF3E8] text-[#1F9D62]" : "bg-[#F3F0FF] text-[#6557C4]",
                  )}
                >
                  {done ? <Check className="h-2.5 w-2.5" /> : no}
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
          <BookGroup
            books={positiveBooks}
            description="标记你认可的文笔、剧情与爽点，AI 会从中学习正向偏好。"
            icon="positive"
            onAdd={() => setImportType("positive")}
            onDelete={setDeleteTarget}
            onEdit={setRatingBook}
            title="喜欢的小说"
          />
          <BookGroup
            books={negativeBooks}
            description="只记录最差和第二差的方面，帮助 AI 找到你的弃书雷点。"
            icon="negative"
            onAdd={() => setImportType("negative")}
            onDelete={setDeleteTarget}
            onEdit={setNegativeBook}
            title="讨厌的小说"
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-[#E8E6F1] bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[15px] font-semibold text-[#2A263B]">
                  准备生成画像
                </h2>
                <span className="rounded-md bg-[#F4F1FF] px-2 py-0.5 text-[10px] font-medium text-[#6557C4]">
                  至少 1 本参考小说
                </span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-5 text-[#8D889C]">
                喜欢 {positiveBooks.length} 本 · 讨厌 {negativeBooks.length} 本 · 已完成评价{" "}
                {readyCount}/{books.length || 0} 本
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px]">
                {!modelConfig.configured ? (
                  <span className="flex items-center gap-1.5 text-[#B4742E]">
                    <TriangleAlert className="h-3 w-3" />
                    尚未配置模型
                    <button
                      className="font-medium text-[#5B4BD6] underline decoration-[#C9BFF4] underline-offset-2"
                      onClick={() => setModelModalOpen(true)}
                      type="button"
                    >
                      去设置
                    </button>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[#6F8F7D]">
                    <Cpu className="h-3 w-3" />
                    {modelConfig.modelName}
                  </span>
                )}
                {books.length === 0 ? (
                  <span className="text-[#B4742E]">先添加一本喜欢或讨厌的小说</span>
                ) : !allReady ? (
                  <span className="text-[#B4742E]">
                    还有 {books.length - readyCount} 本参考小说未完成评价
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[#227A50]">
                    <Check className="h-3 w-3" />
                    参考样本已准备好
                  </span>
                )}
              </div>
            </div>
            <Button
              className="h-11"
              disabled={!allReady || generating}
              onClick={openGenerate}
            >
              <Sparkles className="h-4 w-4" />
              {profile.status === "generated" ? "重新生成画像" : "生成品味画像"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </section>
      </main>

      <BookImportModal
        onAdded={handleAdded}
        onClose={() => setImportType(null)}
        open={Boolean(importType)}
        profileId={profile.id}
        referenceType={importType ?? "positive"}
      />

      <RatingModal
        book={ratingBook}
        onClose={() => setRatingBook(null)}
        onSaved={handleSaved}
      />

      <NegativeModal
        book={negativeBook}
        onClose={() => setNegativeBook(null)}
        onSaved={handleSaved}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="移除这本参考小说"
        description={`确定要移除《${deleteTarget?.title ?? ""}》吗？它对应的评价也会一并删除。`}
        confirmText="移除"
        danger
        loading={deleting}
      />

      <ConfirmModal
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        onConfirm={handleGenerate}
        title="重新生成画像"
        description="重新生成会覆盖 AI 之前生成的总结与偏好关键词，你在编辑页手动修改过的内容也会被覆盖。参考小说与评分不会受影响。"
        confirmText="继续生成"
      />

      <Modal
        open={genOpen}
        onClose={() => {
          if (!generating) {
            setGenOpen(false);
            setGenError("");
          }
        }}
        size="md"
        title={genError ? "画像生成失败" : "正在生成阅读品味画像"}
        description={
          genError
            ? "任务已停止，已保存的参考小说和评分不会丢失。"
            : `基于 ${books.length} 本参考小说，为「${profile.name}」归纳专属的阅读偏好。`
        }
        closeOnOverlay={false}
        footer={
          genError ? (
            <>
              <span className="text-[10.5px] text-[#A09BAC]">可检查模型配置后重试</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setGenOpen(false)}>
                  关闭
                </Button>
                <Button size="sm" onClick={() => void handleGenerate()}>
                  重新生成
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-[10.5px] text-[#A09BAC]">
                <Cpu className="h-3 w-3" />
                {modelConfig.modelName || "未配置模型"}
              </span>
              <Button variant="outline" size="sm" onClick={() => void handleCancel()}>
                取消生成
              </Button>
            </>
          )
        }
      >
        {genError ? (
          <div className="rounded-xl border border-[#F5DCE0] bg-[#FFF7F8] px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#C25867]" />
              <div>
                <p className="text-[12.5px] font-medium text-[#9C4052]">
                  生成任务未完成
                </p>
                <p className="mt-1 text-[11.5px] leading-5 text-[#B06A78]">
                  {genError}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <ProgressStages
            currentIndex={genStage}
            message={genMessage}
            progress={genProgress}
            stages={GEN_STAGES}
          />
        )}
      </Modal>
    </>
  );
}

interface BookGroupProps {
  title: string;
  description: string;
  icon: "positive" | "negative";
  books: ReferenceBook[];
  onAdd: () => void;
  onEdit: (book: ReferenceBook) => void;
  onDelete: (book: ReferenceBook) => void;
}

function BookGroup({
  title,
  description,
  icon,
  books,
  onAdd,
  onEdit,
  onDelete,
}: BookGroupProps) {
  const isPositive = icon === "positive";
  return (
    <section className="rounded-2xl border border-[#E8E6F1] bg-white p-5 shadow-[0_14px_34px_-32px_rgba(44,36,96,0.45)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              isPositive
                ? "bg-[#ECF9F2] text-[#249667]"
                : "bg-[#FFF3F4] text-[#C25867]",
            )}
          >
            {isPositive ? (
              <ThumbsUp className="h-[15px] w-[15px]" />
            ) : (
              <ThumbsDown className="h-[15px] w-[15px]" />
            )}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[13.5px] font-semibold text-[#2E2A40]">{title}</h2>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  isPositive
                    ? "bg-[#F0FAF5] text-[#2E9467]"
                    : "bg-[#FFF5F5] text-[#B75A68]",
                )}
              >
                {books.length} 本
              </span>
            </div>
            <p className="mt-1 text-[10.5px] leading-5 text-[#9A95A8]">{description}</p>
          </div>
        </div>
        <Button onClick={onAdd} size="sm" variant="secondary">
          <Plus className="h-3.5 w-3.5" />
          添加
        </Button>
      </div>

      <div className="mt-4">
        {books.length === 0 ? (
          <button
            className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#E3DFEE] bg-[#FCFBFE] px-4 py-8 text-center transition hover:border-[#CFC7F2] hover:bg-[#FAF8FF]"
            onClick={onAdd}
            type="button"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#8D7FE0] shadow-sm">
              <Plus className="h-4 w-4" />
            </span>
            <span className="mt-2.5 text-[12px] font-medium text-[#534A74]">
              还没有添加{isPositive ? "喜欢" : "讨厌"}的小说
            </span>
            <span className="mt-1 max-w-[260px] text-[10.5px] leading-5 text-[#9A95A9]">
              可以添加多本，也可以只使用另一类样本。
            </span>
          </button>
        ) : (
          <div className="space-y-2">
            {books.map((book) => (
              <BookRow
                book={book}
                key={book.id}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
