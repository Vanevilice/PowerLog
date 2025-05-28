
import React from 'react';
import { Control, ControllerRenderProps, FieldValues, UseFormReturn } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import type { RouteFormValues, CalculationMode, PricingDataContextType } from '@/types';

interface CommonFormFieldsProps {
  form: UseFormReturn<RouteFormValues>;
  isParsingSeaRailFile: boolean;
  isParsingDirectRailFile: boolean;
  handleSeaRailFileUploadClick: () => void;
  handleDirectRailFileUploadClick: () => void;
  seaRailFileInputRef: React.RefObject<HTMLInputElement>;
  directRailFileInputRef: React.RefObject<HTMLInputElement>;
  handleSeaRailFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleDirectRailFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  calculationModeContext: CalculationMode; // From context
  setCalculationModeContext: PricingDataContextType['setCalculationMode']; // From context
  exchangeRate: string | null;
}

export const CommonFormFields: React.FC<CommonFormFieldsProps> = ({
  form,
  isParsingSeaRailFile,
  isParsingDirectRailFile,
  handleSeaRailFileUploadClick,
  handleDirectRailFileUploadClick,
  seaRailFileInputRef,
  directRailFileInputRef,
  handleSeaRailFileChange,
  handleDirectRailFileChange,
  calculationModeContext,
  setCalculationModeContext,
  exchangeRate,
}) => {
  const { control, getValues } = form;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleSeaRailFileUploadClick}
          className="w-full"
          disabled={isParsingSeaRailFile || isParsingDirectRailFile}
        >
          {isParsingSeaRailFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          {isParsingSeaRailFile ? "Processing..." : "Море + Ж/Д"}
        </Button>
        <input
          type="file"
          ref={seaRailFileInputRef}
          onChange={handleSeaRailFileChange}
          accept=".xlsx, .xls"
          className="hidden"
          aria-hidden="true"
          disabled={isParsingSeaRailFile}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleDirectRailFileUploadClick}
          className="w-full"
          disabled={isParsingDirectRailFile || isParsingSeaRailFile}
        >
          {isParsingDirectRailFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          {isParsingDirectRailFile ? "Processing..." : "Прямое ЖД"}
        </Button>
        <input
          type="file"
          ref={directRailFileInputRef}
          onChange={handleDirectRailFileChange}
          accept=".xlsx, .xls"
          className="hidden"
          aria-hidden="true"
          disabled={isParsingDirectRailFile}
        />
      </div>

      <FormField
        control={control}
        // Name is arbitrary here as value/onChange are controlled by context calculationMode
        name="calculationModeToggle"
        render={({ field }) => ( // field is not directly used for value/onChange
          <FormItem className="space-y-3">
            <FormLabel className="text-base font-semibold">Calculation Mode</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={(value: string) => {
                  setCalculationModeContext(value as CalculationMode);
                }}
                value={calculationModeContext} // Use context value
                className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
              >
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="sea_plus_rail" id="mode_sea_plus_rail" />
                  </FormControl>
                  <FormLabel htmlFor="mode_sea_plus_rail" className="font-normal">Море + ЖД</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="direct_rail" id="mode_direct_rail" />
                  </FormControl>
                  <FormLabel htmlFor="mode_direct_rail" className="font-normal">Прямое ЖД</FormLabel>
                </FormItem>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 items-start">
        {exchangeRate && (
          <div className="text-sm text-muted-foreground p-3 bg-secondary/30 rounded-md border border-dashed flex items-center h-10 md:col-span-1">
            <AlertCircle className="mr-2 h-4 w-4 text-primary" /> {exchangeRate}
          </div>
        )}
        {calculationModeContext === "sea_plus_rail" && (
          <div className="space-y-2 md:col-span-1">
            <FormField
              control={control}
              name="seaMargin"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input type="number" placeholder="Sea margin" {...field} className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="railMargin"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input type="number" placeholder="Rail margin" {...field} className="h-10" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </>
  );
};
