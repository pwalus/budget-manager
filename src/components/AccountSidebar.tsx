import { useState } from "react";
import { Wallet, CreditCard, PiggyBank, TrendingUp } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { formatCurrency } from "@/lib/utils";

const accountIcons = {
  bank: Wallet,
  credit: CreditCard,
  savings: PiggyBank,
  investment: TrendingUp,
};

const accountTypeLabels = {
  bank: "Bank Accounts",
  credit: "Credit Cards",
  savings: "Savings",
  investment: "Investments",
};

interface Account {
  id: string;
  name: string;
  type: "bank" | "credit" | "savings" | "investment";
  balance: number;
  currency: string;
}

interface AccountSidebarProps {
  accounts: Account[];
  selectedAccountId: string | null;
  onAccountSelect: (accountId: string | null) => void;
  balanceVisible: boolean;
}

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

export const AccountSidebar = ({
  accounts,
  selectedAccountId,
  onAccountSelect,
  balanceVisible,
}: AccountSidebarProps) => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const getBalanceColor = (account: Account) => {
    const isNegative = account.balance < 0;
    const isCredit = account.type === "credit";

    if (isCredit) {
      return "text-red-400";
    }
    return isNegative ? "text-destructive" : "text-foreground";
  };

  const formatBalance = (account: Account) => {
    if (!balanceVisible) return "••••••";
    return formatCurrency(account.balance, account.currency);
  };

  // Group accounts by type
  const groupedAccounts = accounts.reduce((groups, account) => {
    if (!groups[account.type]) {
      groups[account.type] = [];
    }
    groups[account.type].push(account);
    return groups;
  }, {} as Record<string, Account[]>);

  // Define the order of account types
  const accountTypeOrder = ["bank", "credit", "savings", "investment"];

  return (
    <Sidebar className={`${collapsed ? "w-14" : "w-64"} glass-panel`} collapsible="icon">
      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold text-muted-foreground mb-2">Overview</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* All Accounts Option */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onAccountSelect(null)}
                  className={`${
                    selectedAccountId === null
                      ? "bg-primary text-primary-foreground shadow-medium"
                      : "hover:bg-accent/50"
                  } interactive-hover rounded-lg transition-all`}
                >
                  <div className="p-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-md">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                  {!collapsed && <span className="font-medium">All Accounts</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Enhanced Account Type Groups */}
        {accountTypeOrder.map((type) => {
          const accountsOfType = groupedAccounts[type] || [];
          if (accountsOfType.length === 0) return null;

          const getTypeGradient = (accountType: string) => {
            switch (accountType) {
              case "credit":
                return "from-orange-500 to-orange-600";
              case "investment":
                return "from-purple-500 to-purple-600";
              case "savings":
                return "from-green-500 to-green-600";
              default:
                return "from-blue-500 to-blue-600";
            }
          };

          return (
            <SidebarGroup key={type} className="animate-fade-in">
              <SidebarGroupLabel className="text-sm font-semibold text-muted-foreground mb-2">
                {accountTypeLabels[type]}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {accountsOfType.map((account, index) => {
                    const Icon = accountIcons[account.type];
                    const isSelected = selectedAccountId === account.id;
                    const isNegative = account.balance < 0;

                    return (
                      <SidebarMenuItem
                        key={account.id}
                        className="animate-slide-up"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <SidebarMenuButton
                          onClick={() => onAccountSelect(account.id)}
                          className={`${
                            isSelected ? "bg-primary text-primary-foreground shadow-medium" : "hover:bg-accent/50"
                          } interactive-hover h-auto py-3 rounded-lg transition-all relative`}
                        >
                          <div className={`p-1 bg-gradient-to-r ${getTypeGradient(account.type)} rounded-md`}>
                            <Icon className="h-4 w-4 text-white flex-shrink-0" />
                          </div>
                          {!collapsed && (
                            <div className="flex flex-col items-start flex-1 min-w-0">
                              <span className="font-medium text-sm truncate w-full">{account.name}</span>
                              <div className="flex items-center space-x-2 w-full">
                                <span className={`text-xs font-semibold tabular-nums ${getBalanceColor(account)}`}>
                                  {formatBalance(account)}
                                </span>
                                {isNegative && (
                                  <div className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
                                )}
                              </div>
                            </div>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
};
