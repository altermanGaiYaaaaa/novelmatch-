import { CircleAlert, Cpu } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { ProgressStages } from "../ui/ProgressStages";

export const EVALUATION_STAGES = [
  "获取小说信息",
  "获取前十章正文",
  "AI 分析小说内容",
  "匹配阅读品味",
  "生成评估报告",
];

interface EvaluationProgressModalProps {
  open: boolean;
  profileName: string;
  modelName: string;
  currentIndex: number;
  progress: number;
  message: string;
  error: string;
  onCancel: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export function EvaluationProgressModal({
  open,
  profileName,
  modelName,
  currentIndex,
  progress,
  message,
  error,
  onCancel,
  onClose,
  onRetry,
}: EvaluationProgressModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!error) return;
        onClose();
      }}
      size="md"
      closeOnOverlay={false}
      title={error ? "评估未完成" : "正在评估这本小说"}
      description={
        error
          ? "评估任务已停止，你可以检查链接或模型配置后重试。"
          : `使用「${profileName}」的阅读偏好进行匹配，分析范围为前十章。`
      }
      footer={
        error ? (
          <>
            <span className="text-[10.5px] text-[#A09BAC]">失败详情会保留在当前窗口</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                关闭
              </Button>
              <Button size="sm" onClick={onRetry}>
                重新评估
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-[10.5px] text-[#A09BAC]">
              <Cpu className="h-3 w-3" />
              {modelName || "未配置模型"}
            </span>
            <Button variant="outline" size="sm" onClick={onCancel}>
              取消评估
            </Button>
          </>
        )
      }
    >
      {error ? (
        <div className="rounded-xl border border-[#F5DCE0] bg-[#FFF7F8] px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#C25867]" />
            <div>
              <p className="text-[12.5px] font-medium text-[#9C4052]">评估任务未完成</p>
              <p className="mt-1 text-[11.5px] leading-5 text-[#B06A78]">{error}</p>
            </div>
          </div>
        </div>
      ) : (
        <ProgressStages
          currentIndex={currentIndex}
          message={message}
          progress={progress}
          stages={EVALUATION_STAGES}
        />
      )}
    </Modal>
  );
}
