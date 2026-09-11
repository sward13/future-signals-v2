/**
 * UnsavedChangesDialog — 3-way confirmation shown when the user tries to
 * navigate away from a cluster draft that has unsaved changes (switch clusters,
 * start a new one, or close the rail). Choices: Keep editing · Discard · Save.
 *
 * @param {{ onKeepEditing: () => void, onDiscard: () => void, onSave: () => void }} props
 */
import { useEffect } from "react";

export function UnsavedChangesDialog({ onKeepEditing, onDiscard, onSave }) {
  // Escape = the safe default (keep editing / cancel the navigation).
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); onKeepEditing(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onKeepEditing]);

  return (
    <>
      <div onClick={onKeepEditing} className="fixed inset-0 bg-black/35 z-[700]" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-container border border-border-mid shadow-[0_8px_32px_rgba(0,0,0,0.16)] z-[701] pt-6 px-6 pb-5">
        <div className="text-[15px] font-medium text-ink mb-2">Unsaved changes</div>
        <div className="text-ui text-muted leading-[1.55] mb-5.5">
          You have unsaved changes to this cluster. Save them before leaving?
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDiscard}
            className="text-ui text-red-800 bg-transparent border-none cursor-pointer font-[inherit] py-2.25 px-1"
          >
            Discard
          </button>
          <div className="flex-1" />
          <button
            onClick={onKeepEditing}
            className="py-2.25 px-4 rounded-container bg-transparent text-muted border border-border-strong text-ui cursor-pointer font-[inherit]"
          >
            Keep editing
          </button>
          <button
            onClick={onSave}
            className="py-2.5 px-5 rounded-container bg-brand text-white border-none text-ui font-medium cursor-pointer font-[inherit]"
          >
            Save changes
          </button>
        </div>
      </div>
    </>
  );
}
