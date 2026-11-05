import { useEffect, useState } from "react";
import { CircleAlert, Link2, Loader2, Search } from "lucide-react";
import { backend } from "../../lib/backend";
import { errorMessage } from "../../lib/utils";
import type { ReferenceBook, ReferenceType } from "../../types";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

interface BookImportModalProps {
  open: boolean;
  profileId: string;
  referenceType: ReferenceType;
  onClose: () => void;
  onAdded: (book: ReferenceBook) => void;
}

export function BookImportModal({
  open,
  profileId,
  referenceType,
  onClose,
  onAdded,
}: BookImportModalProps) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setUrl("");
    setTitle("");
    setError("");
    setLoading(false);
  }, [open]);

  const isPositive = referenceType === "positive";

  const handleAdd = async () => {
    const value = url.trim();
    if (!value) {
      setError("请先粘贴小说链接。");
      return;
    }
    if (!/^https?:\/\/\S+/i.test(value)) {
      setError("小说链接需以 http:// 或 https:// 开头。");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const book = await backend.addBook(
        profileId,
        value,
        referenceType,
        title.trim() || undefined,
      );
      onAdded(book);
    } catch (err) {
      const message = errorMessage(err);
      setError(
        message.includes("获取")
          ? `${message} 你也可以在下方手动填写书名后重试。`
          : message,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={isPositive ? "添加喜欢的小说" : "添加讨厌的小说"}
      description={
        isPositive
          ? "添加一本你愿意推荐给同好、或反复重读的作品。"
          : "添加一本让你弃书、或回想起来仍然不满意的作品。"
      }
      footer={
        <>
          <span className="flex items-center gap-1.5 text-[10.5px] text-[#A09BAC]">
            <Search className="h-3 w-3" />
            只读取公开页面，不绕过登录或付费墙
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
              取消
            </Button>
            <Button size="sm" loading={loading} onClick={handleAdd}>
              {loading ? "正在读取" : "添加并评价"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-[12px] font-medium text-[#3C374E]" htmlFor="bookUrl">
            小说链接
          </label>
          <div className="relative mt-2">
            <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8A3B6]" />
            <Input
              autoComplete="off"
              className="h-10 pl-10"
              id="bookUrl"
              onChange={(event) => {
                setUrl(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder="例如 https://www.qidian.com/book/1043210/"
              value={url}
            />
          </div>
          <p className="mt-1.5 text-[10.5px] leading-5 text-[#A09BAC]">
            支持起点、晋江、番茄等平台的公开作品页或章节页。链接只用于当前分析任务。
          </p>
        </div>

        <div>
          <label className="text-[12px] font-medium text-[#3C374E]" htmlFor="bookTitle">
            书名
            <span className="ml-1 font-normal text-[#A09BAC]">选填</span>
          </label>
          <Input
            autoComplete="off"
            className="mt-2"
            id="bookTitle"
            onChange={(event) => {
              setTitle(event.target.value);
              setError("");
            }}
            placeholder="自动获取失败时，可在这里手动填写"
            value={title}
          />
        </div>

        <div className="rounded-xl border border-[#EEECF6] bg-[#FAFAFD] px-3.5 py-3">
          <div className="flex items-start gap-2 text-[11px] leading-5 text-[#7C7790]">
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8D7FE0]" />
            <span>
              保存后还需要完成
              {isPositive ? "七维度评分" : "最差和第二差维度的选择"}
              ，参考样本才会被用于生成画像。
            </span>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-xl border border-[#F5DCE0] bg-[#FFF7F8] px-3.5 py-2.5 text-[11.5px] leading-5 text-[#B04A5D]">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
