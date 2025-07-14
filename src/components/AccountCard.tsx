import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, CreditCard, PiggyBank, TrendingUp, Eye, EyeOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const accountIcons = {
  bank: Wallet,
  credit: CreditCard,
  savings: PiggyBank,
  investment: TrendingUp,
};

const accountTypeLabels = {
  bank: "Bank Account",
  credit: "Credit Card",
  savings: "Savings",
  investment: "Investment",
};

const accountTypeColors = {
  bank: "from-blue-500 to-blue-600",
  credit: "from-orange-500 to-orange-600",
  savings: "from-green-500 to-green-600",
  investment: "from-purple-500 to-purple-600",
};

interface AccountCardProps {
  account: {
    id: string;
    name: string;
    type: "bank" | "credit" | "savings" | "investment";
    balance: number;
    currency: string;
  };
  balanceVisible: boolean;
  onToggleVisibility?: () => void;
  onClick?: () => void;
}

export const AccountCard = ({ account, balanceVisible, onToggleVisibility, onClick }: AccountCardProps) => {
  const Icon = accountIcons[account.type];
  const isNegative = account.balance < 0;
  const isCredit = account.type === "credit";

  const getBalanceColor = () => {
    if (isCredit) {
      return "text-destructive";
    }
    return isNegative ? "text-destructive" : "text-foreground";
  };

  const getCardStyle = () => {
    const baseStyle = "card-elevated interactive-hover interactive-press animate-fade-in";

    if (isCredit) {
      return `${baseStyle} border-l-4 border-l-orange-500`;
    }
    if (account.type === "investment") {
      return `${baseStyle} border-l-4 border-l-purple-500`;
    }
    if (account.type === "savings") {
      return `${baseStyle} border-l-4 border-l-green-500`;
    }
    return `${baseStyle} border-l-4 border-l-blue-500`;
  };

  const getIconBackground = () => {
    const gradientClass = accountTypeColors[account.type];
    return `bg-gradient-to-r ${gradientClass} p-2 rounded-lg`;
  };

  const getAccountTypeStyle = () => {
    switch (account.type) {
      case "credit":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "investment":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "savings":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
  };

  return (
    <Card className={getCardStyle()} onClick={onClick}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center space-x-3">
          <div className={getIconBackground()}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold truncate text-balance">{account.name}</CardTitle>
            <Badge variant="secondary" className={`text-xs mt-1 ${getAccountTypeStyle()}`}>
              {accountTypeLabels[account.type]}
            </Badge>
          </div>
        </div>
        {onToggleVisibility && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
            className="p-1 rounded-md hover:bg-muted/50 transition-colors focus-ring"
            aria-label={balanceVisible ? "Hide balance" : "Show balance"}
          >
            {balanceVisible ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className={`text-2xl font-bold ${getBalanceColor()} transition-colors`}>
              {balanceVisible ? (
                <span className="tabular-nums">{formatCurrency(account.balance, account.currency)}</span>
              ) : (
                <span className="select-none">••••••</span>
              )}
            </div>
            {isNegative && <div className="indicator-dot error" />}
          </div>

          {/* Balance trend indicator (placeholder for future enhancement) */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Available Balance</span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Active</span>
            </div>
          </div>

          {/* Visual balance bar */}
          <div className="relative">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isNegative
                    ? "bg-gradient-to-r from-red-500 to-red-600"
                    : "bg-gradient-to-r from-green-500 to-green-600"
                }`}
                style={{
                  width: `${Math.min(100, (Math.abs(account.balance) / 10000) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
