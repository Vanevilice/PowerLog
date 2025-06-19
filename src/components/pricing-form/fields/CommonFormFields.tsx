
import React from 'react';
import { Control, ControllerRenderProps, FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
// RadioGroup and RadioGroupItem are no longer needed here for calculationModeToggle
import { Input } from "@/components/ui/input";
import { UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import type { RouteFormValues, CalculationMode, PricingDataContextType } from '@/types';
import { useLocalization } from '@/contexts/LocalizationContext';

interface CommonFormFieldsProps {
  form: UseFormReturn<RouteFormValues>;
  isParsingSeaRailFile: boolean;
  isParsingDirectRailFile: boolean;
  isParsingSOCDropOffFile: boolean;
  handleSeaRailFileUploadClick: () => void;
  handleDirectRailFileUploadClick: () => void;
  handleSOCDropOffFileUploadClick: () => void;
  seaRailFileInputRef: React.RefObject<HTMLInputElement>;
  directRailFileInputRef: React.RefObject<HTMLInputElement>;
  socDropOffFileInputRef: React.RefObject<HTMLInputElement>;
  onSeaRailFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDirectRailFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSOCDropOffFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  calculationModeContext: CalculationMode;
  setCalculationModeContext: PricingDataContextType['setCalculationMode'];
  exchangeRate: string | null;
}

export const CommonFormFields: React.FC<CommonFormFieldsProps> = ({
  form,
  isParsingSeaRailFile,
  isParsingDirectRailFile,
  isParsingSOCDropOffFile,
  handleSeaRailFileUploadClick,
  handleDirectRailFileUploadClick,
  handleSOCDropOffFileUploadClick,
  seaRailFileInputRef,
  directRailFileInputRef,
  socDropOffFileInputRef,
  onSeaRailFileChange,
  onDirectRailFileChange,
  onSOCDropOffFileChange,
  calculationModeContext,
  setCalculationModeContext,
  exchangeRate,
}) => {
  const { control, setValue } = form; // Added setValue
  const { translate } = useLocalization();

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
          onClick={handleSOCDropOffFileUploadClick}
          className="w-full"
          disabled={isParsingSOCDropOffFile || isParsingSeaRailFile || isParsingDirectRailFile}
        >
          {isParsingSOCDropOffFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          {isParsingSOCDropOffFile ? translate('processingFile') : translate('uploadSOCDropOffExcel')}
        </Button>
        <input
          type="file"
          ref={socDropOffFileInputRef}
          onChange={onSOCDropOffFileChange}
          accept=".xlsx, .xls"
          className="hidden"
          aria-hidden="true"
          disabled={isParsingSOCDropOffFile || isParsingSeaRailFile || isParsingDirectRailFile}
        />
      </div>

      <FormField
        control={control}
        name="calculationModeToggle" // This field in form state is still useful for schema validation
        render={({ field }) => ( // field.onChange will update the form state
          <FormItem className="space-y-3">
            <FormLabel className="text-base font-semibold">{translate('calculationMode')}</FormLabel>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <Button
                type="button"
                variant={calculationModeContext === 'sea_plus_rail' ? 'default' : 'outline'}
                onClick={() => {
                  setCalculationModeContext('sea_plus_rail');
                  field.onChange('sea_plus_rail' as CalculationMode);
                }}
                className="flex-1 sm:flex-none"
              >
                {translate('calculationMode_SeaRail')}
              </Button>
              <Button
                type="button"
                variant={calculationModeContext === 'direct_rail' ? 'default' : 'outline'}
                onClick={() => {
                  setCalculationModeContext('direct_rail');
                  field.onChange('direct_rail' as CalculationMode);
                }}
                className="flex-1 sm:flex-none"
              >
                {translate('calculationMode_DirectRail')}
              </Button>
            </div>
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
