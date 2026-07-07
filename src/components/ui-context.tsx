"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastType = "success" | "error";

interface UIContextType {
  toast: (message: string, type?: ToastType) => void;
  confirm: (title: string, message: string, confirmText?: string, confirmColor?: string) => Promise<boolean>;
}

const UIContext = createContext<UIContextType | null>(null);

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [toastMessage, setToastMessage] = useState<{ message: string; type: ToastType; id: number } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; confirmText?: string; confirmColor?: string; resolve: (val: boolean) => void } | null>(null);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setToastMessage({ message, type, id });
    setTimeout(() => {
      setToastMessage(current => (current?.id === id ? null : current));
    }, 3000);
  }, []);

  const confirm = useCallback((title: string, message: string, confirmText?: string, confirmColor?: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmDialog({ title, message, confirmText, confirmColor, resolve });
    });
  }, []);

  const handleConfirm = (val: boolean) => {
    if (confirmDialog) {
      confirmDialog.resolve(val);
      setConfirmDialog(null);
    }
  };

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      
      {/* AppToast */}
      {toastMessage && (
        <div className="fixed left-1/2 top-4 z-[9999] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl px-4 py-3 text-center text-sm font-semibold text-white shadow-xl animate-in fade-in slide-in-from-top-5 duration-300 sm:w-auto sm:px-6"
             style={{ backgroundColor: toastMessage.type === "success" ? "#10b981" : "#f43f5e" }}>
          {toastMessage.message}
        </div>
      )}

      {/* ConfirmDialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:p-6">
            <h3 className="mb-2 text-xl font-bold">{confirmDialog.title}</h3>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => handleConfirm(false)} className="rounded-xl bg-slate-100 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                Hủy
              </button>
              <button onClick={() => handleConfirm(true)} className={`rounded-xl px-5 py-2 font-bold text-white ${confirmDialog.confirmColor ? '' : 'bg-rose-500 hover:bg-rose-600'}`} style={confirmDialog.confirmColor ? { backgroundColor: confirmDialog.confirmColor } : undefined}>
                {confirmDialog.confirmText || "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}
