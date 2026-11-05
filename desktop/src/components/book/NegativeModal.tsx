import { useEffect, useState } from "react";
import { Check, CircleAlert, Info } from "lucide-react";
import { DIMENSIONS } from "../../lib/constants";
import { backend } from "../../lib/backend";
import { cn, errorMessage, hostnameOf } from "../../lib/utils";
import type { DimensionKey, ReferenceBook } from "../../types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface NegativeModalProps {
  book: ReferenceBook | null;
  onClose: () => void;
  onSaved: (book: ReferenceBook) => void;
}

export function NegativeModal({ book, onClose, onSaved }: NegativeModalProps) {
  const [worst, setWorst] = useState<DimensionKey | null>(null);
  const [second, setSecond] = useState<DimensionKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!book) return;
    setWorst(book.worstDimension);
    setSecond(book.secondWorstDimension);
    setSaving(false);
    setError("");
  }, [book]);

  const handleSave = async () => {
    if (!book) return;
    if (!worst || !second) {
      setError("请分别选择最差和第二差的方面。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await backend.saveNegatives(book.id, worst, second);
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
      title="这本小说哪里最让你失望？"
      description={
        book
          ? `《${book.title}》 · ${hostnameOf(book.url)}。不需要逐项打分，只需选出最在意的两个方面。`
          : ""
      }
      footer={
        <>
          <span className="flex items-center gap-1.5 text-[10.5px] text-[#A09BAC]">
            <Info className="h-3 w-3" />
            第二差维度从剩余选项中产生
          </span>
          <div className="flex items-center gap-2">
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
      <div className="space-y-6">
        <section>
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF0F2] text-[11px] font-semibold text-[#C25867]">
              1
            </span>
            <div>
              <h3 className="text-[12.5px] font-semibold text-[#3A344C]">
                这本小说最烂的方面是什么？
              </h3>
              <p className="mt-0.5 text-[10.5px] text-[#9A95A8]">
                只选一个最主要的问题
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DIMENSIONS.map((dimension) => {
              const selected = worst === dimension.key;
              return (
                <button
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                    selected
                      ? "border-[#C25867] bg-[#FFF7F8] shadow-[inset_0_0_0_1px_#C25867]"
                      : "border-[#EEECF6] bg-white hover:border-[#E3C3CA] hover:bg-[#FFFCFC]",
                  )}
                  key={dimension.key}
                  onClick={() => {
                    setWorst(dimension.key);
                    if (second === dimension.key) setSecond(null);
                    setError("");
                  }}
                  type="button"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      selected
                        ? "border-[#C25867] bg-[#C25867] text-white"
                        : "border-[#D9D5E2] bg-white text-transparent",
                    )}
                  >
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <span>
                    <span
                      className={cn(
                        "block text-[12px] font-medium",
                        selected ? "text-[#A84455]" : "text-[#38334A]",
                      )}
                    >
                      {dimension.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-[#9A95A8]">
                      {dimension.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className={cn(!worst ? "opacity-60" : "")}>
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF7ED] text-[11px] font-semibold text-[#B4742E]">
              2
            </span>
            <div>
              <h3 className="text-[12.5px] font-semibold text-[#3A344C]">
                第二烂的方面是什么？
              </h3>
              <p className="mt-0.5 text-[10.5px] text-[#9A95A8]">
                {worst
                  ? "从剩余维度中选择一个，不能重复"
                  : "先完成上一步，再选择第二差的方面"}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DIMENSIONS.map((dimension) => {
              const disabled = !worst || worst === dimension.key;
              const selected = second === dimension.key;
              return (
                <button
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                    selected
                      ? "border-[#B4742E] bg-[#FFFBF5] shadow-[inset_0_0_0_1px_#B4742E]"
                      : disabled
                        ? "cursor-not-allowed border-[#F1EEF6] bg-[#FAF9FC] opacity-55"
                        : "border-[#EEECF6] bg-white hover:border-[#E8D2B5] hover:bg-[#FFFDF9]",
                  )}
                  disabled={disabled}
                  key={dimension.key}
                  onClick={() => {
                    setSecond(dimension.key);
                    setError("");
                  }}
                  type="button"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      selected
                        ? "border-[#B4742E] bg-[#B4742E] text-white"
                        : "border-[#D9D5E2] bg-white text-transparent",
                    )}
                  >
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  <span>
                    <span
                      className={cn(
                        "block text-[12px] font-medium",
                        selected ? "text-[#955F22]" : "text-[#38334A]",
                      )}
                    >
                      {dimension.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-[#9A95A8]">
                      {disabled && worst === dimension.key
                        ? "已选为最差方面"
                        : dimension.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

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
