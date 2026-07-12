import React from "react";
import { ExpenseGroup, TransactionItem } from "../types";
import { safeId } from "../lib/safe-id";

const inputClass = "w-full min-w-0 max-w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-background)] px-3 py-3 text-sm outline-none focus:border-rose-400";
const parseMoneyInput = (value: string) => Math.max(0, Math.round(Number(value.replace(/\D/g, "")) || 0));
const formatMoneyInput = (value: unknown) => {
  const amount = Math.round(Number(value) || 0);
  return amount > 0 ? new Intl.NumberFormat("vi-VN").format(amount) : "";
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ExpenseGroupSelector({
  value,
  onChange,
  expenseGroups,
  onAddGroup
}: {
  value: string;
  onChange: (val: string) => void;
  expenseGroups: ExpenseGroup[];
  onAddGroup: () => void;
}) {
  const activeGroups = expenseGroups.filter(group => (group.status || "active") === "active");

  return (
    <Field label="Nhom chi tieu">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select
          className={inputClass}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Khong thuoc nhom nao</option>
          {activeGroups.map(group => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onAddGroup}
          className="rounded-xl border border-[var(--app-border)] px-3 text-sm font-bold text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          + Nhom
        </button>
      </div>
    </Field>
  );
}

export function TransactionItemsEditor({
  items,
  onChange
}: {
  items: TransactionItem[];
  onChange: (items: TransactionItem[]) => void;
}) {
  const itemTotal = (item: TransactionItem) => Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice ?? item.unit_price) || 0));
  const total = items.reduce((sum, item) => sum + itemTotal(item), 0);

  const handleAdd = () => {
    onChange([...items, { id: safeId(), transactionId: "", name: "", quantity: 1, unitPrice: 0, amount: 0, category: "Khac", note: "" }]);
  };

  const handleUpdate = (index: number, field: keyof TransactionItem, value: string) => {
    const next = [...items];
    const current = { ...next[index] };
    if (field === "quantity" || field === "unitPrice" || field === "unit_price") {
      const numericValue = field === "quantity" ? Math.max(0, Number(value) || 0) : parseMoneyInput(value);
      if (field === "unit_price") {
        current.unitPrice = numericValue;
        current.unit_price = numericValue;
      } else {
        (current as any)[field] = numericValue;
        if (field === "unitPrice") current.unit_price = numericValue;
      }
      current.amount = itemTotal(current);
    } else {
      (current as any)[field] = value;
    }
    next[index] = current;
    onChange(next);
  };

  const handleRemove = (index: number) => {
    const next = [...items];
    next.splice(index, 1);
    onChange(next);
  };

  if (items.length === 0) {
    return (
      <div className="col-span-full mt-2">
        <button type="button" onClick={handleAdd} className="text-sm font-bold text-blue-600 hover:underline">
          + Them chi tiet san pham
        </button>
      </div>
    );
  }

  return (
    <div className="col-span-full mt-2 space-y-3 rounded-xl border border-[var(--app-border)] bg-slate-50/50 p-4 dark:bg-slate-900/50">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold">Chi tiet san pham</h4>
        <button type="button" onClick={handleAdd} className="text-sm font-bold text-blue-600 hover:underline">
          + Them
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id || index} className="space-y-3 rounded-lg border border-[var(--app-border)] bg-white p-3 dark:bg-slate-950">
            <Field label="San pham">
              <input
                className={inputClass}
                placeholder="Ten san pham..."
                value={item.name}
                onChange={(event) => handleUpdate(index, "name", event.target.value)}
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="So luong">
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  className={inputClass}
                  value={item.quantity || ""}
                  onChange={(event) => handleUpdate(index, "quantity", event.target.value)}
                />
              </Field>
              <Field label="Don gia">
                <input
                  type="text"
                  inputMode="numeric"
                  min="0"
                  className={inputClass}
                  value={formatMoneyInput(item.unitPrice ?? item.unit_price)}
                  onChange={(event) => handleUpdate(index, "unitPrice", event.target.value)}
                  onBlur={(event) => { event.currentTarget.value = formatMoneyInput(item.unitPrice ?? item.unit_price); }}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-dashed border-[var(--app-border)] pt-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Thanh tien: <span className="text-blue-600 dark:text-blue-400">{new Intl.NumberFormat("vi-VN").format(itemTotal(item))} d</span>
              </p>
              <button type="button" onClick={() => handleRemove(index)} className="rounded-lg px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                Xoa
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--app-border)] pt-2 text-sm font-semibold">
        <span>Tong san pham:</span>
        <span className="text-base text-blue-600 dark:text-blue-400">
          {new Intl.NumberFormat("vi-VN").format(total)} d
        </span>
      </div>
    </div>
  );
}
