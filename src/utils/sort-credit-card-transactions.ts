export function sortCreditCardTransactions(transactions: any[]) {
  if (!transactions || !Array.isArray(transactions)) return [];
  return [...transactions].sort((a: any, b: any) => {
    const getMs = (t: any) => new Date(t.purchaseDate || t.date || t.createdAt || t.created_at).getTime();
    const dDiff = getMs(b) - getMs(a);
    if (dDiff !== 0) return dDiff;

    // Tie-breakers if the effective dates are identical
    const dateDiff = new Date(b.date || b.createdAt || b.created_at).getTime() - new Date(a.date || a.createdAt || a.created_at).getTime();
    if (dateDiff !== 0) return dateDiff;
    
    return new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime();
  });
}
