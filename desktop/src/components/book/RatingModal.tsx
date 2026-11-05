import { useEffect, useMemo, useState } from "react";
import { CircleAlert, Info } from "lucide-react";
import { DIMENSIONS, RATING_LABELS } from "../../lib/constants";
import { backend } from "../../lib/backend";
import { errorMessage, hostnameOf } from "../../lib/utils";
import type { DimensionKey, ReferenceBook } from "../../types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { StarRating } from "../ui/StarRating";

interface RatingModalProps {
  book: ReferenceBook | null;
  onClose: () => void;
  onSaved: (book: ReferenceBook) => void;
}

export function RatingModal({ book, onClose, onSaved }: RatingModalProps) {
  const [ratings, setRatings] = useState<Record<DimensionKey, number>>({
    writing: 0,
    plot: 0,
    character: 0,
    worldbuilding: 0,
    pacing: 0,
    creativity: 0,
    payoff: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!book) return;
    setRatings({
      writing: book.ratings.writing ?? 0,
      plot: book.ratings.plot ?? 0,
      character: book.ratings.character ?? 0,
      worldbuilding: book.ratings.worldbuilding ?? 0,
      pacing: book.ratings.pacing ?? 0,
      creativity: book.ratings.creativity ?? 0,
      payoff: book.ratings.payoff ?? 0,
    });
    setSaving(false);
    setError("");
  }, [book]);

  const completed = useMemo(
    () => DIMENSIONS.filter((item) => ratings[item.key] > 0).length,
    [ratings],
  );

  const handleSave = async () => {
    if (!book) return;
    if (completed < DIMENSIONS.length) {
      setError("请为七个维度分别选择 1–5 星后再保存。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await backend.saveRating(book.id, ratings);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(book)}
      onClose={onClose}
      size="lg"
      title="给这本小说打分"
      description={
        book
          ? `《${book.title}》 · ${hostnameOf(book.url)}。评分只代表你的主观感受，不使用大众评分。`
          : ""
      }
      footer={
        <>
          <span className="flex items-center gap-1.5 text-[10.5px] text-[#A09BAC]">
            <Info className="h-3 w-3" />
            七维度评分用于区分你真正重视的方面
          </span>
          <div className="flex items-center gap-2">
            <span className="mr-1 text-[11px] tabular-nums text-[#9691A6]">
              {completed} / 7 已完成
            </span>
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              取消
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              保存评价
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-2.5">
        {DIMENSIONS.map((dimension) => {
          const value = ratings[dimension.key];
          return (
            <div
              className="flex flex-wrap items-center gap-4 rounded-xl border border-[#F0EDF8] bg-[#FCFBFE] px-4 py-3.5"
              key={dimension.key}
            >
              <div className="min-w-[160px] flex-1">
                <p className="text-[12.5px] font-medium text-[#2B273B]">
                  {dimension.label}
                </p>
                <p className="mt-0.5 text-[10.5px] leading-5 text-[#8D889C]">
                  {dimension.description}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StarRating
                  onChange={(next) => {
                    setRatings((current) => ({ ...current, [dimension.key]: next }));
                    setError("");
                  }}
                  value={value}
                />
                <span className="w-[74px] text-right text-[10.5px] text-[#9691A6]">
                  {value ? RATING_LABELS[value] : "未评分"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#F5DCE0] bg-[#FFF7F8] px-3.5 py-2.5 text-[11.5px] leading-5 text-[#B04A5D]">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
    </Modal>
  );
}
