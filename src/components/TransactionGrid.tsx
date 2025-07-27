import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowLeftRight,
  Clock,
  CheckCircle,
  Tags,
  X,
  Trash2,
  ChevronsUpDown,
} from "lucide-react";
import { useTags } from "@/hooks/useTags";
import type { TagNode } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  status: "pending" | "cleared" | "duplicated";
  tags?: string[];
  account_id: string;
  from_account_id?: string;
  to_account_id?: string;
  transfer_direction?: "outgoing" | "incoming";
}

interface Account {
  id: string;
  name: string;
  type: "bank" | "credit" | "savings" | "investment";
  balance: number;
  currency: string;
}

interface TransactionGridProps {
  transactions: Transaction[];
  accounts: Account[];
  onUpdateTransaction: (id: string, updates: Partial<Transaction>) => void;
  onBulkUpdateTransactions: (ids: string[], updates: Partial<Transaction>) => void;
  onDeleteTransaction?: (id: string) => void;
  onBulkDeleteTransactions?: (ids: string[]) => void;
  selectedAccountId?: string | null;
  getCurrencySymbol: (currency: string) => string;
  selectedTagFilter?: string | null;
  tags?: TagNode[];
}

export const TransactionGrid = ({
  transactions,
  accounts,
  onUpdateTransaction,
  onBulkUpdateTransactions,
  onDeleteTransaction,
  onBulkDeleteTransactions,
  selectedAccountId,
  getCurrencySymbol,
  selectedTagFilter,
  tags: tagsProp,
}: TransactionGridProps) => {
  const { tags: hookTags } = useTags();
  const tags = tagsProp || hookTags;
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [bulkField, setBulkField] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [editFormData, setEditFormData] = useState<Partial<Transaction>>({});
  const [newTag, setNewTag] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [tagSearchOpen, setTagSearchOpen] = useState(false);
  const [tagSearchValue, setTagSearchValue] = useState("");
  const [bulkTagSearchOpen, setBulkTagSearchOpen] = useState(false);
  const [bulkTagSearchValue, setBulkTagSearchValue] = useState("");

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

  // Helper to get account currency by account_id
  const getAccountCurrency = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account ? account.currency : "PLN";
  };

  // Helper to get tag name by ID
  const getTagNameById = (tagId: string) => {
    const allTags = getAllTags(tags);
    const tag = allTags.find((t) => t.id === tagId);
    return tag ? tag.name : tagId;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "income":
        return <ArrowUpCircle className="h-4 w-4 text-success" />;
      case "expense":
        return <ArrowDownCircle className="h-4 w-4 text-expense" />;
      case "transfer":
        return <ArrowLeftRight className="h-4 w-4 text-transfer" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "pending") {
      return (
        <Badge variant="secondary" className="bg-warning-light text-warning-foreground">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }
    if (status === "duplicated") {
      return (
        <Badge variant="secondary" className="bg-destructive-light text-destructive">
          <X className="h-3 w-3 mr-1" />
          Duplicated
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-success-light text-success">
        <CheckCircle className="h-3 w-3 mr-1" />
        Cleared
      </Badge>
    );
  };

  const getAmountColor = (amount: number, type: string) => {
    if (type === "income") return "text-success font-semibold";
    if (type === "expense") return "text-expense font-semibold";
    return "text-foreground font-semibold";
  };

  const toggleSelectTransaction = (id: string) => {
    setSelectedTransactions((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const selectAllTransactions = () => {
    if (selectedTransactions.length === transactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(transactions.map((t) => t.id));
    }
  };

  const handleBulkUpdate = () => {
    if (bulkField && bulkValue && selectedTransactions.length > 0) {
      const updates: Partial<Transaction> = {};

      if (bulkField === "status") {
        updates.status = bulkValue as "pending" | "cleared" | "duplicated";
      } else if (bulkField === "type") {
        updates.type = bulkValue as "income" | "expense" | "transfer";
      } else if (bulkField === "addTag") {
        // Special case for adding tags - handled differently
        selectedTransactions.forEach((id) => {
          const transaction = transactions.find((t) => t.id === id);
          if (transaction && !transaction.tags?.includes(bulkValue)) {
            onUpdateTransaction(id, {
              tags: [...(transaction.tags || []), bulkValue],
            });
          }
        });
        setSelectedTransactions([]);
        setBulkField("");
        setBulkValue("");
        return;
      }

      onBulkUpdateTransactions(selectedTransactions, updates);
      setSelectedTransactions([]);
      setBulkField("");
      setBulkValue("");
    }
  };

  const startEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction.id);
    setEditFormData({ ...transaction, tags: [...(transaction.tags || [])] }); // clone tags array
  };

  const saveEdit = () => {
    if (editingTransaction && editFormData) {
      // Find the original transaction to compare changes
      const originalTransaction = transactions.find((t) => t.id === editingTransaction);
      if (!originalTransaction) return;

      // Create updates object with only changed fields
      const updates: Partial<Transaction> = {};

      if (editFormData.description !== originalTransaction.description) {
        updates.description = editFormData.description;
      }
      if (editFormData.amount !== originalTransaction.amount) {
        updates.amount = editFormData.amount;
      }
      if (editFormData.type !== originalTransaction.type) {
        updates.type = editFormData.type;
      }
      if (editFormData.status !== originalTransaction.status) {
        updates.status = editFormData.status;
      }
      if (JSON.stringify(editFormData.tags) !== JSON.stringify(originalTransaction.tags)) {
        updates.tags = editFormData.tags;
      }

      // Only update if there are actual changes
      if (Object.keys(updates).length > 0) {
        onUpdateTransaction(editingTransaction, updates);
      }

      setEditingTransaction(null);
      setEditFormData({});
    }
  };

  const addTagToTransaction = (transactionId: string) => {
    if (!newTag.trim()) return;

    const transaction = transactions.find((t) => t.id === transactionId);
    if (transaction && !transaction.tags?.includes(newTag.trim())) {
      onUpdateTransaction(transactionId, {
        tags: [...(transaction.tags || []), newTag.trim()],
      });
    }
    setNewTag("");
  };

  // Tag editing logic (editFormData.tags is string[] of tag IDs)
  // Add selected tag by ID
  const addSelectedTagToEdit = () => {
    if (selectedTag && !editFormData.tags?.includes(selectedTag)) {
      setEditFormData({
        ...editFormData,
        tags: [...(editFormData.tags || []), selectedTag],
      });
      setSelectedTag("");
    }
  };
  // Remove tag by ID
  const removeTagFromEdit = (tagId: string) => {
    setEditFormData({
      ...editFormData,
      tags: (editFormData.tags || []).filter((id) => id !== tagId),
    });
  };
  // Manual tag input: add by name if exists
  const addTagToEditByName = () => {
    const tagName = newTag.trim();
    if (!tagName) return;
    const existing = allTags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
    if (existing && !editFormData.tags?.includes(existing.id)) {
      setEditFormData({
        ...editFormData,
        tags: [...(editFormData.tags || []), existing.id],
      });
    }
    setNewTag("");
  };

  // Helper to get transfer direction for the current account
  const getTransferDirection = (transaction: Transaction): "outgoing" | "incoming" | undefined => {
    if (transaction.type !== "transfer" || !selectedAccountId) return undefined;
    if (transaction.from_account_id === selectedAccountId) return "outgoing";
    if (transaction.to_account_id === selectedAccountId) return "incoming";
    return undefined;
  };

  // Helper to get transfer destination/source account name
  const getTransferAccountInfo = (transaction: Transaction) => {
    if (transaction.type !== "transfer") return null;

    const direction = getTransferDirection(transaction);

    if (direction === "outgoing" && transaction.to_account_id) {
      const toAccount = accounts.find((a) => a.id === transaction.to_account_id);
      return { direction: "to", accountName: toAccount?.name || "Unknown Account" };
    } else if (direction === "incoming" && transaction.from_account_id) {
      const fromAccount = accounts.find((a) => a.id === transaction.from_account_id);
      return { direction: "from", accountName: fromAccount?.name || "Unknown Account" };
    } else if (!selectedAccountId) {
      // When no specific account is selected, show both directions
      const fromAccount = accounts.find((a) => a.id === transaction.from_account_id);
      const toAccount = accounts.find((a) => a.id === transaction.to_account_id);
      return {
        direction: "both",
        fromAccountName: fromAccount?.name || "Unknown Account",
        toAccountName: toAccount?.name || "Unknown Account",
      };
    }

    return null;
  };

  // Remove all console.log and useEffect debug statements for tag search

  const filteredTags = allTags.filter((tag) => tag.name.toLowerCase().includes(tagSearchValue.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Enhanced Bulk Actions */}
      {selectedTransactions.length > 0 && (
        <div className="glass-panel p-4 rounded-xl border animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-primary">
              {selectedTransactions.length} transactions selected
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedTransactions([])} className="h-6 w-6 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center space-x-3 flex-wrap gap-2">
            <Select value={bulkField} onValueChange={setBulkField}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="type">Type</SelectItem>
                <SelectItem value="addTag">Add Tag</SelectItem>
              </SelectContent>
            </Select>

            {bulkField && bulkField !== "addTag" && (
              <Select value={bulkValue} onValueChange={setBulkValue}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  {bulkField === "status" && (
                    <>
                      <SelectItem value="cleared">Cleared</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="duplicated">Duplicated</SelectItem>
                    </>
                  )}
                  {bulkField === "type" && (
                    <>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            )}

            {bulkField === "addTag" && (
              <Popover open={bulkTagSearchOpen} onOpenChange={setBulkTagSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={bulkTagSearchOpen}
                    className="w-[140px] justify-between"
                  >
                    {bulkValue ? getTagById(bulkValue)?.name || "Select tag..." : "Search tags..."}
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search tags..."
                      value={bulkTagSearchValue}
                      onValueChange={setBulkTagSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>No tag found.</CommandEmpty>
                      <CommandGroup>
                        {allTags.length > 0
                          ? allTags
                              .filter((tag) => tag.name.toLowerCase().includes(bulkTagSearchValue.trim().toLowerCase()))
                              .map((tag) => (
                                <CommandItem
                                  key={tag.id}
                                  value={tag.name}
                                  onSelect={() => {
                                    setBulkValue(tag.id);
                                    setBulkTagSearchOpen(false);
                                    setBulkTagSearchValue("");
                                  }}
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: tag.color || "#6b7280" }}
                                    />
                                    <span className="flex-1">{tag.name}</span>
                                  </div>
                                </CommandItem>
                              ))
                          : null}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}

            <Button size="sm" onClick={handleBulkUpdate} disabled={!bulkField || !bulkValue} className="btn-gradient">
              Update
            </Button>
            {onBulkDeleteTransactions && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onBulkDeleteTransactions(selectedTransactions)}
                className="hover:shadow-medium transition-all"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Transaction Table */}
      <div className="rounded-xl border overflow-hidden shadow-soft">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/40 transition-colors">
              <TableHead className="w-12 font-semibold">
                <Checkbox
                  checked={selectedTransactions.length === transactions.length}
                  onCheckedChange={selectAllTransactions}
                  className="rounded-md"
                />
              </TableHead>
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Description</TableHead>
              <TableHead className="font-semibold">Amount</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Tags</TableHead>
              <TableHead className="font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Tags className="h-8 w-8" />
                    {selectedTagFilter ? (
                      <>
                        <p className="font-medium">No transactions found for this tag</p>
                        <p className="text-sm">Try selecting a different tag or time period</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">No transactions found</p>
                        <p className="text-sm">Add some transactions to get started</p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction, index) => (
                <TableRow
                  key={transaction.id}
                  className={`hover:bg-accent/20 transition-colors animate-fade-in ${
                    selectedTransactions.includes(transaction.id) ? "bg-accent/10 border-l-4 border-l-primary" : ""
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <TableCell className="py-4">
                    <Checkbox
                      checked={selectedTransactions.includes(transaction.id)}
                      onCheckedChange={() => toggleSelectTransaction(transaction.id)}
                      className="rounded-md"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm py-4">
                    <div className="flex items-center space-x-2">
                      <span>{new Date(transaction.date).toLocaleDateString()}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingTransaction === transaction.id ? (
                      <Input
                        value={editFormData.description || ""}
                        onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                        className="w-full"
                      />
                    ) : (
                      <span className="font-medium">{transaction.description}</span>
                    )}
                  </TableCell>
                  <TableCell className={getAmountColor(transaction.amount, transaction.type)}>
                    {editingTransaction === transaction.id ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={Math.abs(editFormData.amount || 0)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          const amount = editFormData.type === "expense" ? -Math.abs(value) : Math.abs(value);
                          setEditFormData({ ...editFormData, amount });
                        }}
                        className="w-24"
                      />
                    ) : (
                      <>
                        {transaction.type === "expense" ? "-" : ""}
                        {formatCurrency(transaction.amount, getAccountCurrency(transaction.account_id))}
                        {transaction.type === "transfer" &&
                          (() => {
                            const transferInfo = getTransferAccountInfo(transaction);
                            const direction = getTransferDirection(transaction);

                            if (transferInfo?.direction === "both") {
                              return (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  <div className="flex items-center">
                                    <ArrowLeftRight className="h-3 w-3 mr-1" />
                                    {transferInfo.fromAccountName} → {transferInfo.toAccountName}
                                  </div>
                                </div>
                              );
                            } else if (direction === "outgoing" && transferInfo) {
                              return (
                                <div className="mt-1 text-xs text-expense flex items-center">
                                  <ArrowLeftRight className="h-3 w-3 mr-1 rotate-180" />
                                  To: {transferInfo.accountName}
                                </div>
                              );
                            } else if (direction === "incoming" && transferInfo) {
                              return (
                                <div className="mt-1 text-xs text-success flex items-center">
                                  <ArrowLeftRight className="h-3 w-3 mr-1" />
                                  From: {transferInfo.accountName}
                                </div>
                              );
                            }
                            return null;
                          })()}
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingTransaction === transaction.id ? (
                      <Select
                        value={editFormData.type}
                        onValueChange={(value: "income" | "expense" | "transfer") => {
                          const currentAmount = Math.abs(editFormData.amount || 0);
                          const amount = value === "expense" ? -currentAmount : currentAmount;
                          setEditFormData({ ...editFormData, type: value, amount });
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                          <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(transaction.type)}
                        <span className="capitalize text-sm">{transaction.type}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingTransaction === transaction.id ? (
                      <Select
                        value={editFormData.status}
                        onValueChange={(value: "pending" | "cleared" | "duplicated") =>
                          setEditFormData({ ...editFormData, status: value })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cleared">Cleared</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="duplicated">Duplicated</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      getStatusBadge(transaction.status)
                    )}
                  </TableCell>
                  <TableCell>
                    {editingTransaction === transaction.id ? (
                      <div className="space-y-2 min-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {editFormData.tags?.map((tagId) => {
                            const tag = getTagById(tagId);
                            return (
                              <Badge
                                key={tagId}
                                variant="secondary"
                                className="text-xs"
                                style={tag?.color ? { backgroundColor: tag.color, color: "#fff" } : {}}
                              >
                                {tag ? tag.name : tagId}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 ml-1"
                                  onClick={() => removeTagFromEdit(tagId)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            );
                          })}
                        </div>
                        <div className="space-y-1">
                          {/* Searchable Tag Selection */}
                          <div className="flex gap-1">
                            <Popover open={tagSearchOpen} onOpenChange={setTagSearchOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={tagSearchOpen}
                                  className="text-xs h-7 flex-1 justify-between"
                                >
                                  {selectedTag ? getTagById(selectedTag)?.name || "Select tag..." : "Search tags..."}
                                  <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[200px] p-0" align="start">
                                <Command>
                                  <CommandInput
                                    placeholder="Search tags..."
                                    value={tagSearchValue}
                                    onValueChange={setTagSearchValue}
                                  />
                                  <CommandList>
                                    <CommandEmpty>No tag found.</CommandEmpty>
                                    <CommandGroup>
                                      {allTags.length > 0
                                        ? allTags
                                            .filter((tag) =>
                                              tag.name.toLowerCase().includes(tagSearchValue.trim().toLowerCase())
                                            )
                                            .map((tag) => (
                                              <CommandItem
                                                key={tag.id}
                                                value={tag.name}
                                                onSelect={(value) => {
                                                  const tag = allTags.find((t) => t.name === value);
                                                  if (tag) {
                                                    setSelectedTag(tag.id);
                                                  }
                                                  setTagSearchOpen(false);
                                                  setTagSearchValue("");
                                                }}
                                              >
                                                <div className="flex items-center gap-2 w-full">
                                                  <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: tag.color || "#6b7280" }}
                                                  />
                                                  <span className="flex-1">{tag.name}</span>
                                                </div>
                                              </CommandItem>
                                            ))
                                        : null}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={addSelectedTagToEdit}
                              disabled={!selectedTag}
                              className="h-7 px-2"
                            >
                              <Tags className="h-3 w-3" />
                            </Button>
                          </div>
                          {/* Manual Tag Input */}
                          <div className="flex gap-1">
                            <Input
                              placeholder="Or type new tag"
                              value={newTag}
                              onChange={(e) => setNewTag(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === "Enter") {
                                  addTagToEditByName();
                                }
                              }}
                              className="text-xs h-7"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={addTagToEditByName}
                              className="h-7 px-2"
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {transaction.tags?.map((tagId) => {
                          const tag = getTagById(tagId);
                          return (
                            <Badge
                              key={tagId}
                              variant="outline"
                              className="text-xs"
                              style={tag?.color ? { backgroundColor: tag.color, color: "#fff" } : {}}
                            >
                              {tag ? tag.name : tagId}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingTransaction === transaction.id ? (
                      <div className="flex space-x-2">
                        <Button size="sm" onClick={saveEdit}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTransaction(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(transaction)}>
                          Edit
                        </Button>
                        {onDeleteTransaction && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onDeleteTransaction(transaction.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
