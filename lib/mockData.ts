import { BankAccount, Category, Transaction, TransactionType } from '../types';

export const mockBankAccounts: BankAccount[] = [
  { id: '1', clinic_id: 'c1', name: 'Itaú Principal', bank: 'Itaú', initial_balance: 5000, current_balance: 12500 },
  { id: '2', clinic_id: 'c1', name: 'Nubank Reserva', bank: 'Nubank', initial_balance: 10000, current_balance: 10000 },
];

export const mockCategories: Category[] = [
  { id: '1', clinic_id: 'c1', name: 'Consultas Particulares', type: TransactionType.INCOME, color: '#0ea5e9' },
  { id: '2', clinic_id: 'c1', name: 'Repasse Convênios', type: TransactionType.INCOME, color: '#3b82f6' },
  { id: '3', clinic_id: 'c1', name: 'Aluguel', type: TransactionType.EXPENSE, color: '#ef4444' },
  { id: '4', clinic_id: 'c1', name: 'Insumos Médicos', type: TransactionType.EXPENSE, color: '#f97316' },
  { id: '5', clinic_id: 'c1', name: 'Folha de Pagamento', type: TransactionType.EXPENSE, color: '#eab308' },
  { id: '6', clinic_id: 'c1', name: 'Marketing', type: TransactionType.EXPENSE, color: '#a855f7' },
];

export const mockTransactions: Transaction[] = [
  { 
    id: 't1', clinic_id: 'c1', bank_account_id: '1', category_id: '1', 
    description: 'Consulta Dr. Silva', competency_date: '2023-10-01', payment_date: '2023-10-01', 
    amount: 450.00, type: TransactionType.INCOME, status: 'paid', patient_name: 'João Pedro' 
  },
  { 
    id: 't2', clinic_id: 'c1', bank_account_id: '1', category_id: '3', 
    description: 'Aluguel Outubro', competency_date: '2023-10-05', payment_date: '2023-10-05', 
    amount: 3500.00, type: TransactionType.EXPENSE, status: 'paid', provider_name: 'Imobiliária Central' 
  },
  { 
    id: 't3', clinic_id: 'c1', bank_account_id: '1', category_id: '4', 
    description: 'Compra de Luvas', competency_date: '2023-10-10', payment_date: '2023-10-12', 
    amount: 250.00, type: TransactionType.EXPENSE, status: 'paid', provider_name: 'MediHouse' 
  },
  { 
    id: 't4', clinic_id: 'c1', bank_account_id: '1', category_id: '1', 
    description: 'Consulta Dra. Ana', competency_date: '2023-10-15', payment_date: '2023-10-15', 
    amount: 600.00, type: TransactionType.INCOME, status: 'paid', patient_name: 'Maria Clara' 
  },
];