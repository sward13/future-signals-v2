import { createPortal } from "react-dom";

export function ConfirmModal({ message, onConfirm, onCancel }) {
  return createPortal(
    <>
      <div
        onClick={onCancel}
        className="fixed inset-0 bg-black/35 z-[400]"
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl py-6 px-7 shadow-[0_16px_48px_rgba(0,0,0,0.18)] z-[401] min-w-[320px] font-[inherit]">
        <div className="text-sm font-medium text-ink mb-1.5">
          {message}
        </div>
        <div className="text-xs text-muted mb-5 leading-[1.5]">
          This cannot be undone.
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-xs py-1.75 px-4 rounded-container bg-transparent text-muted border border-border-strong cursor-pointer font-[inherit]">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="py-1.75 px-4 rounded-container text-xs font-medium cursor-pointer font-[inherit] border-none bg-[#DC2626] text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
