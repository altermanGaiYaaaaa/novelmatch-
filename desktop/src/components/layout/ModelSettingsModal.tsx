import { useEffect, useState } from "react";
import {
  CircleAlert,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { backend } from "../../lib/backend";
import { errorMessage } from "../../lib/utils";
import { useAppStore } from "../../stores/appStore";
import type { TestConnectionResult } from "../../types";
import { Button } from "../ui/Button";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

export function ModelSettingsModal() {
  const open = useAppStore((state) => state.modelModalOpen);
  const setOpen = useAppStore((state) => state.setModelModalOpen);
  const modelConfig = useAppStore((state) => state.modelConfig);
  const refreshModel = useAppStore((state) => state.refreshModel);
  const showToast = useAppStore((state) => state.showToast);

  const [apiKey, setApiKey] = useState("");
  const [modelName, setModelName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApiKey("");
    setModelName(modelConfig.modelName);
    setBaseUrl(modelConfig.baseUrl);
    setShowKey(false);
    setError("");
    setTestResult(null);
    setTesting(false);
    setSaving(false);
  }, [open, modelConfig]);

  const close = () => setOpen(false);

  const validate = () => {
    if (!apiKey && !modelConfig.configured) {
      setError("请填写你的 API Key。");
      return false;
    }
    if (!modelName.trim()) {
      setError("请填写要调用的模型名称。");
      return false;
    }
    if (!/^https?:\/\/\S+/i.test(baseUrl.trim())) {
      setError("模型网址需以 http:// 或 https:// 开头。");
      return false;
    }
    setError("");
    return true;
  };

  const handleTest = async () => {
    if (!validate()) return;
    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const result = await backend.testModelConnection({
        apiKey: apiKey.trim() || undefined,
        modelName: modelName.trim(),
        baseUrl: baseUrl.trim(),
      });
      setTestResult(result);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setError("");
    try {
      await backend.saveModelConfig({
        apiKey: apiKey.trim(),
        modelName: modelName.trim(),
        baseUrl: baseUrl.trim().replace(/\/+$/, ""),
      });
      await refreshModel();
      showToast("模型配置已保存");
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      await backend.clearModelConfig();
      await refreshModel();
      setConfirmClear(false);
      showToast("模型配置已移除", "info");
      close();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={close}
        size="md"
        title="模型设置"
        description="填入你自己的 API Key，生成画像与评估会通过你指定的模型完成。"
        footer={
          <>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10.5px] text-[#A09BAC]">
                <ShieldCheck className="h-3 w-3" />
                API Key 仅保存在本机系统凭据中
              </span>
              {modelConfig.configured ? (
                <button
                  className="text-[10.5px] font-medium text-[#B04A5D] transition hover:text-[#8F3345]"
                  onClick={() => setConfirmClear(true)}
                  type="button"
                >
                  移除配置
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={close} disabled={saving}>
                取消
              </Button>
              <Button size="sm" loading={saving} onClick={handleSave}>
                保存配置
              </Button>
            </div>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-[#3C374E]" htmlFor="modelApiKey">
              API Key
            </label>
            <div className="relative mt-2">
              <Input
                autoComplete="off"
                className="pr-11"
                id="modelApiKey"
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setError("");
                }}
                placeholder={
                  modelConfig.configured
                    ? `已保存 ${modelConfig.apiKeyMasked || "••••"}，留空保持不变`
                    : "sk-..."
                }
                spellCheck={false}
                type={showKey ? "text" : "password"}
                value={apiKey}
              />
              <button
                aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}
                className="absolute right-1.5 top-1/2 flex h-7 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#A6A2B4] transition hover:bg-[#F5F3FA] hover:text-[#5B4BD6]"
                onClick={() => setShowKey((value) => !value)}
                type="button"
              >
                {showKey ? <EyeOff className="h-[15px] w-[15px]" /> : <Eye className="h-[15px] w-[15px]" />}
              </button>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-5 text-[#A09BAC]">
              仅保存在本机系统凭据中，不会写入数据库、日志或上传到 NovelMatch 服务器。
            </p>
          </div>

          <div>
            <label className="text-[12px] font-medium text-[#3C374E]" htmlFor="modelName">
              模型名称
            </label>
            <Input
              autoComplete="off"
              className="mt-2"
              id="modelName"
              onChange={(event) => {
                setModelName(event.target.value);
                setError("");
              }}
              placeholder="例如 deepseek-chat、gpt-4o-mini"
              spellCheck={false}
              value={modelName}
            />
            <p className="mt-1.5 text-[10.5px] leading-5 text-[#A09BAC]">
              填写服务商文档中的模型标识，需要与接口兼容。
            </p>
          </div>

          <div>
            <label className="text-[12px] font-medium text-[#3C374E]" htmlFor="modelBaseUrl">
              模型网址
            </label>
            <Input
              autoComplete="off"
              className="mt-2"
              id="modelBaseUrl"
              onChange={(event) => {
                setBaseUrl(event.target.value);
                setError("");
              }}
              placeholder="例如 https://api.deepseek.com"
              spellCheck={false}
              value={baseUrl}
            />
            <p className="mt-1.5 text-[10.5px] leading-5 text-[#A09BAC]">
              只填 Base URL，程序会自动拼接 /chat/completions。通常以 /v1 结尾。
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#EEECF6] bg-[#FAFAFD] px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-[11px] text-[#7C7790]">
              <Cpu className="h-3.5 w-3.5 text-[#8D7FE0]" />
              保存前可先验证一次连接
            </span>
            <Button
              disabled={testing || saving}
              onClick={handleTest}
              size="sm"
              variant="outline"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {testing ? "验证中" : "测试连接"}
            </Button>
          </div>

          {testResult?.ok ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#DDF3E8] bg-[#F4FBF7] px-3.5 py-2.5 text-[11.5px] leading-5 text-[#227A50]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                连接成功，模型在 {testResult.latencyMs} ms 内返回了响应。
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-[#F5DCE0] bg-[#FFF7F8] px-3.5 py-2.5 text-[11.5px] leading-5 text-[#B04A5D]">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={handleClear}
        title="移除模型配置"
        description="将删除本机保存的 API Key、模型名称和接口地址。已有的画像与评估记录不会受影响。"
        confirmText="移除配置"
        danger
        loading={clearing}
      />
    </>
  );
}
