"use client";

import { useState, useEffect, useCallback } from "react";
import { BankAccount } from "@/types";
import { formatCardUsageDuration, formatISODateToVN } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function BankCardListPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);
  const [spending, setSpending] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    params.then((p) => setMemberId(p.id));
  }, [params]);

  const load = useCallback(async () => {
    if (!memberId) return;
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/api/bank-accounts?memberId=${memberId}`, { cache: "no-store", headers: { "pragma": "no-cache", "cache-control": "no-cache" } });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error || "Không thể tải danh sách thẻ");
      }
      const accs = (result.data || []).filter((a: BankAccount) => ['active', 'Đang dùng'].includes(a.status));
      setAccounts(accs);
      
      // Fetch stats for each card
      const spendingMap: Record<string, number> = {};
      await Promise.all(accs.map(async (acc: BankAccount) => {
        try {
          const statRes = await fetch(`/api/bank-accounts/${acc.id}/stats`);
          const statData = await statRes.json();
          if (statData?.ok && statData?.data) {
            spendingMap[acc.id] = statData.data.eligibleSpending || 0;
          }
        } catch {
          // ignore
        }
      }));
      setSpending(spendingMap);
      
    } catch (e: any) {
      setError(e.message || "Lỗi kết nối");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    load();
  }, [load]);

  const money = (value: number) => new Intl.NumberFormat("vi-VN").format(Number.isFinite(value) ? value : 0) + " đ";

  const handleBack = () => {
    if (window.history.length > 2) {
      router.back();
    } else {
      router.push(`/members/${memberId}`);
    }
  };

  if (!memberId) return <div className="p-8 text-center text-slate-500">Đang tải...</div>;

  return (
    <div className="mx-auto max-w-md pb-12 min-h-screen bg-[#F8F5F2]">
      {/* Header giống SIM/Data */}
      <div className="sticky top-0 z-10 flex h-14 items-center justify-between bg-white px-4 shadow-sm border-b border-[#E7DDD6]">
        <button
          onClick={handleBack}
          className="flex h-10 w-10 items-center justify-center -ml-2 text-[#2B1B17] hover:bg-[#F8F5F2] rounded-full transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-[17px] font-bold text-[#2B1B17]">Thẻ ngân hàng</h1>
        <div className="w-10"></div> {/* Spacer to center the title */}
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
            <p className="font-semibold text-rose-600">{error}</p>
            <button
              onClick={load}
              className="mt-4 rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-600 hover:bg-rose-100"
            >
              Thử lại
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-12 text-[#6B5B57] text-sm">Đang tải dữ liệu...</div>
        ) : (
          <>
            {accounts && accounts.length > 0 && (
              <div className="flex flex-col gap-3">
                {accounts.map((card) => {
                  const isCredit = card.accountType === "Thẻ tín dụng" || card.cardType === "credit" || card.cardType === "Thẻ tín dụng" || card.accountType === "credit";
                  const typeStr = isCredit ? "Thẻ tín dụng" : "Thẻ ghi nợ";
                  const spent = spending[card.id] || 0;
                  
                  let deadlineStr = "";
                  if (isCredit) {
                    if (card.dueDay) {
                      deadlineStr = `Ngày ${card.dueDay} hằng tháng`;
                    } else if (card.statementDay) {
                      deadlineStr = `Ngày ${card.statementDay} hằng tháng`;
                    } else {
                      deadlineStr = "Chưa thiết lập";
                    }
                  } else {
                    deadlineStr = "Không áp dụng";
                  }

                  return (
                    <button
                      key={card.id}
                      onClick={() => router.push(`/members/${memberId}/bank-cards/${card.id}`)}
                      className="flex flex-col rounded-[16px] border border-[#E7DDD6] bg-white p-4 text-left shadow-sm active:bg-[#F8F5F2] transition-colors"
                    >
                      <h3 className="font-bold text-[#2B1B17] text-base">
                        {(() => {
                          const name = card.displayName || card.productName;
                          if (!name) return card.bankName;
                          if (name.toLowerCase().includes(card.bankName.toLowerCase())) return name;
                          return `${card.bankName} ${name}`;
                        })()}
                      </h3>
                      
                      <p className="text-[13px] text-[#6B5B57] mt-1.5">
                        Đã chi năm nay: <span className="font-bold text-[#800020]">{money(spent)}</span> · {typeStr}
                      </p>
                      
                      <p className="text-[13px] text-[#6B5B57] mt-0.5">
                        Kỳ hạn: <span className="font-medium text-[#2B1B17]">{deadlineStr}</span>
                      </p>

                      <p className="text-[13px] text-[#6B5B57] mt-0.5">
                        Ngày mở: <span className="font-medium text-[#2B1B17]">{card.openedAt ? formatISODateToVN(card.openedAt) : "Chưa cập nhật"}</span>
                      </p>

                      <p className="text-[13px] text-[#6B5B57] mt-0.5">
                        Đã dùng: <span className="font-medium text-[#2B1B17]">{formatCardUsageDuration(card.openedAt)}</span>
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
            
            {/* Nút Thêm Thẻ Giống SIM/Data */}
            <button
              onClick={() => router.push(`/members/${memberId}/bank-cards/new`)}
              className="flex w-full items-center justify-center rounded-[16px] border-2 border-dashed border-[#D4AF37] bg-[#FFFDFC] py-4 text-sm font-bold text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors mt-2"
            >
              + Thêm thẻ mới
            </button>
          </>
        )}
      </div>
    </div>
  );
}
