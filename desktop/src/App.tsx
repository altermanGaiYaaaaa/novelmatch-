import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { BookOpen, CircleAlert, Loader2, RotateCcw } from "lucide-react";
import { AppShell } from "./components/layout/AppShell";
import { Button } from "./components/ui/Button";
import { useAppStore } from "./stores/appStore";
import { CreateProfilePage } from "./pages/CreateProfilePage";
import { HomePage } from "./pages/HomePage";
import { ReferenceSetupPage } from "./pages/ReferenceSetupPage";
import { ReportPage } from "./pages/ReportPage";
import { WorkspacePage } from "./pages/WorkspacePage";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F6FA]">
      <div className="flex flex-col items-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#8B7CF6] text-white shadow-[0_18px_36px_-18px_rgba(91,75,214,0.85)]">
          <BookOpen className="h-6 w-6" />
        </span>
        <p className="mt-4 text-[15px] font-semibold text-[#211E31]">NovelMatch</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#9691A6]">
          <Loader2 className="h-3 w-3 animate-spin" />
          正在读取本地数据…
        </p>
      </div>
    </div>
  );
}

function BootError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F6FA] px-6">
      <div className="w-full max-w-[440px] rounded-2xl border border-[#F5DCE0] bg-white p-7 text-center shadow-card">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF3F4] text-[#C25867]">
          <CircleAlert className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-[16px] font-semibold text-[#2B273C]">无法启动 NovelMatch</h1>
        <p className="mt-2 text-[12px] leading-6 text-[#8D889C]">{message}</p>
        <p className="mt-2 text-[10.5px] leading-5 text-[#A09BAC]">
          请确认应用有权限写入用户数据目录，然后重试。
        </p>
        <Button className="mt-5" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" />
          重新加载
        </Button>
      </div>
    </div>
  );
}

export default function App() {
  const init = useAppStore((state) => state.init);
  const loading = useAppStore((state) => state.loading);
  const bootError = useAppStore((state) => state.bootError);

  useEffect(() => {
    void init();
  }, [init]);

  if (loading) return <Splash />;
  if (bootError) return <BootError message={bootError} onRetry={() => void init()} />;

  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/create" element={<CreateProfilePage />} />
          <Route path="/setup/:profileId" element={<ReferenceSetupPage />} />
          <Route path="/workspace/:profileId" element={<WorkspacePage />} />
          <Route path="/report/:evaluationId" element={<ReportPage />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
