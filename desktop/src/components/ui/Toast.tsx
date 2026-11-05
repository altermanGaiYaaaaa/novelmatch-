import {
  BookmarkCheck,
  CheckCircle2,
  CircleAlert,
  Info,
  Sparkles,
} from "lucide-react";
import { useAppStore, type ToastIcon } from "../../stores/appStore";

const icons: Record<ToastIcon, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
  sparkles: Sparkles,
  bookmark: BookmarkCheck,
};

export function Toast() {
  const toast = useAppStore((state) => state.toast);
  if (!toast) return null;
  const Icon = icons[toast.icon];
  const tone =
    toast.icon === "error"
      ? "text-[#F3A6B1]"
      : toast.icon === "info"
        ? "text-[#A9C0F5]"
        : "text-[#A99BF5]";

  return (
    <div
      className="pointer-events-none fixed bottom-8 left-1/2 z-[70] -translate-x-1/2 animate-toast-in"
      key={toast.id}
    >
      <div className="flex items-center gap-2 rounded-xl bg-[#231D3B] px-4 py-2.5 text-[12.5px] text-white shadow-[0_18px_40px_-18px_rgba(20,14,50,0.8)]">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
