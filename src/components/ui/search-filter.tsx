import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Calendar, ChevronDown, ChevronUp } from "lucide-react";

export interface SearchFilterState {
  query: string;
  dateFrom: string;
  dateTo: string;
}

interface SearchFilterProps {
  value: SearchFilterState;
  onChange: (v: SearchFilterState) => void;
  placeholder?: string;
  className?: string;
}

export const EMPTY_FILTER: SearchFilterState = { query: "", dateFrom: "", dateTo: "" };

export function matchesFilter(
  item: Record<string, any>,
  filter: SearchFilterState,
  dateField: string = "date",
  searchFields: string[] = []
): boolean {
  // Date range
  if (filter.dateFrom && item[dateField] && item[dateField] < filter.dateFrom) return false;
  if (filter.dateTo && item[dateField] && item[dateField] > filter.dateTo) return false;
  // Search query
  if (filter.query.trim()) {
    const q = filter.query.toLowerCase();
    const fieldsToSearch = searchFields.length > 0 ? searchFields : Object.keys(item);
    const match = fieldsToSearch.some(f => {
      const v = item[f];
      if (typeof v === "string") return v.toLowerCase().includes(q);
      if (typeof v === "number") return String(v).includes(q);
      return false;
    });
    if (!match) return false;
  }
  return true;
}

export function SearchFilter({ value, onChange, placeholder = "Search…", className = "" }: SearchFilterProps) {
  const [showDates, setShowDates] = useState(false);
  const hasFilter = value.query || value.dateFrom || value.dateTo;

  const clear = () => onChange(EMPTY_FILTER);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={value.query}
            onChange={e => onChange({ ...value, query: e.target.value })}
            placeholder={placeholder}
            className="pl-9 bg-background border-border h-9 text-sm"
          />
          {value.query && (
            <button onClick={() => onChange({ ...value, query: "" })} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className={`gap-1.5 h-9 shrink-0 ${(value.dateFrom || value.dateTo) ? "border-primary text-primary" : ""}`}
          onClick={() => setShowDates(s => !s)}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-xs hidden sm:inline">Date</span>
          {showDates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
        {hasFilter && (
          <Button variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground hover:text-foreground" onClick={clear}>
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      {showDates && (
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs text-muted-foreground shrink-0">From</span>
            <Input type="date" value={value.dateFrom} onChange={e => onChange({ ...value, dateFrom: e.target.value })} className="bg-background border-border h-8 text-xs flex-1" />
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-xs text-muted-foreground shrink-0">To</span>
            <Input type="date" value={value.dateTo} onChange={e => onChange({ ...value, dateTo: e.target.value })} className="bg-background border-border h-8 text-xs flex-1" />
          </div>
        </div>
      )}
    </div>
  );
}
