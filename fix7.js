const fs = require('fs');
const file = 'src/components/family-app.tsx';
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const t_expense_state = `  const [draft, setDraft] = useState<ExpenseDraft>(() => {`;
const r_expense_state = `  const [confirmCreditConversion, setConfirmCreditConversion] = useState<any>(null);
  const [draft, setDraft] = useState<ExpenseDraft>(() => {`;

const t_expense_submit = `    if (isCreditCard) {
      if (record) {
        // Edit pending tx
        // For simplicity, if it's already a real transaction, it cannot be converted back to pending here easily. 
        // We will assume pending tx edit is done in Bank Card UI, not here.
        // Actually, if we edit a real transaction and change it to credit card, it's complex.
        ui.toast("Không thể chuyển giao dịch thường thành tạm tính ở đây.", "error");
        return;
      }
      
      const payload = {
        memberId: draft.memberId,
        bankAccountId: finalPaymentAccountId,
        title: draft.vendor.trim() || "Khác",
        amount: totalAmount,
        date: draft.date,
        category: draft.category,
        note: draft.note
      };
      
      const response = await fetch("/api/card-pending-transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const result = await readJsonSafe<{ error?: string }>(response);
        ui.toast(result?.error || "Không thể lưu khoản chi tạm tính.", "error");
        return;
      }
      ui.toast("Đã ghi nhận chi tiêu thẻ vào phần Tạm tính.", "success");
      close();
      return;
    }`;

const r_expense_submit = `    if (isCreditCard) {
      if (record) {
        if (record.category === "Thanh toán thẻ") {
          ui.toast("Không thể chuyển giao dịch thanh toán thẻ.", "error");
          return;
        }
        if ((record as any).excluded_from_expense) {
          ui.toast("Giao dịch này đã được chuyển sang tạm tính trước đó.", "error");
          return;
        }
        setConfirmCreditConversion({ bankAccountId: finalPaymentAccountId });
        return;
      }
      
      const payload = {
        memberId: draft.memberId,
        bankAccountId: finalPaymentAccountId,
        title: draft.vendor.trim() || "Khác",
        amount: totalAmount,
        date: draft.date,
        category: draft.category,
        note: draft.note
      };
      
      const response = await fetch("/api/card-pending-transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const result = await readJsonSafe<{ error?: string }>(response);
        ui.toast(result?.error || "Không thể lưu khoản chi tạm tính.", "error");
        return;
      }
      ui.toast("Đã ghi nhận chi tiêu thẻ vào phần Tạm tính.", "success");
      close();
      return;
    }`;

const t_modal_place = `        {!compactMobile && <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-rose-500 px-6 py-3 text-sm font-bold text-white">Lưu phiếu chi</button></div>}
      </form>
    </div>;`;

const r_modal_place = `        {!compactMobile && <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={close} className="rounded-xl border border-[var(--app-border)] px-5 py-3 text-sm font-bold">Hủy</button><button className="rounded-xl bg-rose-500 px-6 py-3 text-sm font-bold text-white">Lưu phiếu chi</button></div>}
      </form>

      {confirmCreditConversion && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-[var(--app-card)] p-6 shadow-2xl">
            <h3 className="text-xl font-bold">Chuyển sang tạm tính thẻ</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              Giao dịch này sẽ được chuyển khỏi Chi thật và đưa vào Tạm tính thẻ tín dụng để tránh tính trùng.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button 
                type="button"
                onClick={() => setConfirmCreditConversion(null)} 
                className="rounded-xl border border-[var(--app-border)] px-5 py-2.5 text-sm font-bold hover:bg-slate-50 dark:hover:bg-white/5"
              >
                Hủy
              </button>
              <button 
                type="button"
                onClick={async () => {
                  try {
                    const response = await fetch(\`/api/transactions/\${record?.id}/convert-to-card-pending\`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ bank_account_id: confirmCreditConversion.bankAccountId })
                    });
                    const result = await readJsonSafe<{ error?: string }>(response);
                    if (!response.ok) {
                      ui.toast(result?.error || "Lỗi khi chuyển đổi giao dịch.", "error");
                    } else {
                      ui.toast("Đã chuyển sang tạm tính thẻ thành công.", "success");
                      setConfirmCreditConversion(null);
                      close();
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(new Event("app_notification_created"));
                      }
                    }
                  } catch (e) {
                    ui.toast("Lỗi hệ thống.", "error");
                  }
                }}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Chuyển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>;`;

let hasError = false;
if (!content.includes(t_expense_state)) { console.log("t_expense_state missing"); hasError = true; }
if (!content.includes(t_expense_submit)) { console.log("t_expense_submit missing"); hasError = true; }
if (!content.includes(t_modal_place)) { console.log("t_modal_place missing"); hasError = true; }

if (hasError) process.exit(1);

content = content.replace(t_expense_state, r_expense_state);
content = content.replace(t_expense_submit, r_expense_submit);
content = content.replace(t_modal_place, r_modal_place);

fs.writeFileSync(file, content);
console.log("Replaced successfully");
