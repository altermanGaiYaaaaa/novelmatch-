import { useEffect, useState } from "react";
import { CircleAlert, ShieldCheck, Trash2 } from "lucide-react";
import { backend } from "../../lib/backend";
import { MAX_KEYWORDS, MAX_PROFILE_NAME } from "../../lib/constants";
import { errorMessage } from "../../lib/utils";
import { useAppStore } from "../../stores/appStore";
import type { Profile } from "../../types";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Input, Textarea } from "../ui/Input";
import { Modal } from "../ui/Modal";

interface ProfileEditModalProps {
  profile: Profile | null;
  open: boolean;
  onClose: () => void;
  onSaved: (profile: Profile) => void;
  onDeleted: () => void;
}

export function ProfileEditModal({
  profile,
  open,
  onClose,
  onSaved,
  onDeleted,
}: ProfileEditModalProps) {
  const showToast = useAppStore((state) => state.showToast);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [keywords, setKeywords] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !profile) return;
    setName(profile.name);
    setSummary(profile.summary);
    setKeywords(profile.preferences.keywords.join("，"));
    setError("");
    setSaving(false);
    setDeleting(false);
  }, [open, profile]);

  const handleSave = async () => {
    if (!profile) return;
    if (!name.trim()) {
      setError("画像名称不能为空。");
      return;
    }
    if (!summary.trim()) {
      setError("请填写一句品味总结。");
      return;
    }
    const keywordList = keywords
      .split(/[，,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_KEYWORDS);

    setSaving(true);
    setError("");
    try {
      const next = await backend.updateProfile(profile.id, {
        name: name.trim(),
        summary: summary.trim(),
        keywords: keywordList,
      });
      onSaved(next);
      showToast("画像已更新");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!profile) return;
    setDeleting(true);
    try {
      await backend.deleteProfile(profile.id);
      setConfirmDelete(false);
      showToast("画像已删除", "info");
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="md"
        title="编辑画像"
        description="调整名称、偏好摘要与关键词，不会影响已有的评估记录。"
        footer={
          <>
            <span className="flex items-center gap-1.5 text-[10.5px] text-[#A09BAC]">
              <ShieldCheck className="h-3 w-3" />
              仅你可见
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
                取消
              </Button>
              <Button size="sm" loading={saving} onClick={handleSave}>
                保存修改
              </Button>
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-medium text-[#3C374E]" htmlFor="editName">
                画像名称
              </label>
              <span className="text-[10.5px] tabular-nums text-[#A29DAF]">
                {name.length} / {MAX_PROFILE_NAME}
              </span>
            </div>
            <Input
              className="mt-2"
              id="editName"
              maxLength={MAX_PROFILE_NAME}
              onChange={(event) => {
                setName(event.target.value);
                setError("");
              }}
              value={name}
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-[#3C374E]" htmlFor="editSummary">
              阅读品味总结
            </label>
            <Textarea
              className="mt-2"
              id="editSummary"
              onChange={(event) => {
                setSummary(event.target.value);
                setError("");
              }}
              placeholder="写清楚你偏爱的类型、节奏和叙事方式。"
              rows={4}
              value={summary}
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-[#3C374E]" htmlFor="editKeywords">
              偏好关键词
            </label>
            <Input
              className="mt-2"
              id="editKeywords"
              onChange={(event) => {
                setKeywords(event.target.value);
                setError("");
              }}
              placeholder="用逗号分隔，例如：世界观缜密，升级有代价，群像权谋"
              value={keywords}
            />
            <p className="mt-1.5 text-[10.5px] text-[#A09BAC]">
              用逗号分隔，最多保留 {MAX_KEYWORDS} 个关键词。
            </p>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#F5DCE0] bg-[#FFF7F8] px-3.5 py-2.5 text-[11.5px] leading-5 text-[#B04A5D]">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="rounded-xl border border-[#F5DCE0] bg-[#FFFBFB] px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11.5px] font-medium text-[#8F4B58]">删除这套画像</p>
                <p className="mt-0.5 text-[10.5px] leading-5 text-[#B07A85]">
                  参考小说、评分与评估记录会一并删除，操作不可恢复。
                </p>
              </div>
              <Button
                onClick={() => setConfirmDelete(true)}
                size="sm"
                variant="outline"
              >
                <Trash2 className="h-3.5 w-3.5 text-[#C25867]" />
                删除
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="删除画像"
        description={`确定要删除「${profile?.name ?? ""}」吗？这套画像下的参考小说、评分和评估记录都会一并删除。`}
        confirmText="删除画像"
        danger
        loading={deleting}
      />
    </>
  );
}
