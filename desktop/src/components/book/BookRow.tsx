import { BookOpen, Pencil, Trash2 } from "lucide-react";
import { DIMENSION_LABELS, DIMENSIONS } from "../../lib/constants";
import { cn, hostnameOf } from "../../lib/utils";
import type { ReferenceBook } from "../../types";

interface BookRowProps {
  book: ReferenceBook;
  onEdit: (book: ReferenceBook) => void;
  onDelete: (book: ReferenceBook) => void;
}

export function BookRow({ book, onEdit, onDelete }: BookRowProps) {
  const isPositive = book.referenceType === "positive";
  const values = DIMENSIONS.map((item) => book.ratings[item.key] ?? 0);
  const average = values.some(Boolean)
    ? (values.reduce((sum, value) => sum + value, 0) / DIMENSIONS.length).toFixed(1)
    : "";

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-[#F0EDF8] bg-[#FCFBFE] p-3.5 transition hover:border-[#E4DEF5] hover:bg-white">
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isPositive
            ? "bg-[#ECF9F2] text-[#249667]"
            : "bg-[#FFF3F4] text-[#C25867]",
        )}
      >
        <BookOpen className="h-[15px] w-[15px]" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[12.5px] font-medium text-[#2B273B]">
            {book.title}
          </p>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[9.5px] font-medium",
              book.ready
                ? "bg-[#EDF9F2] text-[#1E9C62]"
                : "bg-[#FFF7ED] text-[#B4742E]",
            )}
          >
            {book.ready ? "已完成" : "待评价"}
          </span>
        </div>
        <p className="mt-1 truncate text-[10px] text-[#A09BAC]">
          {hostnameOf(book.url)}
        </p>
        <p className="mt-1.5 text-[10.5px] leading-4 text-[#8D889C]">
          {isPositive
            ? book.ready
              ? `七维度评分完成 · 平均 ${average} 星`
              : "需要完成七维度评分"
            : book.ready && book.worstDimension && book.secondWorstDimension
              ? `最差：${DIMENSION_LABELS[book.worstDimension]} · 第二差：${
                  DIMENSION_LABELS[book.secondWorstDimension]
                }`
              : "需要选择最差与第二差维度"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-80 transition group-hover:opacity-100">
        <button
          aria-label="修改评价"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A09BAC] transition hover:bg-[#F3F0FF] hover:text-[#5B4BD6]"
          onClick={() => onEdit(book)}
          type="button"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label="删除参考小说"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A09BAC] transition hover:bg-[#FFF3F4] hover:text-[#C25867]"
          onClick={() => onDelete(book)}
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
