
import React from 'react';
import { Control, ControllerRenderProps, FieldValues, UseFormReturn } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import type { RouteFormValues, CalculationMode, PricingDataContextType } from '@/types'; // Using consolidated types
import { useLocalization } from '@/contexts/LocalizationContext'; // Import useLocalization

interface CommonFormFieldsProps {
  form: UseFormReturn<RouteFormValues>; // Use consolidated RouteFormValues
  isParsingSeaRailFile: boolean;
  isParsingDirectRailFile: boolean;
  isParsingSOCDropOffFile: boolean; // New state for SOC drop-off parsing
  handleSeaRailFileUploadClick: () => void;
  handleDirectRailFileUploadClick: () => void;
  handleSOCDropOffFileUploadClick: () => void; // New handler for SOC drop-off button
  seaRailFileInputRef: React.RefObject<HTMLInputElement>;
  directRailFileInputRef: React.RefObject<HTMLInputElement>;
  socDropOffFileInputRef: React.RefObject<HTMLInputElement>; // New ref for SOC drop-off input
  onSeaRailFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDirectRailFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSOCDropOffFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void; // New change handler
  calculationModeContext: CalculationMode;
  setCalculationModeContext: PricingDataContextType['setCalculationMode'];
  exchangeRate: string | null;
}

export const CommonFormFields: React.FC<CommonFormFieldsProps> = ({
  form,
  isParsingSeaRailFile,
  isParsingDirectRailFile,
  isParsingSOCDropOffFile, // Consuming new state
  handleSeaRailFileUploadClick,
  handleDirectRailFileUploadClick,
  handleSOCDropOffFileUploadClick, // Consuming new handler
  seaRailFileInputRef,
  directRailFileInputRef,
  socDropOffFileInputRef, // Consuming new ref
  onSeaRailFileChange,
  onDirectRailFileChange,
  onSOCDropOffFileChange, // Consuming new change handler
  calculationModeContext,
  setCalculationModeContext,
  exchangeRate,
}) => {
  const { control, getValues, setValue } = form;
  const { translate } = useLocalization(); // Get translate function

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleSeaRailFileUploadClick}
          className="w-full"
          disabled={isParsingSeaRailFile || isParsingDirectRailFile || isParsingSOCDropOffFile}
        >
          {isParsingSeaRailFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          {isParsingSeaRailFile ? translate('processingFile') : translate('uploadSeaRailExcel')}
        </Button>
        <input
          type="file"
          ref={seaRailFileInputRef}
          onChange={onSeaRailFileChange}
          accept=".xlsx, .xls"
          className="hidden"
          aria-hidden="true"
          disabled={isParsingSeaRailFile || isParsingDirectRailFile || isParsingSOCDropOffFile}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleDirectRailFileUploadClick}
          className="w-full"
          disabled={isParsingDirectRailFile || isParsingSeaRailFile || isParsingSOCDropOffFile}
        >
          {isParsingDirectRailFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          {isParsingDirectRailFile ? translate('processingFile') : translate('uploadDirectRailExcel')}
        </Button>
        <input
          type="file"
          ref={directRailFileInputRef}
          onChange={onDirectRailFileChange}
          accept=".xlsx, .xls"
          className="hidden"
          aria-hidden="true"
          disabled={isParsingDirectRailFile || isParsingSeaRailFile || isParsingSOCDropOffFile}
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleSOCDropOffFileUploadClick} // Using new handler
          className="w-full"
          disabled={isParsingSOCDropOffFile || isParsingSeaRailFile || isParsingDirectRailFile} // Disable if any parsing is active
        >
          {isParsingSOCDropOffFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          {isParsingSOCDropOffFile ? translate('processingFile') : translate('uploadSOCDropOffExcel')}
        </Button>
        <input
          type="file"
          ref={socDropOffFileInputRef} // Using new ref
          onChange={onSOCDropOffFileChange} // Using new change handler
          accept=".xlsx, .xls"
          className="hidden"
          aria-hidden="true"
          disabled={isParsingSOCDropOffFile || isParsingSeaRailFile || isParsingDirectRailFile}
        />
      </div>

      <FormField
        control={control}
        name="calculationModeToggle"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel className="text-base font-semibold">{translate('calculationMode')}</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={(value: string) => {
                  const newMode = value as CalculationMode;
                  setCalculationModeContext(newMode);
                }}
                value={calculationModeContext} // Controlled by context
                className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4"
              >
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="sea_plus_rail" id="mode_sea_plus_rail" />
                  </FormControl>
                  <FormLabel htmlFor="mode_sea_plus_rail" className="font-normal">{translate('calculationMode_SeaRail')}</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="direct_rail" id="mode_direct_rail" />
                  </FormControl>
                  <FormLabel htmlFor="mode_direct_rail" className="font-normal">{translate('calculationMode_DirectRail')}</FormLabel>
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
                    <Input type="number" placeholder={translate('seaMargin')} {...field} className="h-10" />
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
                    <Input type="number" placeholder={translate('railMargin')} {...field} className="h-10" />
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

