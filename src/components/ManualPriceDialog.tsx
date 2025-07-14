import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ManualPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: {
    id: string;
    symbol: string;
    name: string;
    amount: number;
    last_price?: string | number;
    last_price_date?: string;
  } | null;
  currency: string;
  onSave: (assetId: string, price: number, date: string) => Promise<void>;
}

export const ManualPriceDialog = ({ open, onOpenChange, asset, currency, onSave }: ManualPriceDialogProps) => {
  const [price, setPrice] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!asset || !price || isNaN(parseFloat(price))) return;

    setIsSubmitting(true);
    try {
      await onSave(asset.id, parseFloat(price), format(date, "yyyy-MM-dd"));
      setPrice("");
      setDate(new Date());
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving manual price:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPrice("");
      setDate(new Date());
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Manual Price</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {asset && (
            <div className="space-y-2">
              <Label>Asset</Label>
              <div className="text-sm font-medium">
                {asset.symbol} - {asset.name}
              </div>
              <div className="text-sm text-muted-foreground">Amount: {asset.amount}</div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="price">Price ({currency})</Label>
            <Input
              id="price"
              type="number"
              step="0.000001"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={!price || isNaN(parseFloat(price)) || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Saving..." : "Save Price"}
            </Button>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
