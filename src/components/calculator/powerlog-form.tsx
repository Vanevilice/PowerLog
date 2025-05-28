
"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { powerLogFormSchema, type PowerLogFormValues } from "@/lib/schemas"; // Updated schema
import { performCalculation } from "@/actions/calculate"; // Updated action
import type { CalculationResults } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, Home, Anchor, Ship, Box, Weight, MapPin, Train, ListChecks, Search, CalendarDays } from "lucide-react";
import { useState, useEffect } from "react";

interface PowerLogFormProps {
  mode: "sea_rail" | "direct_rail";
  currentDateTime: string | null;
  onCalculateStart: () => void;
  onCalculateSuccess: (results: CalculationResults) => void;
  onCalculateError: (error: string) => void;
}

const defaultValues: PowerLogFormValues = {
  calculationMode: "sea_rail",
  usdRubRate: "90.50", // Example, should be dynamic or from API
  seaMargin: 0,
  railMargin: 0,
  shipmentType: "coc",
  originPort: "",
  destinationPortSea: "",
  seaLineCompany: "",
  containerType: "20GP",
  cargoWeight: 10000,
  destinationCity: "",
  station: "",
};

export default function PowerLogForm({
  mode,
  currentDateTime,
  onCalculateStart,
  onCalculateSuccess,
  onCalculateError,
}: PowerLogFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<PowerLogFormValues>({
    resolver: zodResolver(powerLogFormSchema),
    defaultValues: {
      ...defaultValues,
      calculationMode: mode, // Set initial mode from props
    },
  });

  useEffect(() => {
    form.reset({ ...defaultValues, calculationMode: mode });
  }, [mode, form]);


  async function onSubmit(data: PowerLogFormValues) {
    setIsSubmitting(true);
    onCalculateStart();
    try {
      // Adapt data for performCalculation if its signature is still based on old structure
      // For now, assuming performCalculation is updated or we pass a compatible structure.
      // This is a placeholder for actual data transformation if needed.
      const calculationParamsAdapter = {
        // This is a simplified adaptation. The actual performCalculation
        // will need to be significantly reworked for the new flat schema.
        seaFreight: {
            containerType: data.containerType,
            cargoWeight: data.cargoWeight,
            origin: data.originPort, // Assuming originPort is for sea
            destination: data.destinationPortSea, // Assuming destPortSea for sea
            insurance: true, // Or from form if added
            customsClearance: true, // Or from form if added
        },
        railFreight: { // This part needs more thought based on 'direct_rail' mode
            containerType: data.containerType,
            cargoWeight: data.cargoWeight,
            origin: data.mode === 'direct_rail' ? data.originPort : data.station, // Example logic
            destination: data.mode === 'direct_rail' ? data.destinationCity : data.station, // Example logic
            insurance: true,
            customsClearance: true,
        }
      };
      
      // Use data directly if performCalculation is updated for PowerLogFormValues
      // const response = await performCalculation(data);

      // For now, we'll use the adapter, but this highlights that `performCalculation` needs a proper update.
      // The current `performCalculation` expects distinct seaFreight and railFreight objects.
      // We'll simulate a successful response for UI testing as `performCalculation` rework is complex.
       const response = await performCalculation(calculationParamsAdapter as any);


      if (response.success && response.results) {
        onCalculateSuccess(response.results);
        toast({
          title: "Calculation Successful",
          description: "Results updated.",
        });
      } else {
        let errorMessage = "Calculation failed. Please try again.";
        if (typeof response.error === 'string') {
          errorMessage = response.error;
        } else if (response.error) { 
          errorMessage = "Invalid input. Please check the form fields.";
           Object.values((response.error as any).fieldErrors || {}).forEach((fieldErrors: any) => {
            if (fieldErrors && fieldErrors.length > 0) {
              toast({
                title: "Validation Error",
                description: fieldErrors[0],
                variant: "destructive",
              });
            }
          });
        }
        onCalculateError(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      onCalculateError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const commonFields = (
    <>
      <FormField
        control={form.control}
        name="shipmentType"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel className="flex items-center"><Home className="mr-2 h-5 w-5 text-primary" />Shipment Type</FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                defaultValue={field.value}
                className="flex space-x-4"
              >
                <FormItem className="flex items-center space-x-2">
                  <FormControl><RadioGroupItem value="coc" /></FormControl>
                  <FormLabel className="font-normal">COC</FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-2">
                  <FormControl><RadioGroupItem value="soc" /></FormControl>
                  <FormLabel className="font-normal">SOC</FormLabel>
                </FormItem>
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="containerType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Box className="mr-2 h-5 w-5 text-primary" />Container Type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger><SelectValue placeholder="Upload Море + Ж/Д Excel" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="20GP">20GP</SelectItem>
                <SelectItem value="40GP">40GP</SelectItem>
                <SelectItem value="40HC">40HC</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={form.control}
        name="cargoWeight"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center"><Weight className="mr-2 h-5 w-5 text-primary" />Cargo Weight (kg)</FormLabel>
            <FormControl>
              <Input type="number" placeholder="e.g., 10000" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="calculationMode"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="text-base font-semibold">Calculation Mode</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Potentially trigger tab change here if desired, or ensure tabs drive this
                  }}
                  value={field.value} // Use value here for controlled component
                  className="flex space-x-4"
                >
                  <FormItem className="flex items-center space-x-2">
                    <FormControl><RadioGroupItem value="sea_rail" /></FormControl>
                    <FormLabel className="font-normal">Море + Ж/Д</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2">
                    <FormControl><RadioGroupItem value="direct_rail" /></FormControl>
                    <FormLabel className="font-normal">Прямое ЖД</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {currentDateTime && (
          <Alert className="bg-muted/50">
            <Info className="h-5 w-5 !left-3 !top-3.5 text-primary" />
            <AlertTitle className="ml-2 text-sm text-muted-foreground">USD/RUB as of {currentDateTime}</AlertTitle>
            <AlertDescription className="ml-2 text-sm font-semibold">
              {form.watch("usdRubRate")} {/* Display rate from form state */}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="seaMargin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sea margin</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Enter sea margin" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="railMargin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rail margin</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Enter rail margin" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {commonFields}

        {/* Fields specific to mode or common but with different labels/icons */}
        {/* Using form.watch('calculationMode') to conditionally render fields */}
        
        {form.watch('calculationMode') === 'sea_rail' && (
          <>
            <FormField
              control={form.control}
              name="originPort"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Anchor className="mr-2 h-5 w-5 text-primary" />Origin Port</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Upload Море + Ж/Д Excel" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Shanghai">Shanghai</SelectItem>
                      <SelectItem value="Ningbo">Ningbo</SelectItem>
                      <SelectItem value="Qingdao">Qingdao</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destinationPortSea"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Anchor className="mr-2 h-5 w-5 text-primary" />Destination Port (Sea)</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Upload Море + Ж/Д Excel" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Rotterdam">Rotterdam</SelectItem>
                      <SelectItem value="Hamburg">Hamburg</SelectItem>
                      <SelectItem value="Antwerp">Antwerp</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="seaLineCompany"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><Ship className="mr-2 h-5 w-5 text-primary" />Sea Line Company</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="None (Get General Commentary)" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Maersk">Maersk</SelectItem>
                      <SelectItem value="MSC">MSC</SelectItem>
                      <SelectItem value="CMA CGM">CMA CGM</SelectItem>
                      <SelectItem value="generic">None (Get General Commentary)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
        
        {/* Fields for both modes or rail specific, adjust as per logic for "Прямое ЖД" */}
         <FormField
            control={form.control}
            name="destinationCity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><MapPin className="mr-2 h-5 w-5 text-primary" />Destination City</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Upload Море + Ж/Д Excel" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Moscow">Moscow</SelectItem>
                    <SelectItem value="Berlin">Berlin</SelectItem>
                    <SelectItem value="Warsaw">Warsaw</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="station"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Train className="mr-2 h-5 w-5 text-primary" />Station</FormLabel>
                 <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Upload Море + Ж/Д Excel" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Duisburg">Duisburg</SelectItem>
                    <SelectItem value="Malaszewicze">Malaszewicze</SelectItem>
                    <SelectItem value="Brest">Brest</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          <Button type="button" variant="outline" className="w-full text-base py-6" onClick={() => alert("Get Price & Commentary clicked")}>
            <ListChecks className="mr-2 h-5 w-5" />
            Get Price & Commentary
          </Button>
          <Button type="submit" className="w-full text-base py-6" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                Calculate Best Price
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
