import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter, Trash2, Loader2, AlertCircle, Calendar, Edit2, Check } from 'lucide-react';
import { TransactionType, Category, BankAccount } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';

interface TransactionsPageProps {
  type: TransactionType;
}

const PAYMENT_METHODS = [
  'Cartão de Crédito',
  'Cartão de Débito',
  'PIX',
  'Boleto',
  'Dinheiro',
  'Transferência Bancária',
  'Cheque',
];

const PAYMENT_FEE_DEFAULTS: Record<string, string> = {
  'Cartão de Crédito': '2.99',
  'Cartão de Débito': '1.50',
  PIX: '0.50',
  Boleto: '0',
  Dinheiro: '0',
  'Transferência Bancária': '0',
  Cheque: '0',
};

const addDays = (dateString: string, days: number) => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

const addMonthsInterval = (dateString: string, months: number) => {
  const date = new Date(dateString);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().split('T')[0];
};

const addBusinessDays = (dateString: string, days: number) => {
  let date = new Date(dateString);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date.toISOString().split('T')[0];
};

const TransactionsPage: React.FC<TransactionsPageProps> = ({ type }) => {
  const isIncome = type === TransactionType.INCOME;
  const table = isIncome ? 'revenues' : 'expenses';

  // --- States ---
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cardFees, setCardFees] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [selectedProcedures, setSelectedProcedures] = useState<{ id: string; quantidade: number }[]>([]);
  const [procedureToAdd, setProcedureToAdd] = useState('');
  const [procedureQtyToAdd, setProcedureQtyToAdd] = useState('1');
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [formProfessionals, setFormProfessionals] = useState({ venda: '', execucao: '' });
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [allRevenues, setAllRevenues] = useState<any[]>([]);
  const [expenseFilters, setExpenseFilters] = useState({
    tipoDespesa: '',
    pessoaTipo: '',
    status: '',
  });
  const [sortKey, setSortKey] = useState<string>('data_competencia');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    description: '',
    gross_amount: '', // Valor Bruto
    discount: '', // Desconto absoluto
    tax_rate: PAYMENT_FEE_DEFAULTS.PIX, // Taxa em %
    tax_amount: '0', // Valor da taxa calculado
    liquid_amount: '', // Valor Líquido (calculado)
    date: new Date().toISOString().split('T')[0], // Data da compra/competência
    due_date: new Date().toISOString().split('T')[0], // Data de vencimento/recebimento
    category_id: '',
    bank_account_id: '',
    entity_name: '', // Paciente ou Fornecedor
    payment_method: 'PIX',
    observations: '',
    installments: '1',
    nsu: '',
    boleto_due_date: '',
    cheque_number: '',
    cheque_bank: '',
    cheque_due_date: '',
    cheque_pages: '1',
    cheque_value: '',
    is_recurring: false,
    recurrence_interval: 'mensal',
    recurrence_count: '1',
    card_brand: '',
    tipo_despesa: '',
    status: 'pending',
    pessoa_tipo: '',
    is_installment: false,
  });

  // --- Data Fetching ---
  const fetchData = async () => {
    // Limpa dados antigos ao alternar tipo
    setTransactions([]);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch Aux Data
      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('tipo', isIncome ? 'receita' : 'despesa');

      const { data: accs } = await supabase
        .from('bank_accounts')
        .select('*');

      const { data: fees } = await supabase.from('card_fees').select('*');
      const { data: custs } = await supabase.from('customers').select('*');
      const { data: procs } = await supabase.from('procedures').select('*');
      const { data: profs } = await supabase.from('professionals').select('*');
      const { data: sups } = await supabase.from('suppliers').select('*');
      const { data: allRev } = await supabase.from('revenues').select('id, data_competencia, paciente');

      if (cats) setCategories(cats as any);
      if (accs) setAccounts(accs as any);
      if (fees) setCardFees(fees as any);
      if (custs) setCustomers(custs as any);
      if (procs) setProcedures(procs as any);
      if (profs) setProfessionals(profs as any);
      if (sups) setSuppliers(sups as any);
      if (allRev) setAllRevenues(allRev as any);

      // Fetch Transactions with Filters
      let query: any;
      if (isIncome) {
        query = supabase
          .from(table)
          .select(`
            *,
            categories (name, cor_opcional),
            bank_accounts (nome_conta),
            revenue_procedures (procedimento, categoria, quantidade, valor_cobrado, procedure_id)
          `)
          .order('data_competencia', { ascending: false });
      } else {
        query = supabase
          .from(table)
          .select(`
            *,
            categories (name, cor_opcional),
            bank_accounts (nome_conta)
          `)
          .order('data_competencia', { ascending: false });
      }

      if (dateStart) query = query.gte('data_competencia', dateStart);
      if (dateEnd) query = query.lte('data_competencia', dateEnd);

      const { data: trans, error } = await query;

      if (error) throw error;
      setTransactions(trans || []);

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [type, dateStart, dateEnd]); // Refetch when filters change

  // --- Handlers ---

  // Auto-calculate liquid amount
  useEffect(() => {
    const parseNumber = (val: string) => {
      const normalized = (val || '').replace(',', '.');
      const num = parseFloat(normalized);
      return isNaN(num) ? 0 : num;
    };

    const gross = parseNumber(formData.gross_amount);
    const discount = parseNumber(formData.discount);
    const base = Math.max(0, gross - discount);
    const rate = parseNumber(formData.tax_rate);

    if (!formData.gross_amount && !selectedProcedures.length) {
      setFormData(prev => ({ ...prev, tax_amount: '0', liquid_amount: '' }));
      return;
    }

    const taxVal = base * (rate / 100);
    const liquid = base - taxVal;

    setFormData(prev => ({
      ...prev,
      tax_amount: taxVal.toFixed(2),
      liquid_amount: liquid.toFixed(2)
    }));
  }, [formData.gross_amount, formData.tax_rate]);

  // Ajustar taxa padrão conforme forma de pagamento
  useEffect(() => {
    // Se for cartão e tiver bandeira/parcelas, busque taxa em card_fees
    if (formData.payment_method === 'Cartão de Crédito' || formData.payment_method === 'Cartão de Débito') {
      const installments = parseInt(formData.installments || '1', 10) || 1;
      const match = cardFees.find((f: any) =>
        (!formData.card_brand || f.bandeira === formData.card_brand) &&
        installments >= (f.min_installments || 1) &&
        installments <= (f.max_installments || 1)
      );
      if (match) {
        setFormData(prev => ({ ...prev, tax_rate: String(match.taxa_percent || '0'), card_brand: match.bandeira }));
        return;
      }
    }
    const defaultRate = PAYMENT_FEE_DEFAULTS[formData.payment_method] ?? formData.tax_rate;
    setFormData(prev => ({ ...prev, tax_rate: defaultRate }));
  }, [formData.payment_method, formData.installments, formData.card_brand, cardFees]);

  // Recalcula valor bruto a partir dos procedimentos selecionados (apenas receitas)
  useEffect(() => {
    if (!isIncome) return;
    if (!selectedProcedures.length) return;
    const total = selectedProcedures.reduce((sum, sel) => {
      const proc = procedures.find(p => p.id === sel.id);
      const valor = proc?.valor_cobrado ? Number(proc.valor_cobrado) : 0;
      return sum + valor * (sel.quantidade || 1);
    }, 0);
    setFormData(prev => ({ ...prev, gross_amount: total.toFixed(2) }));
  }, [selectedProcedures, procedures, isIncome]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Ajuste de vencimento automático para despesas em crédito (D+30)
  useEffect(() => {
    if (!isIncome) {
      if (formData.payment_method === 'Cartão de Crédito') {
        setFormData(prev => ({ ...prev, due_date: addDays(prev.date, 30) }));
      } else {
        setFormData(prev => ({ ...prev, due_date: prev.date }));
      }
    } else {
      setFormData(prev => ({ ...prev, due_date: prev.date }));
    }
  }, [formData.payment_method, formData.date, isIncome]);

  const getSettlementDate = () => {
    switch (formData.payment_method) {
      case 'Cartão de Crédito':
        return addDays(formData.date, 30);
      case 'Cartão de Débito':
        return addBusinessDays(formData.date, 1);
      case 'PIX':
      case 'Dinheiro':
      case 'Transferência Bancária':
        return formData.date;
      case 'Boleto':
        return formData.boleto_due_date || formData.date;
      case 'Cheque':
        return formData.cheque_due_date || formData.date;
      default:
        return formData.date;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const parseNumber = (val: string) => {
        const normalized = (val || '').replace(',', '.');
        const num = parseFloat(normalized);
        return isNaN(num) ? 0 : num;
      };

      const grossAmount = parseNumber(formData.gross_amount);
      const discountValue = parseNumber(formData.discount);
      const taxValue = parseNumber(formData.tax_amount);
      const baseAfterDiscount = Math.max(0, grossAmount - discountValue);
      const liquidAmount = formData.liquid_amount ? parseNumber(formData.liquid_amount) : baseAfterDiscount;

      const settlementDate = getSettlementDate();

      const extraObservations: string[] = [];
      if (isIncome) {
        extraObservations.push(`Taxa aplicada: ${formData.tax_rate}% (R$ ${taxValue.toFixed(2)})`);
        extraObservations.push(`Liquidação prevista: ${settlementDate}`);
      }
      if (formData.payment_method.includes('Cartão') && formData.nsu) {
        extraObservations.push(`NSU: ${formData.nsu}`);
      }
      if (formData.payment_method === 'Cartão de Crédito' && formData.installments) {
        extraObservations.push(`Parcelas: ${formData.installments}`);
      }
      if (formData.payment_method === 'Boleto') {
        if (formData.installments) extraObservations.push(`Parcelas boleto: ${formData.installments}`);
        if (formData.boleto_due_date) extraObservations.push(`Vencimento boleto: ${formData.boleto_due_date}`);
      }
      if (formData.payment_method === 'Cheque') {
        if (formData.cheque_number) extraObservations.push(`Cheque nº ${formData.cheque_number}`);
        if (formData.cheque_bank) extraObservations.push(`Banco cheque: ${formData.cheque_bank}`);
        if (formData.cheque_due_date) extraObservations.push(`Vencimento cheque: ${formData.cheque_due_date}`);
        if (formData.cheque_pages) extraObservations.push(`Folhas: ${formData.cheque_pages}`);
        if (formData.cheque_value) extraObservations.push(`Valor/f.: R$ ${formData.cheque_value}`);
      }
      if (formData.observations) extraObservations.push(formData.observations);

      // Base payload
      const descriptionValue = isIncome
        ? (formData.entity_name || (selectedProcedures[0] ? procedures.find(p => p.id === selectedProcedures[0].id)?.procedimento : '') || 'Receita')
        : (formData.description || 'Despesa');

      const payload: any = {
        description: descriptionValue,
        data_competencia: formData.date,
        category_id: isIncome ? null : formData.category_id,
        bank_account_id: formData.bank_account_id,
        observacoes: ['Inserido via Web', ...extraObservations].filter(Boolean).join(' | '),
      };

      if (isIncome) {
        payload.valor_bruto = grossAmount;
        payload.valor_liquido = liquidAmount;
        payload.valor = liquidAmount;
        payload.data_recebimento = settlementDate;
        payload.paciente = formData.entity_name;
        payload.forma_pagamento = formData.payment_method;
        payload.parcelas = parseInt(formData.installments || '1', 10) || 1;
        payload.forma_pagamento_taxa = formData.tax_rate;
        payload.bandeira = formData.card_brand || null;
        if (discountValue > 0) {
          extraObservations.push(`Desconto aplicado: R$ ${discountValue.toFixed(2)}`);
        }
        payload.sale_professional_id = formProfessionals.venda || null;
        payload.exec_professional_id = formProfessionals.execucao || null;
      } else {
        payload.valor = grossAmount; // Para despesa usamos o valor direto
        payload.data_pagamento = formData.due_date || formData.date;
        payload.fornecedor = formData.entity_name;
        payload.supplier_id = supplierId || null;
        payload.tipo_despesa = formData.tipo_despesa || 'variavel';
        payload.parcelas = formData.is_installment ? formData.installments : '1';
        payload.forma_pagamento = formData.payment_method;
        payload.pessoa_tipo = (formData as any).pessoa_tipo || null;
        payload.status = formData.status || 'pending';
      }

      // 1. Insert or Update Transaction
      let revenueId: string | null = null;
      if (editingId) {
        const { error } = await supabase.from(table).update(payload).eq('id', editingId);
        if (error) throw error;
        revenueId = editingId;
      } else {
        if (!isIncome && formData.is_recurring) {
          const reps = Math.max(1, parseInt(formData.recurrence_count || '1', 10));
          const interval = formData.recurrence_interval;
          const makeDueDate = (base: string, idx: number) => {
            if (idx === 0) return base;
            if (interval === 'quinzenal') return addDays(base, 15 * idx);
            if (interval === 'mensal') return addMonthsInterval(base, idx);
            if (interval === 'trimestral') return addMonthsInterval(base, 3 * idx);
            if (interval === 'anual') return addMonthsInterval(base, 12 * idx);
            return base;
          };
          const payloads = Array.from({ length: reps }).map((_, idx) => ({
            ...payload,
            data_pagamento: makeDueDate(formData.due_date || formData.date, idx),
            data_competencia: makeDueDate(formData.date, idx),
          }));
          const { error } = await supabase.from(table).insert(payloads);
          if (error) throw error;
        } else {
          // Despesa parcelada: cria N parcelas com datas sequenciais a partir do vencimento
          if (!isIncome && formData.is_installment && (parseInt(formData.installments || '1', 10) > 1)) {
            const n = Math.max(1, parseInt(formData.installments || '1', 10));
            const baseDate = formData.due_date || formData.date;
            const baseValue = grossAmount;
            const baseParcela = Math.floor((baseValue * 100) / n); // em centavos
            const parcelas = Array.from({ length: n }).map((_, idx) => {
              const date = idx === 0 ? baseDate : addMonthsInterval(baseDate, idx);
              const cents = idx === n - 1 ? Math.round(baseValue * 100 - baseParcela * (n - 1)) : baseParcela;
              return {
                ...payload,
                valor: cents / 100,
                data_pagamento: date,
                data_competencia: date,
                parcelas: 1,
              };
            });
            const { error } = await supabase.from(table).insert(parcelas);
            if (error) throw error;
          } else {
            const { data, error } = await supabase.from(table).insert([payload]).select('id').maybeSingle();
            if (error) throw error;
            revenueId = data?.id || null;
          }
        }
      }

      // 1.1 Relacionar procedimentos (somente receitas)
      if (isIncome && (editingId || revenueId) && selectedProcedures.length) {
        const revId = editingId || revenueId;
        await supabase.from('revenue_procedures').delete().eq('revenue_id', revId);
        const rows = selectedProcedures.map(sel => {
          const proc = procedures.find((p: any) => p.id === sel.id);
          return {
            revenue_id: revId,
            procedure_id: sel.id,
            categoria: proc?.categoria || null,
            procedimento: proc?.procedimento || null,
            valor_cobrado: proc?.valor_cobrado || null,
            quantidade: sel.quantidade || 1,
          };
        });
        if (rows.length) {
          const { error } = await supabase.from('revenue_procedures').insert(rows);
          if (error) throw error;
        }
      } else if (isIncome && editingId && !selectedProcedures.length) {
        await supabase.from('revenue_procedures').delete().eq('revenue_id', editingId);
      }

      // 2. Update Bank Balance (revert previous if editing)
      const applyBalance = async (accountId: string | null, delta: number) => {
        if (!accountId) return;
        const account = accounts.find(a => a.id === accountId);
        if (!account) return;
        const currentBalance = Number((account as any).current_balance || 0);
        const newBalance = currentBalance + delta;
        await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', accountId);
      };

      if (editingId && editingItem) {
        const prevAccountId = editingItem.bank_account_id;
        const prevAmount = isIncome ? editingItem.valor_liquido : editingItem.valor;
        const prevDelta = isIncome ? -prevAmount : prevAmount;
        await applyBalance(prevAccountId, prevDelta);

        const newAmount = isIncome ? liquidAmount : grossAmount;
        const newDelta = isIncome ? newAmount : -newAmount;
        await applyBalance(formData.bank_account_id, newDelta);
      } else {
        const amountToUpdate = isIncome ? liquidAmount : grossAmount;
        let delta = isIncome ? amountToUpdate : -amountToUpdate;
        if (!isIncome && formData.is_recurring) {
          const reps = Math.max(1, parseInt(formData.recurrence_count || '1', 10));
          delta = delta * reps;
        }
        await applyBalance(formData.bank_account_id, delta);
      }

      setIsModalOpen(false);
      setEditingId(null);
      setEditingItem(null);
      resetForm();
      fetchData();

    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, amount: number, accountId: string) => {
    if (!confirm('Tem certeza que deseja excluir? O saldo será revertido.')) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;

      const account = accounts.find(a => a.id === accountId);
      if (account) {
        const currentBalance = Number((account as any).current_balance || 0);
        const newBalance = isIncome
          ? currentBalance - amount
          : currentBalance + amount;

        await supabase
          .from('bank_accounts')
          .update({ current_balance: newBalance })
          .eq('id', accountId);
      }
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setEditingItem(item);
    const gross = isIncome ? (item.valor_bruto || item.valor || item.valor_liquido || 0) : (item.valor || 0);
    const liquid = isIncome ? (item.valor_liquido || gross) : gross;
    const taxRate = isIncome && gross ? (((gross - liquid) / gross) * 100).toFixed(2) : '0';
    setFormData({
      description: item.description || '',
      gross_amount: String(gross),
      discount: '',
      tax_rate: String(taxRate),
      tax_amount: isIncome && gross ? (gross - liquid).toFixed(2) : '0',
      liquid_amount: isIncome ? String(liquid) : '',
      date: item.data_competencia || new Date().toISOString().split('T')[0],
      due_date: item.data_pagamento || item.data_recebimento || item.data_competencia || new Date().toISOString().split('T')[0],
      category_id: item.category_id || '',
      bank_account_id: item.bank_account_id || '',
      entity_name: isIncome ? item.paciente || '' : item.fornecedor || '',
      payment_method: isIncome ? item.forma_pagamento || 'PIX' : 'PIX',
      observations: item.observacoes || '',
      installments: item.parcelas ? String(item.parcelas) : '1',
      nsu: item.nsu || '',
      boleto_due_date: item.boleto_vencimento || '',
      cheque_number: item.cheque_number || '',
      cheque_bank: item.cheque_bank || '',
      cheque_due_date: item.cheque_due_date || '',
      cheque_pages: item.cheque_pages ? String(item.cheque_pages) : '1',
      cheque_value: item.cheque_value ? String(item.cheque_value) : '',
      is_recurring: false,
      recurrence_interval: 'mensal',
      recurrence_count: '1',
      card_brand: item.bandeira || '',
      tipo_despesa: item.tipo_despesa || '',
      status: item.status || 'pending',
      pessoa_tipo: item.pessoa_tipo || '',
      is_installment: !isIncome ? (item.parcelas || 1) > 1 : false,
    });
    setSelectedProcedures([]); // poderia buscar vínculo se necessário
    setFormProfessionals({ venda: '', execucao: '' });
    setSupplierId(item.supplier_id || '');
    setIsModalOpen(true);
  };

  // Filter local logic for search text
  const filteredData = transactions.filter(item => {
    const matchesText =
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.paciente || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.fornecedor || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesText) return false;

    if (!isIncome) {
      if (expenseFilters.tipoDespesa && (item.tipo_despesa || '') !== expenseFilters.tipoDespesa) return false;
      if (expenseFilters.pessoaTipo && (item.pessoa_tipo || '') !== expenseFilters.pessoaTipo) return false;
      if (expenseFilters.status && (item.status || '') !== expenseFilters.status) return false;
    }
    return true;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const getVal = (item: any) => {
      switch (sortKey) {
        case 'description':
          return (item.description || '').toLowerCase();
        case 'paciente':
          return (item.paciente || item.fornecedor || '').toLowerCase();
        case 'data_competencia':
          return item.data_competencia || '';
        case 'categoria':
          return item.categories?.name || item.revenue_procedures?.[0]?.categoria || '';
        case 'valor':
          return Number(isIncome ? item.valor_liquido : item.valor);
        default:
          return '';
      }
    };
    const va = getVal(a);
    const vb = getVal(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [sortKey, sortDir, searchTerm, expenseFilters, dateStart, dateEnd, type]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pageData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleAddProcedure = () => {
    if (!procedureToAdd) return;
    const qty = Math.max(1, parseInt(procedureQtyToAdd || '1', 10));
    setSelectedProcedures(prev => {
      const exists = prev.find(p => p.id === procedureToAdd);
      if (exists) {
        return prev.map(p => p.id === procedureToAdd ? { ...p, quantidade: p.quantidade + qty } : p);
      }
      return [...prev, { id: procedureToAdd, quantidade: qty }];
    });
    setProcedureToAdd('');
    setProcedureQtyToAdd('1');
  };

  const totalProcedures = selectedProcedures.reduce((sum, sel) => {
    const proc = procedures.find(p => p.id === sel.id);
    const valor = proc?.valor_cobrado ? Number(proc.valor_cobrado) : 0;
    return sum + valor * (sel.quantidade || 1);
  }, 0);

  const settlementPreview = getSettlementDate();

  // Métricas de cartões
  const metrics = useMemo(() => {
    if (!isIncome) return null;
    const parseNum = (v: any) => Number(v || 0);
    const data = filteredData;
    const totalReceita = data.reduce((s, r) => s + parseNum(r.valor_liquido), 0);
    const totalCredito = data.filter(r => (r.forma_pagamento || '').toLowerCase().includes('crédito') || (r.forma_pagamento || '').toLowerCase().includes('credito'))
      .reduce((s, r) => s + parseNum(r.valor_liquido), 0);
    const totalDebito = data.filter(r => (r.forma_pagamento || '').toLowerCase().includes('débito') || (r.forma_pagamento || '').toLowerCase().includes('debito'))
      .reduce((s, r) => s + parseNum(r.valor_liquido), 0);
    const totalPix = data.filter(r => (r.forma_pagamento || '').toLowerCase().includes('pix'))
      .reduce((s, r) => s + parseNum(r.valor_liquido), 0);
    const totalDinheiro = data.filter(r => (r.forma_pagamento || '').toLowerCase().includes('dinheiro'))
      .reduce((s, r) => s + parseNum(r.valor_liquido), 0);

    const pacientes = Array.from(new Set(data.map(r => (r.paciente || '').trim()).filter(Boolean)));
    const ticketMedio = pacientes.length ? totalReceita / pacientes.length : 0;

    const procedimentosRealizados = data.reduce((s, r) => {
      const list = (r.revenue_procedures || []) as any[];
      if (!list.length) return s;
      return s + list.reduce((acc, p) => acc + (p.quantidade || 0), 0);
    }, 0);

    const clientesAtendidos = pacientes.length;

    const baseDate = dateStart || new Date().toISOString().split('T')[0];
    const baseYear = new Date(baseDate).getFullYear();
    const prevYear = baseYear - 1;
    const returningClients = pacientes.filter(pac => {
      return allRevenues.some((rev: any) => {
        if (!rev.paciente) return false;
        const y = rev.data_competencia ? new Date(rev.data_competencia).getFullYear() : 0;
        return y <= prevYear && rev.paciente === pac;
      });
    });
    const recorrentes = returningClients.length;
    const recorrenciaPercent = clientesAtendidos ? (recorrentes / clientesAtendidos) * 100 : 0;
    const novosClientes = Math.max(0, clientesAtendidos - recorrentes);

    return {
      totalReceita,
      totalCredito,
      totalDebito,
      totalPix,
      ticketMedio,
      procedimentosRealizados,
      clientesAtendidos,
      recorrenciaPercent,
      novosClientes,
      totalDinheiro,
    };
  }, [filteredData, isIncome, allRevenues, dateStart]);

  const expenseMetrics = useMemo(() => {
    if (isIncome) return null;
    const data = filteredData;
    const total = data.reduce((s, e) => s + Number(e.valor || 0), 0);
    const quantidade = data.length;
    const totalFixo = data.filter(e => e.tipo_despesa === 'fixo').reduce((s, e) => s + Number(e.valor || 0), 0);
    const totalVar = data.filter(e => e.tipo_despesa === 'variavel').reduce((s, e) => s + Number(e.valor || 0), 0);
    const pctFixo = total ? (totalFixo / total) * 100 : 0;
    const pctVar = total ? (totalVar / total) * 100 : 0;
    return { total, quantidade, totalFixo, totalVar, pctFixo, pctVar };
  }, [filteredData, isIncome]);

  const resetForm = () => {
    setFormData({
      description: '',
      gross_amount: '',
      discount: '',
      tax_rate: PAYMENT_FEE_DEFAULTS.PIX,
      tax_amount: '0',
      liquid_amount: '',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0],
      category_id: '',
      bank_account_id: '',
      entity_name: '',
      payment_method: 'PIX',
      observations: '',
      installments: '1',
      nsu: '',
      boleto_due_date: '',
      cheque_number: '',
      cheque_bank: '',
      cheque_due_date: '',
      cheque_pages: '1',
      cheque_value: '',
      is_recurring: false,
      recurrence_interval: 'mensal',
      recurrence_count: '1',
      card_brand: '',
      tipo_despesa: '',
      status: 'pending',
      pessoa_tipo: '',
      is_installment: false,
    });
    setSelectedProcedures([]);
    setFormProfessionals({ venda: '', execucao: '' });
    setSupplierId('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {isIncome ? 'Receitas' : 'Despesas'}
          </h1>
          <p className="text-gray-500">
            Gerencie {isIncome ? 'os recebimentos' : 'os pagamentos'} da clínica
          </p>
        </div>
        <button
          onClick={() => { setEditingId(null); setEditingItem(null); resetForm(); setIsModalOpen(true); }}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors shadow-sm
            ${isIncome ? 'bg-brand-600 hover:bg-brand-700' : 'bg-red-600 hover:bg-red-700'}
          `}
        >
          <Plus size={20} />
          Nova {isIncome ? 'Receita' : 'Despesa'}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={isIncome ? "Buscar por descrição ou paciente..." : "Buscar por descrição ou fornecedor..."}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"><Calendar size={16} /></span>
            <input
              type="date"
              value={dateStart}
              onChange={e => setDateStart(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-gray-600"
            />
          </div>
          <span className="text-gray-400">até</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"><Calendar size={16} /></span>
            <input
              type="date"
              value={dateEnd}
              onChange={e => setDateEnd(e.target.value)}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm text-gray-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isIncome && (
            <>
              <select
                value={expenseFilters.tipoDespesa}
                onChange={e => setExpenseFilters(prev => ({ ...prev, tipoDespesa: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="">Tipo (fixo/variável)</option>
                <option value="fixo">Fixo</option>
                <option value="variavel">Variável</option>
              </select>
              <select
                value={expenseFilters.pessoaTipo}
                onChange={e => setExpenseFilters(prev => ({ ...prev, pessoaTipo: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="">Pessoa (F/J)</option>
                <option value="fisica">Pessoa Física</option>
                <option value="juridica">Pessoa Jurídica</option>
              </select>
              <select
                value={expenseFilters.status}
                onChange={e => setExpenseFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="">Status</option>
                <option value="paid">Pago</option>
                <option value="pending">À pagar</option>
              </select>
            </>
          )}
          <button onClick={fetchData} className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            <Filter size={20} />
            Filtrar
          </button>
        </div>
      </div>

      {isIncome && metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total Receita</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(metrics.totalReceita)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total Crédito</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(metrics.totalCredito)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total Débito</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(metrics.totalDebito)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total Pix</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(metrics.totalPix)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total Dinheiro</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(metrics.totalDinheiro)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Ticket médio</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(metrics.ticketMedio)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Procedimentos realizados</p>
            <p className="text-xl font-bold text-gray-800">{metrics.procedimentosRealizados}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Clientes atendidos</p>
            <p className="text-xl font-bold text-gray-800">{metrics.clientesAtendidos}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Recorrência</p>
            <p className="text-xl font-bold text-gray-800">{metrics.recorrenciaPercent.toFixed(1)}% • Novos: {metrics.novosClientes}</p>
          </div>
        </div>
      )}

      {!isIncome && expenseMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total Despesas</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(expenseMetrics.total)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Quantidade de compras</p>
            <p className="text-xl font-bold text-gray-800">{expenseMetrics.quantidade}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total Fixo</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(expenseMetrics.totalFixo)} <span className="text-sm text-gray-500">({expenseMetrics.pctFixo.toFixed(1)}%)</span></p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
            <p className="text-xs uppercase text-gray-500">Total Variável</p>
            <p className="text-xl font-bold text-gray-800">{formatCurrency(expenseMetrics.totalVar)} <span className="text-sm text-gray-500">({expenseMetrics.pctVar.toFixed(1)}%)</span></p>
          </div>
        </div>
      )}

      {/* Paginação e page size */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Linhas por página:</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(parseInt(e.target.value, 10)); setCurrentPage(1); }}
            className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          >
            <option value={30}>30</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-xs text-gray-500">Total: {sortedData.length}</span>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
          >
            ‹
          </button>
          <span className="px-2">Página {currentPage} / {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-2 py-1 border border-gray-300 rounded disabled:opacity-50"
          >
            ›
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Loader2 size={32} className="animate-spin mb-2" />
            <p>Carregando dados...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-4 cursor-pointer" onClick={() => { setSortKey('description'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                    Descrição {sortKey === 'description' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer" onClick={() => { setSortKey('paciente'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                    {isIncome ? 'Paciente' : 'Fornecedor'} {sortKey === 'paciente' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer" onClick={() => { setSortKey('data_competencia'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                    Data {sortKey === 'data_competencia' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-4 cursor-pointer" onClick={() => { setSortKey('categoria'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                    Categoria {sortKey === 'categoria' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  {isIncome && <th className="px-6 py-4">Forma Pag.</th>}
                  {!isIncome && <th className="px-6 py-4">Status</th>}
                  <th className="px-6 py-4 text-right cursor-pointer" onClick={() => { setSortKey('valor'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                    Valor {sortKey === 'valor' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
                <tbody className="divide-y divide-gray-100">
                {pageData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">{item.description}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {isIncome ? item.paciente || '-' : item.fornecedor || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(item.data_competencia)}</td>
                    <td className="px-6 py-4">
                      <span
                        className="px-2 py-1 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: (item.categories?.cor_opcional || '#e5e7eb') + '20',
                          color: item.categories?.cor_opcional || '#374151'
                        }}
                      >
                        {item.categories?.name || (item.revenue_procedures?.[0]?.categoria) || 'Geral'}
                      </span>
                    </td>
                  {isIncome && <td className="px-6 py-4 text-gray-600 text-xs">{item.forma_pagamento}</td>}
                  {!isIncome && (
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${item.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {item.status === 'paid' ? 'Pago' : 'À pagar'}
                      </span>
                    </td>
                  )}
                  <td className={`px-6 py-4 font-medium text-right ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(isIncome ? item.valor_liquido : item.valor)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1 text-gray-400 hover:text-brand-600 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        {!isIncome && item.status !== 'paid' && (
                          <button
                            onClick={async () => {
                              if (!confirm('Marcar esta despesa como paga?')) return;
                              const { error } = await supabase.from(table).update({ status: 'paid' }).eq('id', item.id);
                              if (!error) fetchData();
                            }}
                            className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                            title="Pagar esta compra"
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(item.id, isIncome ? item.valor_liquido : item.valor, item.bank_account_id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={isIncome ? 7 : 6} className="px-6 py-12 text-center text-gray-400">
                      Nenhum lançamento encontrado no período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NEW: Modal with Full Fields */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-800">{editingId ? 'Editar' : 'Nova'} {isIncome ? 'Receita' : 'Despesa'}</h2>

            {((!isIncome && categories.length === 0) || accounts.length === 0) && (
              <div className="p-3 bg-yellow-50 text-yellow-700 rounded-lg flex items-start gap-2 text-sm">
                <AlertCircle size={16} className="mt-0.5" />
                <span>
                  Atenção: Cadastre {(!isIncome && categories.length === 0) ? <b>Categorias de despesas</b> : null}{(!isIncome && categories.length === 0) && accounts.length === 0 ? ' e ' : ''}{accounts.length === 0 ? <b>Contas Bancárias</b> : null} antes de lançar.
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isIncome ? (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
                    <input
                      required
                      name="entity_name"
                      value={formData.entity_name}
                      onChange={handleInputChange}
                      list="entity_suggestions_top"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                      placeholder="Digite o nome do paciente"
                    />
                    <datalist id="entity_suggestions_top">
                      {customers
                        .filter((c) => (formData.entity_name || '').length >= 3 ? c.name?.toLowerCase().includes(formData.entity_name.toLowerCase()) : true)
                        .slice(0, 10)
                        .map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                    </datalist>
                  </div>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <input
                      required
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                      placeholder="Descreva a despesa"
                    />
                  </div>
                )}

                {isIncome && (
                  <div className="col-span-2 p-4 border border-gray-100 rounded-lg bg-white">
                    <div className="flex flex-col md:flex-row md:items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Adicionar procedimento</label>
                        <select
                          value={procedureToAdd}
                          onChange={e => setProcedureToAdd(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                        >
                          <option value="">Selecione...</option>
                          {procedures.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.procedimento} ({formatCurrency(p.valor_cobrado || 0)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Qtd.</label>
                        <input
                          type="number"
                          min="1"
                          value={procedureQtyToAdd}
                          onChange={e => setProcedureQtyToAdd(e.target.value)}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddProcedure}
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center gap-2"
                      >
                        <Plus size={16}/> Adicionar
                      </button>
                    </div>
                    {selectedProcedures.length > 0 && (
                      <div className="mt-3 border border-gray-100 rounded-lg overflow-hidden">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="px-3 py-2 text-left">Procedimento</th>
                              <th className="px-3 py-2 text-left">Categoria</th>
                              <th className="px-3 py-2 text-left">Qtd.</th>
                              <th className="px-3 py-2 text-left">Valor</th>
                              <th className="px-3 py-2 text-left">Subtotal</th>
                              <th className="px-3 py-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedProcedures.map(sel => {
                              const proc = procedures.find((p: any) => p.id === sel.id);
                              const valor = proc?.valor_cobrado ? Number(proc.valor_cobrado) : 0;
                              return (
                                <tr key={sel.id}>
                                  <td className="px-3 py-2 text-gray-800">{proc?.procedimento || '-'}</td>
                                  <td className="px-3 py-2 text-gray-600">{proc?.categoria || '-'}</td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min="1"
                                      value={sel.quantidade}
                                      onChange={e => {
                                        const q = Math.max(1, parseInt(e.target.value || '1', 10));
                                        setSelectedProcedures(prev => prev.map(p => p.id === sel.id ? { ...p, quantidade: q } : p));
                                      }}
                                      className="w-20 px-2 py-1 border border-gray-300 rounded"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-gray-700">{formatCurrency(valor)}</td>
                                  <td className="px-3 py-2 text-gray-800 font-semibold">{formatCurrency(valor * (sel.quantidade || 1))}</td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedProcedures(prev => prev.filter(p => p.id !== sel.id))}
                                      className="text-red-600 text-sm"
                                    >
                                      Remover
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="px-3 py-2 text-right text-sm font-semibold text-gray-800 bg-gray-50">
                          Subtotal procedimentos: {formatCurrency(totalProcedures)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bloco de Valores */}
                <div className="col-span-2 p-4 bg-gray-50 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-4 border border-gray-100">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Bruto</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold">R$</span>
                      <input
                        required
                        name="gross_amount"
                        type="number"
                        step="0.01"
                        value={formData.gross_amount}
                        onChange={handleInputChange}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Desconto</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold">R$</span>
                      <input
                        name="discount"
                        type="number"
                        step="0.01"
                        value={formData.discount}
                        onChange={handleInputChange}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  {isIncome && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Taxa (%)</label>
                        <input
                          name="tax_rate"
                          type="number"
                          step="0.01"
                          value={formData.tax_rate}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          placeholder="0"
                        />
                        <div className="text-xs text-red-500 mt-1 font-medium">
                          - R$ {formData.tax_amount}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor Líquido</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 font-bold">R$</span>
                          <input
                            readOnly
                            value={formData.liquid_amount}
                            className="w-full pl-8 pr-3 py-2 border border-green-200 bg-green-50 text-green-700 font-bold rounded-lg outline-none"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isIncome ? 'Data Competência' : 'Data da Compra'}</label>
                  <input
                    required
                    name="date"
                    type="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  />
                </div>

                {!isIncome && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento</label>
                    <input
                      required
                      name="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                    />
                  </div>
                )}

                {!isIncome && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select
                      required
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                    >
                      <option value="">Selecione...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conta Bancária</label>
                  <select
                    required
                    name="bank_account_id"
                    value={formData.bank_account_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                  >
                    <option value="">Selecione...</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {(acc as any).nome_conta || acc.name || 'Conta sem nome'} ({(acc as any).banco || acc.bank || 'Banco'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isIncome ? 'Forma de Pagamento' : 'Fornecedor'}</label>
                  {isIncome ? (
                    <select
                      name="payment_method"
                      value={formData.payment_method}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                    >
                      {PAYMENT_METHODS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={supplierId}
                      onChange={e => {
                        const supId = e.target.value;
                        setSupplierId(supId);
                        const sup = suppliers.find((s: any) => s.id === supId);
                        setFormData(prev => ({ ...prev, entity_name: sup?.nome || '' }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                    >
                      <option value="">Selecione fornecedor...</option>
                      {suppliers.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.nome}</option>
                      ))}
                    </select>
                  )}
                </div>

                {!isIncome && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de custo</label>
                      <select
                        name="tipo_despesa"
                        value={formData.tipo_despesa || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        <option value="fixo">Fixo</option>
                        <option value="variavel">Variável</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pessoa</label>
                      <select
                        name="pessoa_tipo"
                        value={(formData as any).pessoa_tipo || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        <option value="fisica">Pessoa Física</option>
                        <option value="juridica">Pessoa Jurídica</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                      >
                        <option value="paid">Pago</option>
                        <option value="pending">À pagar</option>
                      </select>
                    </div>
                  </>
                )}

                {isIncome && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Profissional de venda</label>
                      <select
                        value={formProfessionals.venda}
                        onChange={e => setFormProfessionals(prev => ({ ...prev, venda: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        {professionals.filter((p: any) => p.tipo === 'venda').map((p: any) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Profissional de execução</label>
                      <select
                        value={formProfessionals.execucao}
                        onChange={e => setFormProfessionals(prev => ({ ...prev, execucao: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                      >
                        <option value="">Selecione...</option>
                        {professionals.filter((p: any) => p.tipo === 'execucao').map((p: any) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {isIncome && (
                  <div className="col-span-2 space-y-3">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>
                        Liquidação prevista: <span className="font-semibold text-gray-800">{formatDate(settlementPreview)}</span>
                      </span>
                      <span className="text-gray-400">Ajustada conforme a forma de pagamento</span>
                    </div>

                    {formData.payment_method === 'Cartão de Crédito' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Bandeira</label>
                          <select
                            name="card_brand"
                            value={formData.card_brand}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                          >
                            <option value="">Selecione...</option>
                            {cardFees.map((fee) => (
                              <option key={fee.id} value={fee.bandeira}>{fee.bandeira}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                          <input
                            name="installments"
                            type="number"
                            min="1"
                            value={formData.installments}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                            placeholder="Ex: 10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">NSU</label>
                          <input
                            name="nsu"
                            value={formData.nsu}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                            placeholder="Código autorizador"
                          />
                        </div>
                        <div className="text-sm text-gray-600 flex items-center">Crédito: D+30 dias</div>
                      </div>
                    )}

                    {formData.payment_method === 'Cartão de Débito' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">NSU</label>
                          <input
                            name="nsu"
                            value={formData.nsu}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                            placeholder="Código autorizador"
                          />
                        </div>
                        <div className="text-sm text-gray-600 flex items-center">Débito: D+1 dia útil</div>
                      </div>
                    )}

                    {formData.payment_method === 'Boleto' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                          <input
                            name="installments"
                            type="number"
                            min="1"
                            value={formData.installments}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Primeiro Vencimento</label>
                          <input
                            name="boleto_due_date"
                            type="date"
                            value={formData.boleto_due_date}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div className="text-sm text-gray-600 flex items-center">Boleto: conforme vencimento</div>
                      </div>
                    )}

                    {formData.payment_method === 'Cheque' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Número do Cheque</label>
                          <input
                            name="cheque_number"
                            value={formData.cheque_number}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                          <input
                            name="cheque_bank"
                            value={formData.cheque_bank}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento</label>
                          <input
                            name="cheque_due_date"
                            type="date"
                            value={formData.cheque_due_date}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade de Folhas</label>
                          <input
                            name="cheque_pages"
                            type="number"
                            min="1"
                            value={formData.cheque_pages}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Valor por Folha</label>
                          <input
                            name="cheque_value"
                            type="number"
                            step="0.01"
                            value={formData.cheque_value}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div className="text-sm text-gray-600 flex items-center">Cheque: liquidação no vencimento</div>
                      </div>
                    )}
                  </div>
                )}

                {!isIncome && (
                  <div className="col-span-2 p-4 border border-gray-100 rounded-lg bg-gray-50 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          id="is_recurring"
                          name="is_recurring"
                          type="checkbox"
                          checked={formData.is_recurring}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-brand-600 border-gray-300 rounded"
                        />
                        Este custo é recorrente?
                      </label>
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <input
                          id="is_installment"
                          name="is_installment"
                          type="checkbox"
                          checked={formData.is_installment}
                          onChange={(e) => {
                            handleInputChange(e as any);
                            if (!e.currentTarget.checked) {
                              setFormData(prev => ({ ...prev, installments: '1' }));
                            }
                          }}
                          className="h-4 w-4 text-brand-600 border-gray-300 rounded"
                        />
                        Este custo é parcelado?
                      </label>
                    </div>
                    {formData.is_recurring && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo</label>
                          <select
                            name="recurrence_interval"
                            value={formData.recurrence_interval}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none bg-white"
                          >
                            <option value="quinzenal">Quinzenal</option>
                            <option value="mensal">Mensal</option>
                            <option value="trimestral">Trimestral</option>
                            <option value="anual">Anual</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Repetições</label>
                          <input
                            name="recurrence_count"
                            type="number"
                            min="1"
                            value={formData.recurrence_count}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                            placeholder="Ex: 10"
                          />
                        </div>
                        <div className="text-xs text-gray-500 flex items-center">
                          As repetições serão lançamentos individuais seguindo o intervalo e vencimento informado.
                        </div>
                      </div>
                    )}
                    {formData.is_installment && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas</label>
                          <input
                            name="installments"
                            type="number"
                            min="1"
                            value={formData.installments}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                          />
                        </div>
                        <div className="text-xs text-gray-500 flex items-center">
                          Valor será distribuído em parcelas a partir da primeira data de vencimento.
                        </div>
                      </div>
                    )}
                  </div>
                )}


                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    name="observations"
                    rows={2}
                    value={formData.observations}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-brand-500 outline-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-4">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditingId(null); setEditingItem(null); resetForm(); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 rounded-lg text-white hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {editingId ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;
