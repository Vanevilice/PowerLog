// This file is no longer directly used by the new PowerLogForm in the same way.
// It was designed for the old side-by-side sea/rail form sections.
// You can delete this file or keep it for reference.
// For the purpose of this operation, we are assuming it's not directly used by the new UI.
// To avoid errors if it's imported elsewhere unexpectedly, I'll provide its original content.

"use client";

import type { Control } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { CalculationFormValues } from "@/lib/schemas"; // This now also exports PowerLogFormValues
import type { ContainerType } from "@/types";

interface FreightModeFormSectionProps {
  control: Control<CalculationFormValues>; // This was for the old schema
  mode: "seaFreight" | "railFreight";
  title: string;
}

const containerTypes: ContainerType[] = ["20GP", "40GP", "40HC"];

export default function FreightModeFormSection({
  control,
  mode,
  title,
}: FreightModeFormSectionProps) {
  return (
    <div className="space-y-6 p-1">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <FormField
        control={control}
        name={`${mode}.containerType`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Container Type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select container type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {containerTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`${mode}.cargoWeight`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Cargo Weight (kg)</FormLabel>
            <FormControl>
              <Input type="number" placeholder="e.g., 10000" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`${mode}.origin`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Origin Port/Station</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Shanghai Port or Chengdu Station" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`${mode}.destination`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Destination Port/Station</FormLabel>
            <FormControl>
              <Input placeholder="e.g., Rotterdam Port or Duisburg Station" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="space-y-2">
        <FormField
          control={control}
          name={`${mode}.insurance`}
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Include Insurance</FormLabel>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${mode}.customsClearance`}
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Include Customs Clearance</FormLabel>
              </div>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
