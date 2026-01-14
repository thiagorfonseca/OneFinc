export interface Clinic {
  id: string;
  name: string;
  created_at: string;
  plano?: string;
  ativo?: boolean;
  responsavel_nome?: string;
  email_contato?: string;
  telefone_contato?: string;
  logo_url?: string | null;
  paginas_liberadas?: string[];
  bank_accounts?: any[];
  categories?: any[];
  clinic_users?: any[];
}

export interface BankAccount {
  id: string;
  name?: string; // alias for nome_conta
  bank?: string; // alias for banco
  nome_conta?: string;
  banco?: string;
  current_balance?: number;
  initial_balance?: number;
  ativo?: boolean;
}

export interface Category {
  id: string;
  name: string;
  tipo?: 'receita' | 'despesa' | string;
  type?: string; // legacy alias
  cor_opcional?: string;
  clinic_id?: string | null;
}

export type TransactionType = 'income' | 'expense' | 'transfer' | 'other';

export const TransactionTypeEnum = {
  INCOME: 'income' as TransactionType,
  EXPENSE: 'expense' as TransactionType,
  TRANSFER: 'transfer' as TransactionType,
  OTHER: 'other' as TransactionType,
};

export type UserRole = 'owner' | 'admin' | 'user';

export interface OrgProfile {
  id: string;
  user_id?: string;
  full_name?: string;
  email?: string;
  role?: UserRole;
  clinic_id?: string | null;
  ativo?: boolean;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  description?: string;
  amount?: number;
  date?: string;
}

export interface Procedure {
  id: string;
  categoria?: string;
  procedimento?: string;
  valor_cobrado?: number;
  custo_insumo?: number;
  tempo_minutos?: number;
  clinic_id?: string;
}

export interface Customer {
  id: string;
  name: string;
  cpf?: string;
  cep?: string;
  clinic_id?: string;
}

export interface Professional {
  id: string;
  nome: string;
  tipo?: string;
  clinic_id?: string;
}

export interface Supplier {
  id: string;
  nome: string;
  cnpj?: string;
  telefone?: string;
}

export interface CardFee {
  id: string;
  bandeira: string;
  taxa_percent: number;
  metodo?: string;
  min_installments?: number;
  max_installments?: number;
  clinic_id?: string | null;
}

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'CREDIT' | 'DEBIT' | string;
  conciliado?: boolean;
  hash_transacao?: string;
}

export interface Revenue {
  id: string;
  description?: string;
  valor_bruto?: number;
  valor_liquido?: number;
  data_competencia?: string;
  data_recebimento?: string;
}

export interface Expense {
  id: string;
  description?: string;
  valor?: number;
  data_competencia?: string;
  data_pagamento?: string;
  data_vencimento?: string;
}
