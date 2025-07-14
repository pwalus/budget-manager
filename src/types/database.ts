export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  tags?: string[]; // UUIDs as strings
  from_account_id?: string;
  to_account_id?: string;
  linked_transaction_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  parent_id?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface TagNode extends Tag {
  children: TagNode[];
}

export type AccountType = 'bank' | 'credit' | 'savings' | 'investment';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'pending' | 'cleared';

export interface AuthState {
  isAuthenticated: boolean;
}

export interface DatabaseError {
  message: string;
  code?: string;
} 