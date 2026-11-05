import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CircleHelp } from "lucide-react";
import { useAppStore } from "../../stores/appStore";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface TopbarProps {
  breadcrumb: BreadcrumbItem[];
  actions?: ReactNode;
}

export function Topbar({ breadcrumb, actions }: TopbarProps) {
  const setHelpModalOpen = useAppStore((state) => state.setHelpModalOpen);

  return (
    <header className="sticky top-0 z-20 flex h-[68px] shrink-0 items-center justify-between border-b border-[#EAE9F2] bg-white/85 px-9 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-[#8B879D]">
        {breadcrumb.map((item, index) => (
          <span className="flex min-w-0 items-center gap-2" key={`${item.label}-${index}`}>
            {index > 0 ? <span className="text-[#D6D3DE]">/</span> : null}
            {item.to ? (
              <Link
                className="truncate transition hover:text-[#5B4BD6]"
                to={item.to}
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  index === breadcrumb.length - 1
                    ? "truncate font-medium text-[#4C475E]"
                    : "truncate"
                }
              >
                {item.label}
              </span>
            )}
          </span>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {actions}
        {actions ? <span className="mx-0.5 h-5 w-px bg-[#ECEBF2]" /> : null}
        <button
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-[#6C6880] transition hover:bg-[#F6F5FA] hover:text-[#3A3550]"
          onClick={() => setHelpModalOpen(true)}
          type="button"
        >
          <CircleHelp className="h-[15px] w-[15px]" />
          使用指南
        </button>
        <span className="mx-0.5 h-5 w-px bg-[#ECEBF2]" />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EDE9FF] text-[12px] font-semibold text-[#5B4BD6]">
          读
        </span>
      </div>
    </header>
  );
}
