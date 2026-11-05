import { BookOpen, Cpu, Link2, ShieldCheck, Sparkles, UserRoundSearch } from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

const steps = [
  {
    icon: UserRoundSearch,
    title: "建立品味画像",
    text: "选择题材，导入喜欢和讨厌的小说，按七维度评分或标出最差的方面。",
  },
  {
    icon: Sparkles,
    title: "让 AI 归纳偏好",
    text: "配置你自己的模型后，AI 会从参考样本中提炼总结、关键词与口味边界。",
  },
  {
    icon: Link2,
    title: "评估下一本小说",
    text: "粘贴公开小说链接，系统分析前十章，并给出与你当前画像的匹配度。",
  },
];

export function HelpModal() {
  const open = useAppStore((state) => state.helpModalOpen);
  const setOpen = useAppStore((state) => state.setHelpModalOpen);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      size="lg"
      title="使用指南"
      description="NovelMatch 不采用统一的大众评分，而是学习你自己的阅读标准。"
      footer={
        <>
          <span className="flex items-center gap-1.5 text-[10.5px] text-[#A09BAC]">
            <ShieldCheck className="h-3 w-3" />
            画像、评分与评估记录默认只保存在本机
          </span>
          <Button size="sm" onClick={() => setOpen(false)}>
            知道了
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            className="flex items-start gap-3.5 rounded-xl border border-[#F0EDF8] bg-[#FCFBFE] p-4"
            key={step.title}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#5B4BD6]">
              <step.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[12.5px] font-semibold text-[#2B273C]">
                {String(index + 1).padStart(2, "0")} · {step.title}
              </p>
              <p className="mt-1 text-[11.5px] leading-5 text-[#7E798F]">{step.text}</p>
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-[#EEEAF8] bg-[#FAF9FF] p-4">
          <div className="flex items-center gap-2 text-[12px] font-medium text-[#534A74]">
            <Cpu className="h-3.5 w-3.5 text-[#8D7FE0]" />
            关于模型与费用
          </div>
          <p className="mt-2 text-[11.5px] leading-6 text-[#807B92]">
            软件不内置统一 AI 网关。你需要在「模型设置」中填写自己的 API Key、模型名称和 Base URL。
            小说正文会发送到你配置的模型服务进行分析，调用费用由你的服务商账户承担。
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-[#EEECF6] bg-white px-3.5 py-2.5 text-[10.5px] leading-5 text-[#9A95A8]">
          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8D7FE0]" />
          仅支持合法公开访问的小说页面。软件不会绕过登录、付费墙或平台访问限制；正文只用于当前分析任务，不长期保存原文。
        </div>
      </div>
    </Modal>
  );
}
