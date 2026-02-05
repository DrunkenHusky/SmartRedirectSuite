import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface SearchAndReplaceItem {
  search: string;
  replace: string;
  caseSensitive: boolean;
}

interface StaticQueryParamItem {
  key: string;
  value: string;
  skipEncoding?: boolean;
}

export function SearchAndReplaceConfig({
  value,
  onChange,
}: {
  value: SearchAndReplaceItem[];
  onChange: (val: SearchAndReplaceItem[]) => void;
}) {
  const addItem = () => {
    onChange([...value, { search: "", replace: "", caseSensitive: false }]);
  };

  const updateItem = (index: number, updates: Partial<SearchAndReplaceItem>) => {
    const newItems = [...value];
    newItems[index] = { ...newItems[index], ...updates };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = value.filter((_, i) => i !== index);
    onChange(newItems);
  };

  return (
    <div className="space-y-3">
      {value.map((item, index) => (
        <div key={index} className="flex flex-col gap-2 p-3 bg-muted/30 rounded border">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium block">Suchen</label>
              <Input
                value={item.search}
                onChange={(e) => updateItem(index, { search: e.target.value })}
                placeholder="Suche..."
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium block">Ersetzen</label>
              <Input
                value={item.replace}
                onChange={(e) => updateItem(index, { replace: e.target.value })}
                placeholder="Ersetzen mit..."
                className="h-8 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(index)}
              className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`case-${index}`}
              checked={item.caseSensitive}
              onCheckedChange={(checked) => updateItem(index, { caseSensitive: !!checked })}
            />
            <label htmlFor={`case-${index}`} className="text-xs text-muted-foreground cursor-pointer select-none">
              Groß-/Kleinschreibung beachten
            </label>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Regel hinzufügen
      </Button>
    </div>
  );
}

export function StaticQueryParamsConfig({
  value,
  onChange,
}: {
  value: StaticQueryParamItem[];
  onChange: (val: StaticQueryParamItem[]) => void;
}) {
  const addItem = () => {
    onChange([...value, { key: "", value: "", skipEncoding: false }]);
  };

  const updateItem = (index: number, updates: Partial<StaticQueryParamItem>) => {
    const newItems = [...value];
    newItems[index] = { ...newItems[index], ...updates };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = value.filter((_, i) => i !== index);
    onChange(newItems);
  };

  return (
    <div className="space-y-3">
      {value.map((item, index) => (
        <div key={index} className="flex flex-col gap-2 p-3 bg-muted/30 rounded border">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium block">Key</label>
              <Input
                value={item.key}
                onChange={(e) => updateItem(index, { key: e.target.value })}
                placeholder="utm_source"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium block">Value</label>
              <Input
                value={item.value}
                onChange={(e) => updateItem(index, { value: e.target.value })}
                placeholder="google"
                className="h-8 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(index)}
              className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`skip-${index}`}
              checked={item.skipEncoding}
              onCheckedChange={(checked) => updateItem(index, { skipEncoding: !!checked })}
            />
            <label htmlFor={`skip-${index}`} className="text-xs text-muted-foreground cursor-pointer select-none">
              Nicht kodieren (für spezielle Formate wie {Key})
            </label>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Parameter hinzufügen
      </Button>
    </div>
  );
}
