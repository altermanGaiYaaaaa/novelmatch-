import { Outlet } from "react-router-dom";
import { HelpModal } from "./HelpModal";
import { ModelSettingsModal } from "./ModelSettingsModal";
import { Sidebar } from "./Sidebar";
import { Toast } from "../ui/Toast";

export function AppShell() {
  return (
    <div className="min-h-screen bg-[#F6F6FA] text-[#1D1B2B]">
      <Sidebar />
      <div className="ml-[272px] flex min-h-screen flex-col">
        <Outlet />
      </div>
      <ModelSettingsModal />
      <HelpModal />
      <Toast />
    </div>
  );
}
