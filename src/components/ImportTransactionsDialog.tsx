import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { useAccounts } from "@/hooks/useAccounts";
import { useTransactions } from "@/hooks/useTransactions";
import { Account } from "@/types/database";

interface ImportTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSVTransaction {
  date: string;
  description: string;
  amount: string;
  [key: string]: string;
}

export const ImportTransactionsDialog = ({ open, onOpenChange }: ImportTransactionsDialogProps) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<CSVTransaction[]>([]);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { accounts } = useAccounts();
  const { bulkImportTransactions } = useTransactions();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    setError("");
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split("\n");

        if (lines.length < 2) {
          setError("CSV file must have at least a header and one data row");
          return;
        }

        // Parse CSV manually to handle the specific format
        const transactions: CSVTransaction[] = [];

        for (let i = 1; i < lines.length; i++) {
          // Skip header
          const line = lines[i].trim();
          if (!line) continue;

          // Split by comma, but handle quoted fields
          const fields = parseCSVLine(line);

          if (fields.length >= 6) {
            // Based on the CSV structure: date,date,description,recipient,account,amount,balance,id
            const transaction: CSVTransaction = {
              date: fields[0],
              description: fields[2] || "",
              amount: fields[5] || "0",
            };
            transactions.push(transaction);
          }
        }

        setPreview(transactions.slice(0, 10)); // Show first 10 for preview
      } catch (error) {
        setError("Failed to parse CSV file");
        console.error("CSV parsing error:", error);
      }
    };
    reader.readAsText(file);
  };

  const parseCSVLine = (line: string): string[] => {
    const fields: string[] = [];
    let currentField = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        fields.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }

    fields.push(currentField.trim());
    return fields;
  };

  const handleImport = async () => {
    if (!file || !selectedAccountId) {
      setError("Please select both a file and an account");
      return;
    }

    setIsImporting(true);
    setError("");

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split("\n");
          const transactions: CSVTransaction[] = [];

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const fields = parseCSVLine(line);

            if (fields.length >= 6) {
              const transaction: CSVTransaction = {
                date: fields[0],
                description: fields[2] || "",
                amount: fields[5] || "0",
              };
              transactions.push(transaction);
            }
          }

          const result = await bulkImportTransactions(transactions, selectedAccountId);
          if (result) {
            onOpenChange(false);
            setFile(null);
            setSelectedAccountId("");
            setPreview([]);
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }
        } catch (error) {
          setError("Failed to import transactions");
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      setError("Failed to read file");
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setSelectedAccountId("");
    setPreview([]);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[700px]">
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
          <DialogDescription>Upload a CSV file to import transactions into your selected account.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label htmlFor="account">Select Account</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account: Account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file">CSV File</Label>
            <div className="flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="file"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Choose File</span>
              </Button>
              {file && (
                <div className="flex items-center space-x-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span>{file.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Preview (first 10 transactions)</Label>
              <div className="max-h-40 w-full overflow-y-auto overflow-x-auto border rounded-md p-2 space-y-1">
                {preview.map((transaction, index) => (
                  <div key={index} className="text-sm flex justify-between font-mono min-w-[600px]">
                    <span className="whitespace-pre">{transaction.description}</span>
                    <span>{transaction.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || !selectedAccountId || isImporting}
            className="flex items-center space-x-2"
          >
            {isImporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Importing...</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                <span>Import Transactions</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
