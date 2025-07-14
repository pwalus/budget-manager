import { useState, useEffect } from "react";
import { accountsAPI } from "@/lib/api";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";
import { Account } from "@/types/database";
import { investmentAPI } from "@/lib/api";

export const useAccounts = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  const fetchAccounts = async () => {
    if (!isAuthenticated) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      const accounts = await accountsAPI.getAll();
      setAccounts(accounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast({
        title: "Error",
        description: "Failed to load accounts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addAccount = async (accountData: Omit<Account, "id" | "created_at" | "updated_at" | "balance">) => {
    if (!isAuthenticated) return null;
    try {
      let newAccount;
      if (accountData.type === "investment") {
        // Only call investmentAPI.createAccount, which creates both entries
        const investmentResult = await investmentAPI.createAccount({ name: accountData.name, user_id: undefined });
        newAccount = investmentResult.account;
      } else {
        newAccount = await accountsAPI.create(accountData);
      }
      setAccounts((prev) => [...prev, newAccount]);
      toast({ title: "Success", description: "Account added successfully" });
      return newAccount;
    } catch (error) {
      console.error("Error adding account:", error);
      toast({ title: "Error", description: "Failed to add account", variant: "destructive" });
      return null;
    }
  };

  const deleteAccount = async (id: string) => {
    if (!isAuthenticated) return false;
    try {
      await accountsAPI.delete(id);
      setAccounts((prev) => prev.filter((account) => account.id !== id));
      toast({ title: "Success", description: "Account deleted successfully" });
      return true;
    } catch (error) {
      console.error("Error deleting account:", error);
      toast({ title: "Error", description: "Failed to delete account", variant: "destructive" });
      return false;
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [isAuthenticated]);

  return {
    accounts,
    loading,
    addAccount,
    deleteAccount,
    refetch: fetchAccounts,
  };
};

export interface InvestmentAsset {
  id: string;
  account_id: string;
  api_source: string;
  asset_id: string;
  symbol: string;
  name: string;
  amount: number;
  last_price?: number;
  last_price_date?: string;
  created_at: string;
  updated_at: string;
}

export interface InvestmentAccount {
  id: string;
  user_id?: string;
  name: string;
  created_at: string;
  updated_at: string;
  assets: InvestmentAsset[];
}

export const useInvestmentAccounts = () => {
  const [accounts, setAccounts] = useState<InvestmentAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const data = await investmentAPI.getAccounts();
      setAccounts(data);
    } catch (error) {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async (accountData: { user_id?: string; name: string }) => {
    try {
      const newAccount = await investmentAPI.createAccount(accountData);
      setAccounts((prev) => [...prev, { ...newAccount, assets: [] }]);
      return newAccount;
    } catch {
      return null;
    }
  };

  const addAsset = async (
    accountId: string,
    assetData: { api_source: string; asset_id: string; symbol: string; name: string; amount: number }
  ) => {
    try {
      const asset = await investmentAPI.addAsset(accountId, assetData);
      setAccounts((prev) =>
        prev.map((acc) => (acc.id === accountId ? { ...acc, assets: [...(acc.assets || []), asset] } : acc))
      );
      return asset;
    } catch {
      return null;
    }
  };

  const updateAssetAmount = async (assetId: string, amount: number) => {
    try {
      const updated = await investmentAPI.updateAssetAmount(assetId, amount);
      setAccounts((prev) =>
        prev.map((acc) => ({
          ...acc,
          assets: acc.assets?.map((a) => (a.id === assetId ? { ...a, amount: updated.amount } : a)) || [],
        }))
      );
      return updated;
    } catch {
      return null;
    }
  };

  const searchAssets = async (query: string) => {
    return investmentAPI.searchAssets(query);
  };

  const getAssetPrice = async (assetId: string, currency: string) => {
    return investmentAPI.getAssetPrice(assetId, currency);
  };

  const updateAssetPrice = async (assetId: string, price: number, date?: string) => {
    try {
      const updated = await investmentAPI.updateAssetPrice(assetId, price, date);
      setAccounts((prev) =>
        prev.map((acc) => ({
          ...acc,
          assets:
            acc.assets?.map((a) =>
              a.id === assetId ? { ...a, last_price: updated.price, last_price_date: updated.date } : a
            ) || [],
        }))
      );
      return updated;
    } catch {
      return null;
    }
  };

  const deleteAsset = async (assetId: string) => {
    try {
      await investmentAPI.deleteAsset(assetId);
      setAccounts((prev) =>
        prev.map((acc) => ({
          ...acc,
          assets: acc.assets?.filter((a) => a.id !== assetId) || [],
        }))
      );
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return {
    accounts,
    loading,
    createAccount,
    addAsset,
    updateAssetAmount,
    deleteAsset,
    searchAssets,
    getAssetPrice,
    updateAssetPrice,
    refetch: fetchAccounts,
  };
};
