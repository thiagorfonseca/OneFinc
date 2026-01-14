import { BankAccount, Category } from '../types';

export const mockBankAccounts: BankAccount[] = [
  { id: '1', nome_conta: 'Itaú Principal', banco: 'Itaú', initial_balance: 5000, current_balance: 12500 },
  { id: '2', nome_conta: 'Nubank Reserva', banco: 'Nubank', initial_balance: 10000, current_balance: 10000 },
];

export const mockCategories: Category[] = [
  { id: '1', name: 'Consultas Particulares', tipo: 'receita', cor_opcional: '#0ea5e9' },
  { id: '2', name: 'Repasse Convênios', tipo: 'receita', cor_opcional: '#3b82f6' },
  { id: '3', name: 'Aluguel', tipo: 'despesa', cor_opcional: '#ef4444' },
  { id: '4', name: 'Insumos Médicos', tipo: 'despesa', cor_opcional: '#f97316' },
  { id: '5', name: 'Folha de Pagamento', tipo: 'despesa', cor_opcional: '#eab308' },
  { id: '6', name: 'Marketing', tipo: 'despesa', cor_opcional: '#a855f7' },
];

export const mockTransactions = [
  {
    id: 't1', bank_account_id: '1', category_id: '1',
    description: 'Consulta Dr. Silva', data_competencia: '2023-10-01', data_pagamento: '2023-10-01',
    amount: 450.00, type: 'income', status: 'paid', patient_name: 'João Pedro'
  },
  {
    id: 't2', bank_account_id: '1', category_id: '3',
    description: 'Aluguel Outubro', data_competencia: '2023-10-05', data_pagamento: '2023-10-05',
    amount: 3500.00, type: 'expense', status: 'paid', provider_name: 'Imobiliária Central'
  },
  {
    id: 't3', bank_account_id: '1', category_id: '4',
    description: 'Compra de Luvas', data_competencia: '2023-10-10', data_pagamento: '2023-10-12',
    amount: 250.00, type: 'expense', status: 'paid', provider_name: 'MediHouse'
  },
  {
    id: 't4', bank_account_id: '1', category_id: '1',
    description: 'Consulta Dra. Ana', data_competencia: '2023-10-15', data_pagamento: '2023-10-15',
    amount: 600.00, type: 'income', status: 'paid', patient_name: 'Maria Clara'
  },
];