export interface Clinic {
  id: string;
  name: string;
  created_at: string;
}

export interface BankAccount {
  id: string;
  clinic_id: string;
  name: string;
  bank: string;
  agency?: string;
  account_number?: string;
  initial_balance: number;
  current_balance: number; // Calculated on frontend or via DB view
}

export enum TransactionType {
  INCOME = 'INCOME', // Receita
  EXPENSE = 'EXPENSE' // Despesa
}

export interface Category {
  id: string;
  clinic_id: string;
  name: string;
  type: TransactionType;
  color?: string;
}

export interface Transaction {
  id: string;
  clinic_id: string;
  bank_account_id: string;
  category_id: string;
  description: string;
  competency_date: string; // Data competência
  payment_date: string; // Data pagamento/recebimento
  amount: number; // Positive for income, negative for expense logic
  type: TransactionType;
  status: 'paid' | 'pending';
  // Specific fields
  patient_name?: string; // For income
  provider_name?: string; // For expense
  payment_method?: string;
  observations?: string;
}

export interface OFXTransaction {
  id: string; // generated ID
  fitid: string; // OFX unique ID
  date: string;
  amount: number;
  description: string;
  type: 'DEBIT' | 'CREDIT';
  conciliated_transaction_id?: string; // If linked to a system transaction
}

export interface DashboardMetrics {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  monthlyTrend: { name: string; income: number; expense: number }[];
  categoryDistribution: { name: string; value: number }[];
}
