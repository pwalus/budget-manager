import { useState, useEffect } from "react";
import { transactionsAPI } from "@/lib/api";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";
import { Transaction } from "@/types/database";

export const useTransactions = (tagFilter?: string | null, search?: string, status?: string) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  const fetchTransactions = async (tagFilter?: string | null, search?: string, status?: string) => {
    if (!isAuthenticated) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      const transactions = await transactionsAPI.getAll(tagFilter, search, status);
      setTransactions(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addTransaction = async (transactionData: Omit<Transaction, "id" | "created_at" | "updated_at">) => {
    if (!isAuthenticated) return null;

    try {
      const newTransaction = await transactionsAPI.create(transactionData);
      setTransactions((prev) => [newTransaction, ...prev]);
      toast({
        title: "Success",
        description: "Transaction added successfully",
      });
      return newTransaction;
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast({
        title: "Error",
        description: "Failed to add transaction",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (!isAuthenticated) return null;

    try {
      const updatedTransaction = await transactionsAPI.update(id, updates);
      setTransactions((prev) => prev.map((transaction) => (transaction.id === id ? updatedTransaction : transaction)));
      toast({
        title: "Success",
        description: "Transaction updated successfully",
      });
      return updatedTransaction;
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast({
        title: "Error",
        description: "Failed to update transaction",
        variant: "destructive",
      });
      return null;
    }
  };

  const bulkUpdateTransactions = async (updates: { id: string; data: Partial<Transaction> }[]) => {
    if (!isAuthenticated) return false;

    try {
      for (const update of updates) {
        await updateTransaction(update.id, update.data);
      }
      return true;
    } catch (error) {
      console.error("Error bulk updating transactions:", error);
      toast({
        title: "Error",
        description: "Failed to update transactions",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteTransaction = async (id: string) => {
    if (!isAuthenticated) return false;

    try {
      await transactionsAPI.delete(id);
      setTransactions((prev) => prev.filter((transaction) => transaction.id !== id));
      toast({
        title: "Success",
        description: "Transaction deleted successfully",
      });
      return true;
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast({
        title: "Error",
        description: "Failed to delete transaction",
        variant: "destructive",
      });
      return false;
    }
  };

  const bulkDeleteTransactions = async (ids: string[]) => {
    if (!isAuthenticated) return false;

    try {
      await transactionsAPI.bulkDelete(ids);
      setTransactions((prev) => prev.filter((transaction) => !ids.includes(transaction.id)));
      toast({
        title: "Success",
        description: `${ids.length} transactions deleted successfully`,
      });
      return true;
    } catch (error) {
      console.error("Error bulk deleting transactions:", error);
      toast({
        title: "Error",
        description: "Failed to delete transactions",
        variant: "destructive",
      });
      return false;
    }
  };

  const bulkImportTransactions = async (transactions: any[], accountId: string) => {
    if (!isAuthenticated) return null;

    try {
      const result = await transactionsAPI.bulkImport(transactions, accountId);
      setTransactions((prev) => [...result.transactions, ...prev]);
      toast({
        title: "Success",
        description: `${result.importedCount} transactions imported successfully${
          result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : ""
        }`,
      });
      return result;
    } catch (error) {
      console.error("Error bulk importing transactions:", error);
      toast({
        title: "Error",
        description: "Failed to import transactions",
        variant: "destructive",
      });
      return null;
    }
  };

  useEffect(() => {
    fetchTransactions(tagFilter, search, status);
  }, [isAuthenticated, tagFilter, search, status]);

  return {
    transactions,
    loading,
    addTransaction,
    updateTransaction,
    bulkUpdateTransactions,
    deleteTransaction,
    bulkDeleteTransactions,
    bulkImportTransactions,
    refetch: () => fetchTransactions(tagFilter, search, status),
  };
};
