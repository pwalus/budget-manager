import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
} from "recharts";
import { Tag } from "lucide-react";
import type { TagNode } from "@/types/database";
import { formatCurrency } from "@/lib/utils";

function buildTagIdToRootNameMap(tags: TagNode[]): Record<string, string> {
  const map: Record<string, string> = {};
  function traverse(node: TagNode, rootName: string) {
    map[node.id] = rootName;
    node.children.forEach((child) => traverse(child, rootName));
  }
  tags.forEach((root) => traverse(root, root.name));
  return map;
}

function buildRootNameToColorMap(tags: TagNode[]): Record<string, string> {
  const map: Record<string, string> = {};
  function traverse(node: TagNode, rootName: string, rootColor: string) {
    map[rootName] = rootColor;
    node.children.forEach((child) => traverse(child, rootName, rootColor));
  }
  tags.forEach((root) => traverse(root, root.name, root.color));
  return map;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  status: "pending" | "cleared" | "duplicated";
  tags?: string[];
  account_id: string;
}

interface TagBreakdownProps {
  transactions: Transaction[];
  tags: TagNode[];
}

export const TagBreakdown = ({ transactions, tags }: TagBreakdownProps) => {
  const tagIdToRootName = buildTagIdToRootNameMap(tags);
  const rootNameToColor = buildRootNameToColorMap(tags);
  // Filter for expense transactions only (excluding transfers)
  const expenseTransactions = transactions.filter(
    (t) => t.type === "expense" && t.status === "cleared" && t.amount < 0
  );

  // Calculate spending by root tag name
  const tagSpending = expenseTransactions.reduce((acc, transaction) => {
    const amount = Math.abs(transaction.amount);
    if (!transaction.tags || transaction.tags.length === 0) {
      acc["Uncategorized"] = (acc["Uncategorized"] || 0) + amount;
    } else {
      // For each tag, map to its root name
      const rootNames = Array.from(new Set(transaction.tags.map((tagId) => tagIdToRootName[tagId] || "Uncategorized")));
      rootNames.forEach((rootName) => {
        acc[rootName] = (acc[rootName] || 0) + amount;
      });
    }
    return acc;
  }, {} as Record<string, number>);

  // Convert to chart data and sort by amount
  const chartData = Object.entries(tagSpending)
    .map(([name, amount]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value: amount,
      percentage: 0, // Will be calculated below
      color: rootNameToColor[name] || "#8884d8",
    }))
    .sort((a, b) => b.value - a.value);

  // Calculate percentages
  const totalSpending = chartData.reduce((sum, item) => sum + item.value, 0);
  chartData.forEach((item) => {
    item.percentage = totalSpending > 0 ? (item.value / totalSpending) * 100 : 0;
  });

  // Helper to determine the most common currency from transactions (fallback to PLN)
  const getDisplayCurrency = () => {
    if (!transactions.length) return "PLN";
    const counts: Record<string, number> = {};
    for (const t of transactions) {
      // Try to get currency from account if available, fallback to PLN
      // If you have access to accounts, you could map account_id to currency
      // For now, assume all transactions are in the same currency or use PLN
      counts["PLN"] = (counts["PLN"] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };
  const displayCurrency = getDisplayCurrency();

  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-expense">{formatCurrency(data.value, displayCurrency)}</p>
          <p className="text-muted-foreground text-sm">{data.percentage.toFixed(1)}% of total spending</p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Spending by Tags
          </CardTitle>
          <CardDescription>Breakdown of your expenses by category tags</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">No expense data available for tag breakdown</div>
        </CardContent>
      </Card>
    );
  }

  // Default color for Uncategorized
  const DEFAULT_UNCATEGORIZED_COLOR = "#e5e7eb"; // Tailwind gray-200

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pie Chart */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Spending by Tags
          </CardTitle>
          <CardDescription>Distribution of expenses by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {chartData.slice(0, 6).map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {item.percentage.toFixed(1)}% (
                  <span className="font-bold">{formatCurrency(item.value, displayCurrency)}</span>)
                </div>
              </div>
            ))}
            {chartData.length > 6 && (
              <div className="text-xs text-muted-foreground pt-2">+{chartData.length - 6} more categories</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart */}
      <Card className="bg-gradient-card shadow-card">
        <CardHeader>
          <CardTitle>Top Spending Categories</CardTitle>
          <CardDescription>Highest expense categories this period</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No category data available for this period.
            </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 40, right: 20, top: 10, bottom: 10 }}
                >
                  <XAxis type="number" hide domain={[0, "dataMax"]} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 14 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, displayCurrency)}
                    labelFormatter={(name: string) => name}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                    {chartData.slice(0, 8).map((entry) => (
                      <Cell
                        key={`cell-${entry.name}`}
                        fill={rootNameToColor[entry.name] || DEFAULT_UNCATEGORIZED_COLOR}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Legend for bar chart as a vertical list */}
          {chartData.length > 0 && (
            <ul className="mt-4 space-y-2">
              {chartData.slice(0, 8).map((entry) => (
                <li key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: rootNameToColor[entry.name] || DEFAULT_UNCATEGORIZED_COLOR }}
                    />
                    <span className="font-medium">{entry.name}</span>
                  </div>
                  <span className="font-bold">{formatCurrency(entry.value, displayCurrency)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
