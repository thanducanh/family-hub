import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowDownCircle, ArrowUpCircle, BriefcaseBusiness, PiggyBank, Plus, Trash2, X } from 'lucide-react-native';
import { api } from '../../lib/api';

type FinanceTab = 'overview' | 'income' | 'expense' | 'savings' | 'investment';
type ModalKind = 'income' | 'expense' | 'saving' | 'investment';

interface IncomeItem {
  id: string;
  date: string;
  time?: string;
  category: string;
  title: string;
  amount: number;
  method?: string;
  note?: string;
}

interface TransactionItem {
  id: string;
  date: string;
  time?: string;
  type: string;
  category: string;
  subcategory?: string;
  title: string;
  amount: number;
  grossAmount?: number;
  paymentMethod?: string;
  paymentAccountId?: string;
  note?: string;
  isReimbursable?: boolean;
  reimbursementPerson?: string;
  reimbursementStatus?: string;
  countsForPersonalExpense?: boolean;
  countsForCardSpending?: boolean;
  source?: 'manual_saving' | 'expense_saving';
  originalId?: string;
}

interface SavingItem {
  id: string;
  originalId: string;
  source: 'manual_saving' | 'expense_saving';
  date: string;
  amount: number;
  holder: string;
  note?: string;
  title: string;
}

interface InvestmentItem {
  id: string;
  tradeDate: string;
  stockCode: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  note?: string;
}

const TABS: { key: FinanceTab; label: string }[] = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'income', label: 'Thu nhập' },
  { key: 'expense', label: 'Chi tiêu' },
  { key: 'savings', label: 'Tiết kiệm' },
  { key: 'investment', label: 'Đầu tư' },
];

const EXPENSE_CATEGORIES = ['Ăn uống', 'Sinh hoạt', 'Di chuyển', 'Mua sắm', 'Sức khỏe', 'Giáo dục', 'Tiết kiệm', 'Thanh toán hộ', 'Khác'];
const INCOME_CATEGORIES = ['Lương', 'Thưởng', 'Tiền lễ', 'Khác'];
const INVEST_ACTIONS = [
  { label: 'Mua', value: 'buy' },
  { label: 'Bán', value: 'sell' },
];

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function makeId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function money(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} đ`;
}

function dateText(value: string) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}

function dataArray(response: any) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.rows)) return response.data.rows;
  if (Array.isArray(response?.data?.incomeRecords)) return response.data.incomeRecords;
  if (Array.isArray(response?.rows)) return response.rows;
  return [];
}

function flattenIncomeRows(value: any): any[] {
  const root = value?.data || value;
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.records)) return root.records;
  if (Array.isArray(root?.rows)) return root.rows;
  const buckets = root?.monthlyData || root?.months || root?.data;
  if (Array.isArray(buckets)) {
    return buckets.flatMap((month: any) => month.records || month.items || month.incomes || []);
  }
  if (root && typeof root === 'object') {
    return Object.values(root).flatMap((item: any) => Array.isArray(item) ? item : Array.isArray(item?.records) ? item.records : []);
  }
  return [];
}

function normalizeIncome(item: any): IncomeItem {
  return {
    id: String(item.id || makeId('income')),
    date: String(item.incomeDate || item.income_date || item.receivedDate || item.received_date || item.date || todayLocal()).slice(0, 10),
    time: String(item.time || item.receivedTime || item.received_time || ''),
    category: String(item.category || 'Khác'),
    title: String(item.name || item.content || item.description || item.title || 'Khoản thu'),
    amount: Number(item.amount || 0),
    method: String(item.method || item.paymentMethod || item.payment_method || ''),
    note: String(item.note || ''),
  };
}

function normalizeTransaction(item: any): TransactionItem {
  const category = String(item.category || 'Khác');
  return {
    id: String(item.id || makeId('tx')),
    date: String(item.date || item.expenseDate || item.createdAt || todayLocal()).slice(0, 10),
    time: String(item.transactionTime || item.transaction_time || item.time || ''),
    type: String(item.type || 'expense'),
    category,
    subcategory: String(item.subcategory || ''),
    title: String(item.title || item.description || item.content || category),
    amount: Number(item.amount || 0),
    grossAmount: Number(item.grossAmount || item.gross_amount || item.amount || 0),
    paymentMethod: String(item.paymentMethod || item.payment_method || 'cash'),
    paymentAccountId: String(item.paymentAccountId || item.payment_account_id || item.bankAccountId || item.bank_account_id || ''),
    note: String(item.note || ''),
    isReimbursable: Boolean(item.isReimbursable || item.is_reimbursable || category === 'Thanh toán hộ'),
    reimbursementPerson: String(item.reimbursementPerson || item.reimbursement_person || ''),
    reimbursementStatus: String(item.reimbursementStatus || item.reimbursement_status || (category === 'Thanh toán hộ' ? 'pending' : 'none')),
    countsForPersonalExpense: item.countsForPersonalExpense ?? item.counts_for_personal_expense ?? !['Tiết kiệm', 'Thanh toán hộ'].includes(category),
    countsForCardSpending: item.countsForCardSpending ?? item.counts_for_card_spending ?? category !== 'Tiết kiệm',
  };
}

function normalizeSaving(item: any): SavingItem {
  const source = String(item.id || '').startsWith('transaction-') ? 'expense_saving' : 'manual_saving';
  const year = Number(item.year || new Date().getFullYear());
  const month = Number(item.month || 1);
  return {
    id: `${source === 'expense_saving' ? 'expense' : 'manual'}-${String(item.id).replace(/^transaction-/, '')}`,
    originalId: String(item.id || '').replace(/^transaction-/, ''),
    source,
    date: `${year}-${String(month).padStart(2, '0')}-01`,
    amount: Number(item.amount || 0),
    holder: String(item.holder || item.savingsHolder || item.subcategory || 'Khác'),
    note: String(item.note || ''),
    title: String(item.description || item.title || 'Tiết kiệm'),
  };
}

function normalizeInvestment(item: any): InvestmentItem {
  return {
    id: String(item.id || makeId('investment')),
    tradeDate: String(item.tradeDate || item.trade_date || todayLocal()).slice(0, 10),
    stockCode: String(item.stockCode || item.stock_code || '').toUpperCase(),
    action: String(item.action || 'buy') === 'sell' ? 'sell' : 'buy',
    quantity: Number(item.quantity || 0),
    price: Number(item.price || 0),
    fee: Number(item.fee || 0),
    note: String(item.note || ''),
  };
}

function bankLabel(item: any) {
  return [item.bankName || item.bank_name, item.productName || item.product_name, item.last4 ? `****${item.last4}` : ''].filter(Boolean).join(' - ');
}

export default function FinanceScreen() {
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [savings, setSavings] = useState<SavingItem[]>([]);
  const [investments, setInvestments] = useState<InvestmentItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalKind, setModalKind] = useState<ModalKind | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(todayLocal());
  const [time, setTime] = useState('08:00');
  const [category, setCategory] = useState('Khác');
  const [subcategory, setSubcategory] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [bankAccountId, setBankAccountId] = useState('');
  const [note, setNote] = useState('');
  const [reimbursementPerson, setReimbursementPerson] = useState('');
  const [investmentAction, setInvestmentAction] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('0');

  const year = new Date().getFullYear();

  const loadAll = useCallback(async () => {
    try {
      setError(null);
      const [overviewRes, incomeRes, txRes, savingsRes, investmentRes, bankRes] = await Promise.allSettled([
        api.get(`/api/finance-overview?year=${year}`),
        api.get(`/api/incomes?year=${year}`),
        api.get('/api/transactions'),
        api.get(`/api/savings-records?year=${year}`),
        api.get('/api/investments'),
        api.get('/api/bank-accounts'),
      ]);

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value?.data || overviewRes.value);
      if (incomeRes.status === 'fulfilled') setIncomes(flattenIncomeRows(incomeRes.value).map(normalizeIncome).sort((a, b) => b.date.localeCompare(a.date)));
      if (txRes.status === 'fulfilled') {
        const list = dataArray(txRes.value).map(normalizeTransaction);
        setTransactions(list.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)));
      }
      if (savingsRes.status === 'fulfilled') setSavings(dataArray(savingsRes.value).map(normalizeSaving));
      if (investmentRes.status === 'fulfilled') setInvestments(dataArray(investmentRes.value).map(normalizeInvestment));
      if (bankRes.status === 'fulfilled') setBankAccounts(dataArray(bankRes.value));

      const rejected = [overviewRes, incomeRes, txRes, savingsRes, investmentRes, bankRes].find(item => item.status === 'rejected') as PromiseRejectedResult | undefined;
      if (rejected) setError(rejected.reason?.message || 'Một phần dữ liệu chưa tải được.');
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu Thu chi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [year]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
  }, [loadAll]);

  const resetForm = (kind: ModalKind) => {
    setEditingId(null);
    setDate(todayLocal());
    setTime('08:00');
    setCategory(kind === 'income' ? 'Lương' : kind === 'expense' ? 'Khác' : kind === 'saving' ? 'Tiết kiệm' : 'Đầu tư');
    setSubcategory('');
    setTitle('');
    setAmount('');
    setGrossAmount('');
    setMethod('cash');
    setBankAccountId('');
    setNote('');
    setReimbursementPerson('');
    setInvestmentAction('buy');
    setQuantity('');
    setPrice('');
    setFee('0');
  };

  const openAdd = (kind: ModalKind) => {
    resetForm(kind);
    setModalKind(kind);
  };

  const openIncomeEdit = (item: IncomeItem) => {
    setModalKind('income');
    setEditingId(item.id);
    setDate(item.date);
    setTime(item.time || '08:00');
    setCategory(item.category || 'Khác');
    setTitle(item.title);
    setAmount(String(item.amount || ''));
    setMethod(item.method || 'cash');
    setNote(item.note || '');
  };

  const openExpenseEdit = (item: TransactionItem) => {
    setModalKind('expense');
    setEditingId(item.id);
    setDate(item.date);
    setTime(item.time || '08:00');
    setCategory(item.category || 'Khác');
    setSubcategory(item.subcategory || '');
    setTitle(item.title);
    setAmount(String(item.amount || ''));
    setGrossAmount(String(item.grossAmount || item.amount || ''));
    setMethod(item.paymentMethod || 'cash');
    setBankAccountId(item.paymentAccountId || '');
    setNote(item.note || '');
    setReimbursementPerson(item.reimbursementPerson || '');
  };

  const saveIncome = async () => {
    if (!title.trim() || Number(amount) <= 0) return Alert.alert('Lỗi', 'Vui lòng nhập nội dung và số tiền hợp lệ.');
    const payload = { id: editingId || makeId('income'), date, incomeDate: date, receivedDate: date, time, category, name: title.trim(), amount: Number(amount), status: 'Đã nhận', method, note };
    if (editingId) await api.put(`/api/incomes?id=${editingId}`, payload);
    else await api.post('/api/incomes', payload);
  };

  const expenseFlags = (cat: string) => {
    if (cat === 'Tiết kiệm') return { countsForPersonalExpense: false, countsForCardSpending: false, isReimbursable: false, reimbursementStatus: 'none' };
    if (cat === 'Thanh toán hộ') return { countsForPersonalExpense: false, countsForCardSpending: true, isReimbursable: true, reimbursementStatus: 'pending' };
    return { countsForPersonalExpense: true, countsForCardSpending: true, isReimbursable: false, reimbursementStatus: 'none' };
  };

  const saveExpense = async () => {
    if (!title.trim() || Number(amount) <= 0) return Alert.alert('Lỗi', 'Vui lòng nhập nội dung và số tiền hợp lệ.');
    const flags = expenseFlags(category);
    const payload = {
      id: editingId || makeId('tx'),
      type: 'expense',
      title: title.trim(),
      category,
      subcategory,
      amount: Number(amount),
      grossAmount: Number(grossAmount || amount),
      date,
      transactionTime: time,
      paymentMethod: method,
      paymentAccountId: bankAccountId || null,
      bankAccountId: bankAccountId || null,
      note,
      reimbursementPerson: category === 'Thanh toán hộ' ? reimbursementPerson : '',
      reimbursedAmount: 0,
      ...flags,
    };
    if (editingId) await api.put('/api/transactions', payload);
    else await api.post('/api/transactions', payload);
  };

  const saveSaving = async () => {
    if (Number(amount) <= 0) return Alert.alert('Lỗi', 'Vui lòng nhập số tiền hợp lệ.');
    const [y, m] = date.split('-').map(Number);
    await api.post('/api/savings-records', {
      id: editingId || makeId('saving'),
      year: y,
      month: m,
      amount: Number(amount),
      type: category === 'Rút tiết kiệm' ? 'withdraw' : 'manual',
      holder: subcategory || 'Ngân hàng',
      description: title || 'Tiết kiệm thủ công',
      note,
    });
  };

  const saveInvestment = async () => {
    if (!title.trim() || Number(quantity) <= 0 || Number(price) <= 0) return Alert.alert('Lỗi', 'Vui lòng nhập mã, số lượng và giá hợp lệ.');
    await api.post('/api/investments', {
      tradeDate: date,
      stockCode: title.trim(),
      action: investmentAction,
      quantity: Number(quantity),
      price: Number(price),
      fee: Number(fee || 0),
      note,
    });
  };

  const saveForm = async () => {
    if (!modalKind) return;
    try {
      setSaving(true);
      if (modalKind === 'income') await saveIncome();
      if (modalKind === 'expense') await saveExpense();
      if (modalKind === 'saving') await saveSaving();
      if (modalKind === 'investment') await saveInvestment();
      setModalKind(null);
      await loadAll();
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể lưu dữ liệu.');
    } finally {
      setSaving(false);
    }
  };

  const deleteIncome = (id: string) => {
    Alert.alert('Xóa khoản thu', 'Bạn có chắc muốn xóa?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => { await api.delete(`/api/incomes?id=${id}`); await loadAll(); } },
    ]);
  };

  const deleteExpense = (id: string) => {
    Alert.alert('Xóa khoản chi', 'Bạn có chắc muốn xóa?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: async () => { await api.delete(`/api/transactions?id=${id}`); await loadAll(); } },
    ]);
  };

  const currentCash = Number(overview?.currentCash || 0);
  const currentSavings = Number(overview?.currentSavings || overview?.savingsBreakdown?.currentSavings || 0);
  const currentInvestment = Number(overview?.currentInvestment || overview?.investmentBreakdown?.currentInvestment || 0);
  const estimatedAssets = Number(overview?.estimatedAssets || overview?.totalAssetBreakdown?.totalAssets || 0);
  const monthlyData = Array.isArray(overview?.monthlyData) ? overview.monthlyData : [];
  const totalIncomeYear = monthlyData.reduce((sum: number, item: any) => sum + Number(item.income || 0), 0);
  const totalExpenseYear = monthlyData.reduce((sum: number, item: any) => sum + Number(item.expense || 0), 0);
  const afterExpense = totalIncomeYear - totalExpenseYear;
  const realCashFlow = monthlyData.reduce((sum: number, item: any) => sum + Number(item.monthlyCashFlow || 0), 0);
  const expenseList = transactions.filter(item => item.type === 'expense');
  const totalSavings = currentSavings || savings.reduce((sum, item) => sum + (item.source === 'manual_saving' && item.title.toLowerCase().includes('rút') ? -item.amount : item.amount), 0);
  const investmentBuy = investments.filter(item => item.action === 'buy').reduce((sum, item) => sum + item.quantity * item.price + item.fee, 0);
  const investmentSell = investments.filter(item => item.action === 'sell').reduce((sum, item) => sum + item.quantity * item.price - item.fee, 0);

  const overviewCards = [
    ['Tiền hiện tại ước tính', currentCash, '#4f46e5'],
    ['Tiết kiệm hiện có', currentSavings, '#0ea5e9'],
    ['Đầu tư hiện có', currentInvestment, '#f97316'],
    ['Tổng tài sản ước tính', estimatedAssets, '#7c3aed'],
    ['Tổng thu năm', totalIncomeYear, '#10b981'],
    ['Tổng chi năm', totalExpenseYear, '#ef4444'],
    ['Dư sau chi', afterExpense, '#14b8a6'],
    ['Dòng tiền thực còn', realCashFlow, '#6366f1'],
  ] as const;

  const activeAddKind: ModalKind | null = activeTab === 'income' ? 'income' : activeTab === 'expense' ? 'expense' : activeTab === 'savings' ? 'saving' : activeTab === 'investment' ? 'investment' : null;

  const renderOverview = () => (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />} contentContainerStyle={styles.scrollContent}>
      <View style={styles.overviewGrid}>
        {overviewCards.map(([label, value, color]) => (
          <View key={label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={[styles.metricValue, { color }]}>{money(value)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderIncomeItem = ({ item }: { item: IncomeItem }) => (
    <TouchableOpacity style={[styles.card, styles.incomeBorder]} onPress={() => openIncomeEdit(item)}>
      <ArrowDownCircle size={24} color="#10b981" />
      <View style={styles.infoContainer}>
        <Text style={styles.desc}>{item.title}</Text>
        <Text style={styles.meta}>{dateText(item.date)} {item.time || ''} • {item.category}</Text>
      </View>
      <Text style={[styles.amount, { color: '#10b981' }]}>+{money(item.amount)}</Text>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteIncome(item.id)}><Trash2 size={18} color="#ef4444" /></TouchableOpacity>
    </TouchableOpacity>
  );

  const renderExpenseItem = ({ item }: { item: TransactionItem }) => (
    <TouchableOpacity style={[styles.card, styles.expenseBorder]} onPress={() => openExpenseEdit(item)}>
      <ArrowUpCircle size={24} color={item.category === 'Tiết kiệm' ? '#7c3aed' : item.category === 'Thanh toán hộ' ? '#f97316' : '#ef4444'} />
      <View style={styles.infoContainer}>
        <Text style={styles.desc}>{item.title}</Text>
        <Text style={styles.meta}>{dateText(item.date)} {item.time || ''} • {item.category}{item.reimbursementPerson ? ` • Chờ ${item.reimbursementPerson} hoàn` : ''}</Text>
      </View>
      <Text style={[styles.amount, { color: '#ef4444' }]}>-{money(item.amount)}</Text>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteExpense(item.id)}><Trash2 size={18} color="#ef4444" /></TouchableOpacity>
    </TouchableOpacity>
  );

  const renderSavingItem = ({ item }: { item: SavingItem }) => (
    <View style={[styles.card, styles.savingBorder]}>
      <PiggyBank size={24} color="#7c3aed" />
      <View style={styles.infoContainer}>
        <Text style={styles.desc}>{item.title}</Text>
        <Text style={styles.meta}>{dateText(item.date)} • {item.holder} • {item.source === 'expense_saving' ? 'Từ chi tiêu' : 'Thủ công'}</Text>
      </View>
      <Text style={[styles.amount, { color: '#7c3aed' }]}>{money(item.amount)}</Text>
    </View>
  );

  const renderInvestmentItem = ({ item }: { item: InvestmentItem }) => {
    const total = item.quantity * item.price + (item.action === 'buy' ? item.fee : -item.fee);
    return (
      <View style={[styles.card, styles.investBorder]}>
        <BriefcaseBusiness size={24} color="#f97316" />
        <View style={styles.infoContainer}>
          <Text style={styles.desc}>{item.stockCode || 'Đầu tư'}</Text>
          <Text style={styles.meta}>{dateText(item.tradeDate)} • {item.action === 'buy' ? 'Mua' : 'Bán'} • SL {item.quantity}</Text>
        </View>
        <Text style={[styles.amount, { color: item.action === 'buy' ? '#ef4444' : '#10b981' }]}>{item.action === 'buy' ? '-' : '+'}{money(total)}</Text>
      </View>
    );
  };

  const renderList = (data: any[], renderItem: any, empty: string, header?: React.ReactNode) => (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={header || null}
      ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>{empty}</Text></View>}
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4f46e5']} />}
    />
  );

  const renderSavingsHeader = () => (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>Tổng tiết kiệm hiện có</Text>
      <Text style={[styles.summaryValue, { color: '#7c3aed' }]}>{money(totalSavings)}</Text>
    </View>
  );

  const renderInvestmentHeader = () => (
    <View style={styles.summaryRow}>
      <View style={styles.summaryMini}><Text style={styles.summaryLabel}>Tổng mua</Text><Text style={[styles.summaryValue, { color: '#ef4444' }]}>{money(investmentBuy)}</Text></View>
      <View style={styles.summaryMini}><Text style={styles.summaryLabel}>Tổng bán</Text><Text style={[styles.summaryValue, { color: '#10b981' }]}>{money(investmentSell)}</Text></View>
    </View>
  );

  const renderCurrentTab = () => {
    if (loading && !refreshing) return <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />;
    if (error) return <View style={styles.errorContainer}><Text style={styles.errorText}>{error}</Text><TouchableOpacity style={styles.retryBtn} onPress={loadAll}><Text style={styles.retryText}>Thử lại</Text></TouchableOpacity></View>;
    if (activeTab === 'overview') return renderOverview();
    if (activeTab === 'income') return renderList(incomes, renderIncomeItem, 'Chưa có khoản thu nào.');
    if (activeTab === 'expense') return renderList(expenseList, renderExpenseItem, 'Chưa có khoản chi nào.');
    if (activeTab === 'savings') return renderList(savings, renderSavingItem, 'Chưa có khoản tiết kiệm nào.', renderSavingsHeader());
    return renderList(investments, renderInvestmentItem, 'Chưa có giao dịch đầu tư nào.', renderInvestmentHeader());
  };

  const modalTitle = modalKind === 'income' ? 'Thu nhập' : modalKind === 'expense' ? 'Chi tiêu' : modalKind === 'saving' ? 'Tiết kiệm' : 'Đầu tư';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabsCard}>
        {TABS.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={[styles.innerTab, active && styles.activeInnerTab]} onPress={() => setActiveTab(tab.key)} activeOpacity={0.8}>
              <Text style={[styles.innerTabText, active && styles.activeInnerTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.content}>{renderCurrentTab()}</View>

      {activeAddKind && (
        <TouchableOpacity style={styles.fab} onPress={() => openAdd(activeAddKind)} activeOpacity={0.85}>
          <Plus size={26} color="#ffffff" />
        </TouchableOpacity>
      )}

      <Modal visible={Boolean(modalKind)} animationType="slide" transparent onRequestClose={() => setModalKind(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? `Sửa ${modalTitle}` : `Thêm ${modalTitle}`}</Text>
              <TouchableOpacity onPress={() => setModalKind(null)}><X size={24} color="#64748b" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {modalKind === 'investment' ? (
                <>
                  <Text style={styles.inputLabel}>Ngày giao dịch</Text>
                  <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="yyyy-mm-dd" />
                  <Text style={styles.inputLabel}>Loại giao dịch</Text>
                  <View style={styles.segmentRow}>{INVEST_ACTIONS.map(item => <TouchableOpacity key={item.value} style={[styles.segment, investmentAction === item.value && styles.segmentActive]} onPress={() => setInvestmentAction(item.value as any)}><Text style={[styles.segmentText, investmentAction === item.value && styles.segmentTextActive]}>{item.label}</Text></TouchableOpacity>)}</View>
                  <Text style={styles.inputLabel}>Mã đầu tư</Text>
                  <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="VD: VND, BTC..." autoCapitalize="characters" />
                  <Text style={styles.inputLabel}>Số lượng</Text>
                  <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
                  <Text style={styles.inputLabel}>Giá</Text>
                  <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />
                  <Text style={styles.inputLabel}>Phí</Text>
                  <TextInput style={styles.input} value={fee} onChangeText={setFee} keyboardType="numeric" />
                </>
              ) : (
                <>
                  <Text style={styles.inputLabel}>Ngày</Text>
                  <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="yyyy-mm-dd" />
                  <Text style={styles.inputLabel}>Giờ</Text>
                  <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:mm" />
                  {modalKind === 'income' && (
                    <>
                      <Text style={styles.inputLabel}>Loại thu</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{INCOME_CATEGORIES.map(item => <TouchableOpacity key={item} style={[styles.chip, category === item && styles.chipActive]} onPress={() => setCategory(item)}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}</ScrollView>
                    </>
                  )}
                  {modalKind === 'expense' && (
                    <>
                      <Text style={styles.inputLabel}>Khoản chi</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{EXPENSE_CATEGORIES.map(item => <TouchableOpacity key={item} style={[styles.chip, category === item && styles.chipActive]} onPress={() => setCategory(item)}><Text style={[styles.chipText, category === item && styles.chipTextActive]}>{item}</Text></TouchableOpacity>)}</ScrollView>
                      <Text style={styles.inputLabel}>Loại chi tiết</Text>
                      <TextInput style={styles.input} value={subcategory} onChangeText={setSubcategory} placeholder="VD: Ăn sáng, Mẹ giữ..." />
                    </>
                  )}
                  {modalKind === 'saving' && (
                    <>
                      <Text style={styles.inputLabel}>Người giữ / Nơi giữ</Text>
                      <TextInput style={styles.input} value={subcategory} onChangeText={setSubcategory} placeholder="Ngân hàng, Mẹ giữ..." />
                    </>
                  )}
                  <Text style={styles.inputLabel}>Nội dung</Text>
                  <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Nhập nội dung" />
                  <Text style={styles.inputLabel}>{modalKind === 'expense' ? 'Thực trả' : 'Số tiền'}</Text>
                  <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
                  {modalKind === 'expense' && (
                    <>
                      <Text style={styles.inputLabel}>Giá gốc</Text>
                      <TextInput style={styles.input} value={grossAmount} onChangeText={setGrossAmount} keyboardType="numeric" placeholder="Nếu trống dùng thực trả" />
                    </>
                  )}
                  {(modalKind === 'income' || modalKind === 'expense') && (
                    <>
                      <Text style={styles.inputLabel}>{modalKind === 'income' ? 'Phương thức nhận' : 'Phương thức thanh toán'}</Text>
                      <TextInput style={styles.input} value={method} onChangeText={setMethod} placeholder="cash, bank, card..." />
                    </>
                  )}
                  {modalKind === 'expense' && (
                    <>
                      <Text style={styles.inputLabel}>Thẻ/Tài khoản thanh toán</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        <TouchableOpacity style={[styles.chip, !bankAccountId && styles.chipActive]} onPress={() => setBankAccountId('')}><Text style={[styles.chipText, !bankAccountId && styles.chipTextActive]}>Không chọn</Text></TouchableOpacity>
                        {bankAccounts.map(account => <TouchableOpacity key={account.id} style={[styles.chip, bankAccountId === account.id && styles.chipActive]} onPress={() => setBankAccountId(account.id)}><Text style={[styles.chipText, bankAccountId === account.id && styles.chipTextActive]}>{bankLabel(account)}</Text></TouchableOpacity>)}
                      </ScrollView>
                      {category === 'Thanh toán hộ' && (
                        <>
                          <Text style={styles.inputLabel}>Người cần hoàn lại</Text>
                          <TextInput style={styles.input} value={reimbursementPerson} onChangeText={setReimbursementPerson} placeholder="VD: Mẹ" />
                        </>
                      )}
                    </>
                  )}
                </>
              )}
              <Text style={styles.inputLabel}>Ghi chú</Text>
              <TextInput style={[styles.input, styles.multiInput]} value={note} onChangeText={setNote} multiline placeholder="Ghi chú thêm" />
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setModalKind(null)}><Text style={styles.modalCancelText}>Hủy</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalSaveButton, saving && { opacity: 0.7 }]} onPress={saveForm} disabled={saving}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveText}>Lưu</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 34 : 8 },
  tabsCard: { flexDirection: 'row', marginHorizontal: 10, marginTop: 10, marginBottom: 12, padding: 4, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' },
  innerTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14 },
  activeInnerTab: { backgroundColor: '#4f46e5' },
  innerTabText: { fontSize: 12, fontWeight: '500', color: '#64748b' },
  activeInnerTabText: { color: '#ffffff', fontWeight: '600' },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 130 },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: '48%', minHeight: 116, backgroundColor: '#ffffff', borderRadius: 22, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'space-between' },
  metricLabel: { fontSize: 13, lineHeight: 18, color: '#64748b', fontWeight: '500' },
  metricValue: { fontSize: 18, fontWeight: '700' },
  listContent: { padding: 16, paddingBottom: 130 },
  card: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 20, padding: 14, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 4, shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1, gap: 10 },
  incomeBorder: { borderLeftColor: '#10b981' },
  expenseBorder: { borderLeftColor: '#ef4444' },
  savingBorder: { borderLeftColor: '#7c3aed' },
  investBorder: { borderLeftColor: '#f97316' },
  infoContainer: { flex: 1 },
  desc: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
  meta: { fontSize: 12, color: '#64748b', lineHeight: 17 },
  amount: { fontSize: 14, fontWeight: '700', maxWidth: 105, textAlign: 'right' },
  deleteBtn: { padding: 6 },
  emptyContainer: { alignItems: 'center', paddingTop: 70 },
  emptyText: { color: '#94a3b8', fontSize: 15 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#ef4444', marginBottom: 12, textAlign: 'center' },
  retryBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '600' },
  summaryCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  summaryMini: { flex: 1, backgroundColor: '#ffffff', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  summaryLabel: { fontSize: 13, color: '#64748b', marginBottom: 6 },
  summaryValue: { fontSize: 18, fontWeight: '700' },
  fab: { position: 'absolute', right: 22, bottom: Platform.OS === 'web' ? 96 : 118, backgroundColor: '#4f46e5', width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10, zIndex: 50 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 20, fontWeight: '600', color: '#0f172a' },
  modalBody: { marginBottom: 18 },
  inputLabel: { fontSize: 14, fontWeight: '500', color: '#475569', marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 14, fontSize: 16, marginBottom: 16, color: '#0f172a' },
  multiInput: { minHeight: 90, textAlignVertical: 'top' },
  chipRow: { gap: 8, paddingBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
  chipText: { color: '#475569', fontWeight: '500', fontSize: 13 },
  chipTextActive: { color: '#4f46e5', fontWeight: '600' },
  segmentRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  segment: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  segmentActive: { backgroundColor: '#eef2ff', borderColor: '#4f46e5' },
  segmentText: { color: '#64748b', fontWeight: '500' },
  segmentTextActive: { color: '#4f46e5', fontWeight: '600' },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  modalCancelButton: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: '#f1f5f9', marginRight: 10 },
  modalCancelText: { color: '#475569', fontWeight: '600', fontSize: 16 },
  modalSaveButton: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 14, backgroundColor: '#4f46e5', marginLeft: 10 },
  modalSaveText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
