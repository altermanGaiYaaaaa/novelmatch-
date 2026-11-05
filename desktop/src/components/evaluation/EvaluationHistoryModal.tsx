import { useState } from "react";
import { ArrowUpRight, Clock3, Trash2 } from "lucide-react";
import { formatDateTime, scoreTone } from "../../lib/utils";
import type { EvaluationRecord } from "../../types";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Modal } from "../ui/Modal";

interface EvaluationHistoryModalProps {
  open: boolean;
  profileName: string;
  evaluations: EvaluationRecord[];
  onClose: () => void;
  onOpen: (record: EvaluationRecord) => void;
  onDelete: (record: EvaluationRecord) => Promise<void> | void;
}

export function EvaluationHistoryModal({
  open,
  profileName,
  evaluations,
  onClose,
  onOpen,
  onDelete,
}: EvaluationHistoryModalProps) {
  const [target, setTarget] = useState<EvaluationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await onDelete(target);
      setTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title="评估记录"
        description={`「${profileName}」保存的全部评估结果，按时间从新到旧排列。`}
      >
        {evaluations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E3DFEE] bg-[#FCFBFE] px-4 py-10 text-center">
            <p className="text-[12px] text-[#9A95A9]">还没有评估记录</p>
          </div>
        ) : (
          <div className="space-y-2">
            {evaluations.map((record) => {
              const tone = scoreTone(record.matchScore);
              return (
                <div
                  className="flex items-center gap-3 rounded-xl border border-[#F0EDF8] bg-[#FCFBFE] p-3.5 transition hover:border-[#E4DEF5] hover:bg-white"
                  key={record.id}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg ${tone.bg} ${tone.text}`}
                  >
                    <span className="text-[13px] font-semibold leading-none tabular-nums">
                      {record.matchScore}
                    </span>
                    <span className="mt-0.5 text-[8px] opacity-70">匹配</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-[#2B273B]">
                      《{record.bookTitle}》
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#9A95A8]">
                      <span className="flex items-center gap-1">
                        <Clock3 className="h-2.5 w-2.5" />
                        {formatDateTime(record.createdAt)}
                      </span>
                      <span>·</span>
                      <span>{record.chapterRange}</span>
                      <span>·</span>
                      <span>{record.modelName}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      aria-label="删除评估记录"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A09BAC] transition hover:bg-[#FFF3F4] hover:text-[#C25867]"
                      onClick={() => setTarget(record)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      aria-label="打开报告"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A09BAC] transition hover:bg-[#F3F0FF] hover:text-[#5B4BD6]"
                      onClick={() => onOpen(record)}
                      type="button"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={handleDelete}
        title="删除评估记录"
        description={`确定要删除《${target?.bookTitle ?? ""}》的评估记录吗？删除后无法恢复。`}
        confirmText="删除记录"
        danger
        loading={deleting}
      />
    </>
  );
}
