-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE account_type AS ENUM ('bank', 'credit', 'savings', 'investment');
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE transaction_status AS ENUM ('pending', 'cleared', 'duplicated');

-- Create accounts table
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type account_type NOT NULL,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tags table
CREATE TABLE public.tags (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, parent_id)
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type transaction_type NOT NULL,
  status transaction_status NOT NULL DEFAULT 'pending',
  tags UUID[] DEFAULT '{}',
  from_account_id UUID REFERENCES public.accounts(id),
  to_account_id UUID REFERENCES public.accounts(id),
  linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create investment accounts table
CREATE TABLE public.investment_accounts (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create investment assets table
CREATE TABLE public.investment_assets (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.investment_accounts(id) ON DELETE CASCADE,
  api_source TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(24,8) NOT NULL DEFAULT 0,
  last_price NUMERIC(24,8),
  last_price_date TIMESTAMP WITH TIME ZONE,
  currency TEXT NOT NULL DEFAULT 'PLN',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create asset worth history table
CREATE TABLE public.asset_worth_history (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.investment_assets(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  amount NUMERIC(24,8) NOT NULL,
  price NUMERIC(24,8) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(asset_id, date)
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate account balances
CREATE OR REPLACE FUNCTION public.get_account_balances()
RETURNS TABLE(account_id UUID, balance DECIMAL(12,2)) AS $$
BEGIN
  RETURN QUERY
  WITH account_balances AS (
    SELECT 
      a.id as account_id,
      COALESCE(
        SUM(
          CASE 
            WHEN t.type = 'income' AND t.status = 'cleared' THEN t.amount
            WHEN t.type = 'expense' AND t.status = 'cleared' THEN t.amount
            WHEN t.type = 'transfer' AND t.status = 'cleared' THEN t.amount
            ELSE 0
          END
        ), 0
      ) as balance
    FROM public.accounts a
    LEFT JOIN public.transactions t ON t.account_id = a.id
    GROUP BY a.id
  )
  SELECT ab.account_id, ab.balance
  FROM account_balances ab;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate investment account balances
CREATE OR REPLACE FUNCTION public.get_investment_account_balances()
RETURNS TABLE(account_id UUID, balance DECIMAL(12,2)) AS $$
BEGIN
  RETURN QUERY
  WITH latest_asset_worth AS (
    SELECT 
      ia.account_id,
      SUM(awh.amount * awh.price) as balance
    FROM public.investment_accounts ia
    LEFT JOIN public.investment_assets iaa ON ia.id = iaa.account_id
    LEFT JOIN LATERAL (
      SELECT amount, price
      FROM public.asset_worth_history awh
      WHERE awh.asset_id = iaa.id
      ORDER BY awh.date DESC
      LIMIT 1
    ) awh ON true
    GROUP BY ia.account_id
  )
  SELECT 
    ia.account_id,
    COALESCE(law.balance, 0) as balance
  FROM public.investment_accounts ia
  LEFT JOIN latest_asset_worth law ON law.account_id = ia.account_id;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_investment_accounts_updated_at BEFORE UPDATE ON public.investment_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_investment_assets_updated_at BEFORE UPDATE ON public.investment_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_linked_transaction_id ON public.transactions(linked_transaction_id);
CREATE INDEX idx_tags_parent_id ON public.tags(parent_id);
CREATE INDEX idx_investment_assets_account_id ON public.investment_assets(account_id);
CREATE INDEX idx_investment_assets_api_source_asset_id ON public.investment_assets(api_source, asset_id);
CREATE INDEX idx_asset_worth_history_asset_id_date ON public.asset_worth_history(asset_id, date); 