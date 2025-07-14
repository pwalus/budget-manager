import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff,
  Tags,
  LogOut,
  User,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { useTags } from "@/hooks/useTags";
import { useInvestmentAccounts } from "@/hooks/useAccounts";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Account, Transaction, TagNode } from "@/types/database";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AccountCard } from "./AccountCard";
import { AddAccountDialog } from "./AddAccountDialog";
import { AddTransactionDialog } from "./AddTransactionDialog";
import { ImportTransactionsDialog } from "./ImportTransactionsDialog";
import { TransactionGrid } from "./TransactionGrid";
import { AccountSidebar } from "./AccountSidebar";
import { PortfolioCharts } from "./PortfolioCharts";
import { TagManager } from "./TagManager";
import { TagBreakdown } from "./TagBreakdown";
import { ManualPriceDialog } from "./ManualPriceDialog";
import { ThemeToggle } from "./ThemeToggle";
import { useNavigate } from "react-router-dom";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  addDays,
  subDays,
  isWithinInterval,
  parseISO,
  format,
  endOfMonth,
  subMonths,
  startOfMonth,
  isBefore,
  isAfter,
} from "date-fns";
import { DateRange } from "react-day-picker";
import { netWorthAPI } from "@/lib/api";
import { investmentAPI } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/utils";

interface Asset {
  id: string;
  api_source: string;
  asset_id: string;
  symbol: string;
  name: string;
  amount: number;
  last_price?: string | number;
  last_price_date?: string;
}

const TIMEFRAME_OPTIONS = [
  { label: "Current month", value: "current_month" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 3 months", value: "3m" },
  { label: "Last 1 year", value: "1y" },
  { label: "Last 5 years", value: "5y" },
  { label: "Custom", value: "custom" },
];

const today = new Date();

// Add a helper to get the currency symbol or code
const getCurrencySymbol = (currency: string) => {
  switch (currency) {
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "PLN":
      return "zł";
    default:
      return currency;
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  // Add state for search and status filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { accounts, loading: accountsLoading, addAccount, refetch: refetchAccounts } = useAccounts();
  const {
    transactions,
    loading: transactionsLoading,
    addTransaction,
    updateTransaction,
    bulkUpdateTransactions,
    deleteTransaction,
    bulkDeleteTransactions,
    refetch: refetchTransactions,
  } = useTransactions(selectedTagFilter, searchQuery, statusFilter);
  const { tags, loading: tagsLoading } = useTags();
  const {
    accounts: investmentAccounts,
    loading: investmentLoading,
    addAsset,
    updateAssetAmount,
    searchAssets,
    getAssetPrice,
    updateAssetPrice,
    refetch: refetchInvestments,
    deleteAsset,
  } = useInvestmentAccounts();

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showImportTransactions, setShowImportTransactions] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState("current_month");
  const [customRange, setCustomRange] = useState<DateRange>({ from: subDays(today, 29), to: today });
  const [netWorthData, setNetWorthData] = useState<{ label: string; value: number }[]>([]);
  // Asset management state
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetResults, setAssetResults] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetAmount, setAssetAmount] = useState("");
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [priceLoading, setPriceLoading] = useState<string | null>(null);
  const [worthHistory, setWorthHistory] = useState<{ date: string; value: number }[]>([]);
  const [worthLoading, setWorthLoading] = useState(false);
  const [showManualPriceDialog, setShowManualPriceDialog] = useState(false);
  const [selectedAssetForPrice, setSelectedAssetForPrice] = useState<Asset | null>(null);
  const [manualEntryMode, setManualEntryMode] = useState(false);
  const [manualSymbol, setManualSymbol] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualAmount, setManualAmount] = useState("");

  const selectedAccount = selectedAccountId ? accounts.find((a) => a.id === selectedAccountId) : null;
  const selectedInvestmentAccount =
    selectedAccount && selectedAccount.type === "investment"
      ? investmentAccounts.find((a) => a.name === selectedAccount.name)
      : null;

  const accountCurrency = selectedAccount?.currency || "PLN";

  // Helper to determine the most common currency (fallback to PLN)
  const getDisplayCurrency = () => {
    if (!accounts.length) return "PLN";
    const counts: Record<string, number> = {};
    for (const acc of accounts) {
      counts[acc.currency] = (counts[acc.currency] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };
  const displayCurrency = selectedAccount ? selectedAccount.currency : getDisplayCurrency();

  useEffect(() => {
    netWorthAPI
      .getTrend()
      .then(setNetWorthData)
      .catch((err) => {
        console.error("Failed to fetch net worth trend", err);
        setNetWorthData([]);
      });
  }, []);

  useEffect(() => {
    const fetchWorth = async () => {
      if (selectedAccount && selectedAccount.type === "investment" && selectedInvestmentAccount) {
        setWorthLoading(true);
        const data = await investmentAPI.getWorthHistory(
          selectedInvestmentAccount.id,
          timeframe === "1y" ? "12m" : "30d"
        );
        setWorthHistory(data);
        setWorthLoading(false);
      } else {
        setWorthHistory([]);
      }
    };
    fetchWorth();
  }, [selectedAccount, selectedInvestmentAccount, timeframe]);

  // Calculate date range based on timeframe
  let fromDate: Date, toDate: Date;
  if (timeframe === "current_month") {
    fromDate = startOfMonth(today);
    toDate = today;
  } else if (timeframe === "30d") {
    fromDate = subDays(today, 29);
    toDate = today;
  } else if (timeframe === "3m") {
    fromDate = subMonths(today, 3);
    toDate = today;
  } else if (timeframe === "1y") {
    fromDate = subDays(today, 364);
    toDate = today;
  } else if (timeframe === "5y") {
    fromDate = subMonths(today, 60);
    toDate = today;
  } else {
    fromDate = customRange.from || subDays(today, 29);
    toDate = customRange.to || today;
  }

  // Filter transactions by date range only (tag filtering is done on backend)
  const filteredTransactions = (
    selectedAccountId
      ? transactions.filter((t) => t.account_id === selectedAccountId)
      : transactions.filter((t, index, arr) => {
          if (t.type !== "transfer" || !t.linked_transaction_id) {
            return true;
          }
          const linkedTransaction = arr.find((lt) => lt.id === t.linked_transaction_id);
          if (!linkedTransaction) return true;
          return t.id < linkedTransaction.id;
        })
  ).filter((t) => {
    try {
      const date = parseISO(t.date);
      // For date comparison, we want to compare just the date part, not the time
      const transactionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const fromDateOnly = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
      const toDateOnly = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());

      const isInRange = transactionDate >= fromDateOnly && transactionDate <= toDateOnly;

      return isInRange;
    } catch (error) {
      console.error("Error parsing transaction date:", t.date, error);
      return false;
    }
  });

  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  // Exclude transfers from income/expense calculations
  const totalIncome = filteredTransactions
    .filter((t) => t.type === "income" && t.status === "cleared")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = filteredTransactions
    .filter((t) => t.type === "expense" && t.status === "cleared")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Calculate balance and class for summary card
  const summaryBalance = selectedAccount ? selectedAccount.balance : totalBalance;
  const summaryBalanceClass = summaryBalance < 0 ? "text-expense" : "text-foreground";

  const handleAddAccount = async (accountData: {
    name: string;
    type: "bank" | "credit" | "savings" | "investment";
    currency: string;
  }) => {
    const newAccount = await addAccount(accountData);
    if (newAccount) {
      setShowAddAccount(false);
    }
  };

  // Transaction handlers: trigger account balance recalculation
  const handleAddTransaction = async (transactionData: Omit<Transaction, "id" | "created_at" | "updated_at">) => {
    const result = await addTransaction(transactionData);
    if (result) {
      await refetchAccounts(); // Recalculate account balances
      // Force a refetch of transactions to ensure the new transaction appears
      await refetchTransactions();
    }
    setShowAddTransaction(false);
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    const result = await updateTransaction(id, updates);
    if (result) {
      await refetchAccounts(); // Recalculate account balances
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const result = await deleteTransaction(id);
    if (result) {
      await refetchAccounts(); // Recalculate account balances
    }
  };

  const handleBulkUpdateTransactions = async (ids: string[], updates: Partial<Transaction>) => {
    const updateRequests = ids.map((id) => ({ id, data: updates }));
    const result = await bulkUpdateTransactions(updateRequests);
    if (result) {
      await refetchAccounts(); // Recalculate account balances
    }
  };

  const handleBulkDeleteTransactions = async (ids: string[]) => {
    const result = await bulkDeleteTransactions(ids);
    if (result) {
      await refetchAccounts(); // Recalculate account balances
    }
  };

  // Convert legacy TagNode format for TagManager compatibility
  const handleTagsChange = (newTags: unknown[]) => {
    // Tags are now managed through the useTags hook
    // This function is kept for compatibility but the actual changes
    // should be made through the hook's functions
  };

  const handleAddAsset = async () => {
    if (!selectedInvestmentAccount || !selectedAsset || !assetAmount) return;
    await addAsset(selectedInvestmentAccount.id, {
      api_source: selectedAsset.api_source,
      asset_id: selectedAsset.asset_id,
      symbol: selectedAsset.symbol,
      name: selectedAsset.name,
      amount: parseFloat(assetAmount),
    });
    setShowAddAsset(false);
    setAssetSearch("");
    setAssetResults([]);
    setSelectedAsset(null);
    setAssetAmount("");
    refetchInvestments();
  };

  const handleEditAmount = async (asset: Asset, newAmount: string) => {
    if (!newAmount) return;
    await updateAssetAmount(asset.id, parseFloat(newAmount));
    refetchInvestments();
  };

  const handleDeleteAsset = async (assetId: string) => {
    const result = await deleteAsset(assetId);
    if (result) {
      refetchInvestments();
    }
  };

  const fetchPrice = async (asset: Asset) => {
    setPriceLoading(asset.id);
    try {
      const priceResp = await getAssetPrice(asset.id, accountCurrency);
      setPriceMap((prev) => ({ ...prev, [asset.id]: priceResp.price }));
    } catch (error) {
      // If API price fetch fails, show manual price dialog
      setSelectedAssetForPrice(asset);
      setShowManualPriceDialog(true);
    } finally {
      setPriceLoading(null);
    }
  };

  const handleManualPriceSave = async (assetId: string, price: number, date: string) => {
    try {
      await updateAssetPrice(assetId, price, date);
      setPriceMap((prev) => ({ ...prev, [assetId]: price }));
      refetchInvestments();
    } catch (error) {
      console.error("Error saving manual price:", error);
    }
  };

  if (accountsLoading || transactionsLoading || tagsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-dashboard">
        <div className="text-center glass-panel p-8 rounded-2xl animate-fade-in">
          <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h3 className="text-lg font-semibold mb-2">Loading your financial data</h3>
          <p className="text-muted-foreground">Please wait while we prepare your dashboard...</p>
          <div className="mt-4 flex justify-center space-x-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AccountSidebar
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountSelect={setSelectedAccountId}
          balanceVisible={balanceVisible}
        />

        <main className="flex-1 bg-transparent overflow-auto">
          {/* Enhanced Header */}
          <div className="glass-panel border-b border-border/50 backdrop-blur-md">
            <div className="flex flex-col gap-6 p-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="interactive-hover" />
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gradient mb-2">
                    {selectedAccount ? selectedAccount.name : "Budget Manager"}
                  </h1>
                  <p className="text-muted-foreground text-lg">
                    {selectedAccount
                      ? `${
                          selectedAccount.type.charAt(0).toUpperCase() + selectedAccount.type.slice(1)
                        } Account Dashboard`
                      : "Track your finances with confidence"}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => navigate("/tags")}
                    variant="outline"
                    className="btn-glass hover:shadow-medium transition-all"
                  >
                    <Tags className="w-4 h-4 mr-2" />
                    Manage Tags
                  </Button>
                  <Button
                    onClick={() => setShowAddTransaction(true)}
                    variant="outline"
                    className="btn-glass hover:shadow-medium transition-all"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Transaction
                  </Button>
                  <Button
                    onClick={() => setShowImportTransactions(true)}
                    variant="outline"
                    className="btn-glass hover:shadow-medium transition-all"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button
                    onClick={() => setShowAddAccount(true)}
                    className="btn-gradient shadow-medium hover:shadow-strong"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Account
                  </Button>

                  <ThemeToggle />
                  <Button
                    onClick={signOut}
                    variant="ghost"
                    size="icon"
                    title="Sign out"
                    className="hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {/* Enhanced Time Frame Selector */}
              <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl">
                <span className="text-sm font-semibold">Time frame:</span>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEFRAME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {timeframe === "custom" && (
                  <div className="flex items-center gap-2">
                    <Calendar
                      mode="range"
                      selected={{ from: customRange.from, to: customRange.to }}
                      onSelect={(range: DateRange | undefined) =>
                        setCustomRange(range || { from: undefined, to: undefined })
                      }
                      numberOfMonths={2}
                    />
                    <span className="text-xs text-muted-foreground">
                      {customRange.from && customRange.to
                        ? `${format(customRange.from, "yyyy-MM-dd")} to ${format(customRange.to, "yyyy-MM-dd")}`
                        : "Select range"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedAccount?.type === "investment" && selectedInvestmentAccount ? (
            <div className="p-8 space-y-8 animate-fade-in">
              {/* Summary Card (only balance) */}
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mb-8">
                <Card className="card-elevated border-l-4 border-l-blue-500 animate-slide-up">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <CardTitle className="text-sm font-semibold">
                        {selectedAccount ? "Account Balance" : "Total Balance"}
                      </CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setBalanceVisible(!balanceVisible)}
                      className="h-8 w-8 interactive-hover"
                    >
                      {balanceVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${summaryBalanceClass} mb-2 tabular-nums`}>
                      {balanceVisible ? formatCurrency(summaryBalance, displayCurrency) : "••••••"}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedAccount ? selectedAccount.name : "Across all accounts"}
                    </p>
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 w-3/4 transition-all duration-500"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              {/* Asset Management Section */}
              <Card className="card-elevated">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" /> Assets
                  </CardTitle>
                  <Button className="btn-gradient" onClick={() => setShowAddAsset(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Add Asset
                  </Button>
                </CardHeader>
                <CardContent>
                  {/* Asset Table */}
                  <div className="overflow-x-auto rounded-xl border shadow-soft">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Symbol</th>
                          <th className="px-4 py-3 text-left font-semibold">Name</th>
                          <th className="px-4 py-3 text-left font-semibold">Amount</th>
                          <th className="px-4 py-3 text-left font-semibold">Last Price</th>
                          <th className="px-4 py-3 text-left font-semibold">Value</th>
                          <th className="px-4 py-3 text-left font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvestmentAccount.assets && selectedInvestmentAccount.assets.length > 0 ? (
                          selectedInvestmentAccount.assets.map((asset) => (
                            <tr key={asset.id} className="hover:bg-accent/20 transition-colors">
                              <td className="px-4 py-2 font-mono font-semibold">{asset.symbol}</td>
                              <td className="px-4 py-2">{asset.name}</td>
                              <td className="px-4 py-2">
                                <Input
                                  type="number"
                                  className="w-24"
                                  value={asset.amount}
                                  onChange={(e) => handleEditAmount(asset, e.target.value)}
                                />
                              </td>
                              <td className="px-4 py-2">
                                {priceMap[asset.id] !== undefined ? (
                                  <span>{formatCurrency(priceMap[asset.id], accountCurrency)}</span>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => fetchPrice(asset)}
                                    disabled={priceLoading === asset.id}
                                  >
                                    {priceLoading === asset.id ? "Loading..." : "Fetch Price"}
                                  </Button>
                                )}
                              </td>
                              <td className="px-4 py-2 font-semibold">
                                {priceMap[asset.id] !== undefined
                                  ? formatCurrency(asset.amount * priceMap[asset.id], accountCurrency)
                                  : "-"}
                              </td>
                              <td className="px-4 py-2">
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteAsset(asset.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="text-center text-muted-foreground py-6">
                              No assets found for this account.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              {/* Asset Worth History Chart */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" /> Asset Worth History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={worthHistory} margin={{ left: 60, right: 30, top: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="p-8 space-y-8 animate-fade-in">
              {/* Enhanced Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="card-elevated border-l-4 border-l-blue-500 animate-slide-up">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <CardTitle className="text-sm font-semibold">
                        {selectedAccount ? "Account Balance" : "Total Balance"}
                      </CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setBalanceVisible(!balanceVisible)}
                      className="h-8 w-8 interactive-hover"
                    >
                      {balanceVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${summaryBalanceClass} mb-2 tabular-nums`}>
                      {balanceVisible ? formatCurrency(summaryBalance, displayCurrency) : "••••••"}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedAccount ? selectedAccount.name : "Across all accounts"}
                    </p>
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 w-3/4 transition-all duration-500"></div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="card-elevated border-l-4 border-l-green-500 animate-slide-up"
                  style={{ animationDelay: "0.1s" }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <CardTitle className="text-sm font-semibold">Income</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 mb-2 tabular-nums">
                      {formatCurrency(totalIncome, displayCurrency)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedAccount ? selectedAccount.name : "All accounts"}
                    </p>
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-green-500 to-green-600 w-4/5 transition-all duration-500"></div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="card-elevated border-l-4 border-l-red-500 animate-slide-up"
                  style={{ animationDelay: "0.2s" }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                        <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                      <CardTitle className="text-sm font-semibold">Expenses</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600 mb-2 tabular-nums">
                      {formatCurrency(totalExpenses, displayCurrency)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedAccount ? selectedAccount.name : "All accounts"}
                    </p>
                    <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-red-500 to-red-600 w-2/3 transition-all duration-500"></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              {/* Enhanced Charts Section */}
              {!selectedAccountId && (
                <div className="space-y-6 animate-fade-in">
                  <PortfolioCharts accounts={accounts} netWorthData={netWorthData} />
                  <TagBreakdown transactions={filteredTransactions} tags={tags} />
                </div>
              )}

              {/* Enhanced Transactions Section */}
              <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      {selectedAccount ? `${selectedAccount.name} Transactions` : "Recent Transactions"}
                    </h2>
                    <p className="text-muted-foreground">{filteredTransactions.length} transactions found</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span>Live data</span>
                    </div>
                  </div>
                </div>

                {/* Filter Section: Search, Status, Tag */}
                <div className="mb-6 p-4 bg-muted/30 rounded-xl border">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Search by description/title */}
                    <div className="flex items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-4-4m0 0A7 7 0 104 4a7 7 0 0013 13z"
                        />
                      </svg>
                      <span className="text-sm font-medium">Search:</span>
                      <Input
                        placeholder="Search by description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-48"
                      />
                      {searchQuery && (
                        <Button onClick={() => setSearchQuery("")} variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {/* Status filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Status:</span>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="cleared">Cleared</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Tag filter */}
                    <div className="flex items-center gap-2">
                      <Tags className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Tag:</span>
                      <Select
                        value={selectedTagFilter || "all"}
                        onValueChange={(value) => setSelectedTagFilter(value === "all" ? null : value)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select a tag..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All tags</SelectItem>
                          {tags.map((tag) => (
                            <SelectItem key={tag.id} value={tag.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                {tag.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTagFilter && (
                        <Button
                          onClick={() => setSelectedTagFilter(null)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <Card className="card-elevated overflow-hidden">
                  <CardContent className="p-0">
                    <TransactionGrid
                      transactions={filteredTransactions}
                      accounts={accounts}
                      onUpdateTransaction={handleUpdateTransaction}
                      onBulkUpdateTransactions={handleBulkUpdateTransactions}
                      onDeleteTransaction={handleDeleteTransaction}
                      onBulkDeleteTransactions={handleBulkDeleteTransactions}
                      selectedAccountId={selectedAccountId}
                      getCurrencySymbol={getCurrencySymbol}
                      selectedTagFilter={selectedTagFilter}
                      tags={tags}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>

      <AddAccountDialog open={showAddAccount} onOpenChange={setShowAddAccount} onAddAccount={handleAddAccount} />

      <AddTransactionDialog
        open={showAddTransaction}
        onOpenChange={setShowAddTransaction}
        onAddTransaction={handleAddTransaction}
        accounts={accounts}
        defaultAccountId={selectedAccountId || undefined}
      />

      <ImportTransactionsDialog open={showImportTransactions} onOpenChange={setShowImportTransactions} />

      {showTagManager && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <TagManager tags={tags} onTagsChange={handleTagsChange} onClose={() => setShowTagManager(false)} />
        </div>
      )}

      {/* Add Asset Dialog */}
      <Dialog open={showAddAsset} onOpenChange={setShowAddAsset}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Asset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Toggle between search and manual entry */}
            <div className="flex gap-2 mb-2">
              <Button
                variant={!manualEntryMode ? "default" : "outline"}
                onClick={() => setManualEntryMode(false)}
                type="button"
              >
                Search
              </Button>
              <Button
                variant={manualEntryMode ? "default" : "outline"}
                onClick={() => setManualEntryMode(true)}
                type="button"
              >
                Manual Entry
              </Button>
            </div>
            {!manualEntryMode ? (
              <>
                <Input
                  placeholder="Search by symbol (e.g. BTC, ETH)"
                  value={assetSearch}
                  onChange={(e) => setAssetSearch(e.target.value)}
                />
                <Button
                  onClick={async () => setAssetResults(await searchAssets(assetSearch))}
                  className="w-full"
                  type="button"
                >
                  Search
                </Button>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {assetResults.map((result) => (
                    <div
                      key={result.api_source + result.asset_id}
                      className={`p-2 border rounded cursor-pointer ${selectedAsset === result ? "bg-accent" : ""}`}
                      onClick={() => setSelectedAsset(result)}
                    >
                      <div className="font-medium">
                        {result.symbol} <span className="text-xs text-muted-foreground">{result.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">API: {result.api_source}</div>
                    </div>
                  ))}
                </div>
                {selectedAsset && (
                  <div className="space-y-2">
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={assetAmount}
                      onChange={(e) => setAssetAmount(e.target.value)}
                    />
                    <Button onClick={handleAddAsset} className="w-full" type="button">
                      Add Asset
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <Input
                  placeholder="Symbol (e.g. EIMI.L)"
                  value={manualSymbol}
                  onChange={(e) => setManualSymbol(e.target.value)}
                />
                <Input
                  placeholder="Name (e.g. iShares MSCI EM IMI UCITS ETF)"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                />
                <Button
                  onClick={async () => {
                    if (!selectedInvestmentAccount) return;
                    await addAsset(selectedInvestmentAccount.id, {
                      api_source: "manual",
                      asset_id: manualSymbol,
                      symbol: manualSymbol,
                      name: manualName,
                      amount: parseFloat(manualAmount),
                    });
                    setShowAddAsset(false);
                    setManualSymbol("");
                    setManualName("");
                    setManualAmount("");
                    refetchInvestments();
                  }}
                  className="w-full"
                  disabled={!manualSymbol || !manualName || !manualAmount}
                  type="button"
                >
                  Add Asset Manually
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Price Dialog */}
      <ManualPriceDialog
        open={showManualPriceDialog}
        onOpenChange={setShowManualPriceDialog}
        asset={selectedAssetForPrice}
        currency={accountCurrency}
        onSave={handleManualPriceSave}
      />
    </SidebarProvider>
  );
};

export default Dashboard;
