import { Check, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface ProgressStagesProps {
  stages: string[];
  currentIndex: number;
  progress: number;
  message?: string;
}

export function ProgressStages({
  stages,
  currentIndex,
  progress,
  message,
}: ProgressStagesProps) {
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#EFECF7]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#6C5CE7] to-[#9A8DEE] transition-all duration-500"
          style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
        />
      </div>
      <div className="mt-5 space-y-2">
        {stages.map((stage, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <div
              key={stage}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition",
                active
                  ? "border-[#E6E0FB] bg-[#FAF8FF]"
                  : "border-transparent bg-transparent",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  done
                    ? "bg-[#E9F8EF] text-[#1F9D62]"
                    : active
                      ? "bg-[#EDE9FF] text-[#5B4BD6]"
                      : "bg-[#F4F2F8] text-[#A9A4B6]",
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  "text-[12px]",
                  done
                    ? "text-[#6F6A80]"
                    : active
                      ? "font-medium text-[#3A344C]"
                      : "text-[#A39EAF]",
                )}
              >
                {stage}
              </span>
              {done ? (
                <span className="ml-auto text-[10.5px] text-[#A29DAD]">已完成</span>
              ) : active ? (
                <span className="ml-auto text-[10.5px] font-medium text-[#5B4BD6]">进行中</span>
              ) : null}
            </div>
          );
        })}
      </div>
      {message ? (
        <p className="mt-4 text-center text-[11px] leading-5 text-[#9691A6]">{message}</p>
      ) : null}
    </div>
  );
}
