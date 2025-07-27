import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Tag } from "lucide-react";
import { useTags } from "@/hooks/useTags";
import type { TagNode } from "@/types/database";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  status: "pending" | "cleared" | "duplicated";
  tags?: string[];
  account_id?: string;
  from_account_id?: string;
  to_account_id?: string;
}

interface Account {
  id: string;
  name: string;
  type: "bank" | "credit" | "savings" | "investment";
  balance: number;
  currency: string;
}

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddTransaction: (transaction: Omit<Transaction, "id" | "created_at" | "updated_at">) => void;
  accounts: Account[];
  defaultAccountId?: string;
}

export const AddTransactionDialog = ({
  open,
  onOpenChange,
  onAddTransaction,
  accounts,
  defaultAccountId,
}: AddTransactionDialogProps) => {
  const { tags } = useTags();
  const [formData, setFormData] = useState({
    date: new Date().toISOString(),
    description: "",
    amount: "",
    type: "expense" as "income" | "expense" | "transfer",
    status: "cleared" as "pending" | "cleared" | "duplicated",
    account_id: defaultAccountId || accounts[0]?.id || "",
    from_account_id: "",
    to_account_id: "",
    tags: [] as string[], // tag IDs
    newTag: "",
    selectedTag: "",
  });

  // Flatten all tags for the dropdown
  const getAllTags = (tagList: TagNode[]): TagNode[] => {
    const result: TagNode[] = [];
    for (const tag of tagList) {
      result.push(tag);
      result.push(...getAllTags(tag.children));
    }
    return result;
  };

  const allTags = getAllTags(tags);

  // Helper to get tag object by ID
  const getTagById = (id: string) => allTags.find((t) => t.id === id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim() || !formData.amount.trim()) {
      return;
    }
    const amount = parseFloat(formData.amount);
    if (isNaN(amount)) {
      return;
    }
    const transactionData: Omit<Transaction, "id" | "created_at" | "updated_at"> = {
      date: formData.date,
      description: formData.description.trim(),
      amount: formData.type === "expense" ? -Math.abs(amount) : Math.abs(amount),
      type: formData.type,
      status: formData.status,
      tags: formData.tags, // tag IDs
      account_id: formData.account_id,
    };
    if (formData.type === "transfer") {
      transactionData.from_account_id = formData.from_account_id;
      transactionData.to_account_id = formData.to_account_id;
    }
    onAddTransaction(transactionData);
    setFormData({
      date: new Date().toISOString(),
      description: "",
      amount: "",
      type: "expense",
      status: "cleared",
      account_id: defaultAccountId || accounts[0]?.id || "",
      from_account_id: "",
      to_account_id: "",
      tags: [],
      newTag: "",
      selectedTag: "",
    });
    onOpenChange(false);
  };

  // Add selected tag by ID
  const addSelectedTag = () => {
    if (formData.selectedTag && !formData.tags.includes(formData.selectedTag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, formData.selectedTag],
        selectedTag: "",
      }));
    }
  };

  // Remove tag by ID
  const removeTag = (tagId: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((id) => id !== tagId),
    }));
  };

  // Manual tag input: create new tag (for now, just add as text, but ideally should create in DB and get ID)
  const addTag = () => {
    const tagName = formData.newTag.trim();
    if (!tagName) return;
    // Try to find existing tag by name
    const existing = allTags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
    if (existing && !formData.tags.includes(existing.id)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, existing.id],
        newTag: "",
      }));
    }
    // If not found, you may want to create a new tag in DB and then add its ID
    // For now, just clear input
    setFormData((prev) => ({ ...prev, newTag: "" }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>Add a new transaction to your account.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="datetime-local"
                value={formData.date.slice(0, 16)}
                onChange={(e) => setFormData((prev) => ({ ...prev, date: new Date(e.target.value).toISOString() }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Enter transaction description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "income" | "expense" | "transfer") =>
                  setFormData((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "pending" | "cleared" | "duplicated") =>
                  setFormData((prev) => ({ ...prev, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cleared">Cleared</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="duplicated">Duplicated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Account Selection - Different for transfers */}
          {formData.type === "transfer" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromAccount">From Account</Label>
                <Select
                  value={formData.from_account_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, from_account_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="toAccount">To Account</Label>
                <Select
                  value={formData.to_account_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, to_account_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="account">Account</Label>
              <Select
                value={formData.account_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, account_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="space-y-2">
              {/* Tag Selection Dropdown */}
              <div className="flex gap-2">
                <Select
                  value={formData.selectedTag}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, selectedTag: value }))}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select existing tag" />
                  </SelectTrigger>
                  <SelectContent>
                    {allTags.map((tag) => {
                      const colorMap: { [key: string]: string } = {
                        blue: "bg-primary",
                        green: "bg-success",
                        red: "bg-expense",
                        orange: "bg-warning",
                        purple: "bg-primary",
                        teal: "bg-success",
                      };
                      return (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${colorMap[tag.color] || "bg-primary"}`} />
                            {tag.name}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={addSelectedTag} variant="outline" size="sm">
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              {/* Manual Tag Input */}
              <div className="flex gap-2">
                <Input
                  id="tags"
                  placeholder="Or type new tag and press Enter"
                  value={formData.newTag}
                  onChange={(e) => setFormData((prev) => ({ ...prev, newTag: e.target.value }))}
                  onKeyPress={handleKeyPress}
                />
                <Button type="button" onClick={addTag} variant="outline" size="sm">
                  Add
                </Button>
              </div>
            </div>
            {/* Display selected tags by ID, showing name/color */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tagId) => {
                  const tag = getTagById(tagId);
                  const colorMap: { [key: string]: string } = {
                    blue: "bg-primary",
                    green: "bg-success",
                    red: "bg-expense",
                    orange: "bg-warning",
                    purple: "bg-primary",
                    teal: "bg-success",
                  };
                  return (
                    <Badge
                      key={tagId}
                      variant="secondary"
                      className={`text-xs ${colorMap[tag?.color || ""] || "bg-primary"}`}
                    >
                      {tag ? tag.name : tagId}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 ml-1"
                        onClick={() => removeTag(tagId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Transaction</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
