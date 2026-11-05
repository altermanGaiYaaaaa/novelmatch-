import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  danger = false,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <span />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
              {cancelText}
            </Button>
            <Button
              variant={danger ? "danger" : "primary"}
              size="sm"
              loading={loading}
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
          </div>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF3F4] text-[#C25867]">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <p className="pt-1 text-[12.5px] leading-6 text-[#5F5A72]">{description}</p>
      </div>
    </Modal>
  );
}
