import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

type ModalSize = "sm" | "md" | "lg" | "xl";

const widths: Record<ModalSize, string> = {
  sm: "max-w-[420px]",
  md: "max-w-[520px]",
  lg: "max-w-[640px]",
  xl: "max-w-[760px]",
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  bodyClassName?: string;
  closeOnOverlay?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  bodyClassName,
  closeOnOverlay = true,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-[#1A1630]/40 backdrop-blur-[2px]"
        onClick={closeOnOverlay ? onClose : undefined}
      />
      <div
        className={cn(
          "relative mx-auto mt-[8vh] w-[calc(100%-40px)] overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_30px_80px_-20px_rgba(25,18,60,0.45)]",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between border-b border-[#F0EEF5] px-6 py-4">
          <div className="min-w-0 pr-3">
            <h2 className="text-[15px] font-semibold text-[#262236]">{title}</h2>
            {description ? (
              <p className="mt-1 text-[11px] leading-5 text-[#9691A6]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label="关闭"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#9A95A9] transition hover:bg-[#F5F3FA] hover:text-[#4E3FC7]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          className={cn(
            "max-h-[66vh] overflow-y-auto px-6 py-5 scrollbar-thin",
            bodyClassName,
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="flex items-center justify-between gap-3 border-t border-[#F0EEF5] bg-[#FCFCFE] px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
