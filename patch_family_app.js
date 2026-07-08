const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/family-app.tsx');
let content = fs.readFileSync(file, 'utf8');

const targetStr = `            <div className="mt-3 rounded-xl bg-black/5 p-3 text-[12px] leading-relaxed text-[#171018]">
              <p className="mb-1 font-semibold text-[#6B5E64]">Chi tiết:</p>
              <p>Dư từ tháng trước: {money(currentMonthData?.openingBalance || 0)} đ</p>
              <p>Thu tháng này: {money(currentMonthData?.income || 0)} đ</p>
              <p>Chi thật tháng này: {money(currentMonthData?.expense || 0)} đ</p>
              <p>Tiết kiệm tháng này: {money((currentMonthData?.savingsInExpense || 0) + (currentMonthData?.savingsRecords || 0))} đ</p>
              <p className="mt-1 border-t border-black/10 pt-1 text-[11px] text-[#6B5E64]">
                Công thức:<br/>
                {money(currentMonthData?.openingBalance || 0)} + {money(currentMonthData?.income || 0)} - {money(currentMonthData?.expense || 0)} - {money((currentMonthData?.savingsInExpense || 0) + (currentMonthData?.savingsRecords || 0))} = {money(availableThisMonth!)} đ
              </p>
            </div>

            {pendingCredit > 0 && <p className="mb-0 mt-3 text-[12px] leading-4 text-[#6B5E64]">Sau khi trả thẻ dự kiến: <span className="font-semibold text-[#171018]">{loadingOverview ? "..." : money(afterCreditPayment!)}</span></p>}`;

const newStr = `            <div className="mt-3 rounded-xl bg-black/5 p-3 text-[12px] leading-relaxed text-[#171018]">
              <p className="mb-1 font-semibold text-[#6B5E64]">Chi tiết:</p>
              <p>Dư từ tháng trước: {money(currentMonthData?.openingBalance || 0)} đ</p>
              <p>Thu tháng này: {money(currentMonthData?.income || 0)} đ</p>
              <p>Chi thật tháng này: {money(currentMonthData?.expense || 0)} đ</p>
              <p>Tiết kiệm tháng này: {money((currentMonthData?.savingsInExpense || 0) + (currentMonthData?.savingsRecords || 0))} đ</p>
            </div>`;

content = content.replace(targetStr, newStr);

fs.writeFileSync(file, content, 'utf8');
console.log('patched family-app');
