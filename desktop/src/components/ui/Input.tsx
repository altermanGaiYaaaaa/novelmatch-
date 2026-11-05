import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const base =
  "w-full rounded-xl border border-[#E4E1EC] bg-[#FCFCFE] text-[#2A263B] outline-none transition placeholder:text-[#AAA5B7] focus:border-[#8E80E8] focus:bg-white focus:ring-4 focus:ring-[#EFEBFF] disabled:cursor-not-allowed disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, "h-10 px-3.5 text-[12.5px]", className)} {...props} />
  ),
);

Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(base, "resize-none px-3.5 py-2.5 text-[12.5px] leading-6", className)}
    {...props}
  />
));

Textarea.displayName = "Textarea";
