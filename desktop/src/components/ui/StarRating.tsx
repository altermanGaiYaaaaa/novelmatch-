import { Star } from "lucide-react";
import { cn } from "../../lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}

export function StarRating({
  value,
  onChange,
  size = "md",
  disabled = false,
}: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            aria-label={`${star} 星`}
            aria-pressed={active}
            onClick={() => onChange?.(star)}
            className={cn(
              "group flex items-center justify-center rounded-md transition disabled:cursor-default",
              size === "sm" ? "h-6 w-6" : "h-7 w-7",
              onChange && !disabled ? "hover:bg-[#FFF8E8]" : "",
            )}
          >
            <Star
              className={cn(
                "transition",
                size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]",
                active
                  ? "fill-[#F2B84B] text-[#F2B84B]"
                  : "text-[#D9D5E2] group-hover:text-[#E8C783]",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
