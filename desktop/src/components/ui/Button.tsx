import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-[#5B4BD6] text-white shadow-[0_10px_22px_-12px_rgba(91,75,214,0.95)] hover:bg-[#4C3DC4]",
  secondary:
    "border border-[#E7E4F0] bg-white text-[#5F5A72] hover:border-[#D6CFF6] hover:text-[#4E3FC7]",
  outline:
    "border border-[#E5E2EC] bg-white text-[#605B73] hover:border-[#D8D3E5] hover:bg-[#FAF9FC]",
  ghost:
    "text-[#6C6880] hover:bg-[#F6F5FA] hover:text-[#3A3550]",
  danger:
    "bg-[#B04A5D] text-white shadow-[0_10px_22px_-12px_rgba(176,74,93,0.7)] hover:bg-[#9C3D4F]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px] rounded-lg gap-1.5",
  md: "h-10 px-4 text-[13px] rounded-xl gap-2",
  lg: "h-11 px-5 text-[13.5px] rounded-xl gap-2",
  icon: "h-8 w-8 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  className?: string,
) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    sizes[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  ),
);

Button.displayName = "Button";
