import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, PieChart as PieChartIcon } from "lucide-react";

interface Account {
  id: string;
  name: string;
  type: "bank" | "credit" | "savings" | "investment";
  balance: number;
  currency: string;
}

interface NetWorthPoint {
  label: string;
  value: number;
}

interface PortfolioChartsProps {
  accounts: Account[];
  netWorthData?: NetWorthPoint[];
}

const ACCOUNT_TYPE_COLORS = {
  bank: "hsl(var(--primary))",
  savings: "hsl(var(--success))",
  investment: "#8b5cf6", // Visible purple for investments
  credit: "hsl(var(--warning))",
};

const ACCOUNT_TYPE_LABELS = {
  bank: "Bank Accounts",
  credit: "Credit Cards",
  savings: "Savings",
  investment: "Investments",
};

const ACCOUNT_TYPE_GRADIENTS = {
  bank: "from-blue-500 to-blue-600",
  credit: "from-orange-500 to-orange-600",
  savings: "from-green-500 to-green-600",
  investment: "from-purple-500 to-purple-600",
};

export const PortfolioCharts = ({ accounts, netWorthData }: PortfolioChartsProps) => {
  // Calculate account type breakdown
  const accountTypeData = Object.entries(
    accounts.reduce((acc, account) => {
      const type = account.type;
      if (!acc[type]) acc[type] = 0;
      acc[type] += Math.max(0, account.balance); // Only positive balances for pie chart
      return acc;
    }, {} as Record<string, number>)
  )
    .filter(([_, value]) => value > 0)
    .map(([type, value]) => ({
      name: ACCOUNT_TYPE_LABELS[type as keyof typeof ACCOUNT_TYPE_LABELS],
      value,
      fill: ACCOUNT_TYPE_COLORS[type as keyof typeof ACCOUNT_TYPE_COLORS],
      gradient: ACCOUNT_TYPE_GRADIENTS[type as keyof typeof ACCOUNT_TYPE_GRADIENTS],
      percentage: 0, // Will be calculated below
    }));

  // Calculate percentages
  const total = accountTypeData.reduce((sum, item) => sum + item.value, 0);
  accountTypeData.forEach((item) => {
    item.percentage = total > 0 ? (item.value / total) * 100 : 0;
  });

  // Helper to determine the most common currency (fallback to PLN)
  const getDisplayCurrency = () => {
    if (!accounts.length) return "PLN";
    const counts: Record<string, number> = {};
    for (const acc of accounts) {
      counts[acc.currency] = (counts[acc.currency] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };
  const displayCurrency = getDisplayCurrency();

  // Use provided net worth data or fallback to sample
  const netWorthTrend = netWorthData || [
    { label: "Jan", value: 22000 },
    { label: "Feb", value: 23500 },
    { label: "Mar", value: 24200 },
    { label: "Apr", value: 25100 },
    { label: "May", value: 24800 },
    { label: "Jun", value: 26200 },
    { label: "Jul", value: 24950 },
  ];

  // Calculate dynamic Y-axis domain for net worth chart
  const netWorthValues = netWorthTrend.map((point) => point.value);
  const minNetWorth = Math.min(...netWorthValues);
  const maxNetWorth = Math.max(...netWorthValues);
  const yAxisMin = Math.max(0, Math.floor(minNetWorth * 0.95));
  const yAxisMax = Math.ceil(maxNetWorth * 1.1);

  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-panel p-4 rounded-xl shadow-strong border">
          <p className="font-semibold text-sm mb-1">{data.name}</p>
          <p className="text-lg font-bold text-primary">{formatCurrency(data.value, displayCurrency)}</p>
          <p className="text-xs text-muted-foreground">{data.percentage.toFixed(1)}% of total</p>
        </div>
      );
    }
    return null;
  };

  const NetWorthTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel p-4 rounded-xl shadow-strong border">
          <p className="font-semibold text-sm mb-1">{label}</p>
          <p className="text-lg font-bold text-primary">{formatCurrency(payload[0].value, displayCurrency)}</p>
          <p className="text-xs text-muted-foreground">Net Worth</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Enhanced Portfolio Breakdown */}
      <Card className="card-elevated animate-slide-up">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <PieChartIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Portfolio Breakdown</CardTitle>
              <CardDescription>Distribution of assets by account type</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {accountTypeData.length === 0 ? (
            <div className="h-[350px] flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                  <PieChartIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No asset data available for this period.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-[300px] w-full mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={accountTypeData}
                      cx="50%"
                      cy="50%"
                      outerRadius={110}
                      innerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {accountTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Enhanced Legend */}
              <div className="space-y-3">
                {accountTypeData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${item.gradient}`} />
                      <span className="text-sm font-medium">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{formatCurrency(item.value, displayCurrency)}</div>
                      <div className="text-xs text-muted-foreground">{item.percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Net Worth Trend */}
      <Card className="card-elevated animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Net Worth Trend</CardTitle>
              <CardDescription>Your financial progress over time</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {netWorthTrend.length === 0 ? (
            <div className="h-[350px] flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No net worth data available for this period.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-[300px] w-full mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={netWorthTrend} margin={{ left: 60, right: 30, top: 20, bottom: 20 }}>
                    <defs>
                      <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      domain={[yAxisMin, yAxisMax]}
                      tickFormatter={(value) => formatCurrency(value, displayCurrency)}
                    />
                    <Tooltip content={<NetWorthTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: "hsl(var(--primary))", strokeWidth: 2 }}
                      fill="url(#netWorthGradient)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Trend Summary */}
              <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                <div className="text-sm text-muted-foreground">Current Period</div>
                <div className="text-right">
                  <div className="text-sm font-bold">
                    {formatCurrency(netWorthTrend[netWorthTrend.length - 1]?.value || 0, displayCurrency)}
                  </div>
                  <div className="text-xs text-green-600">↗ Trending up</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
