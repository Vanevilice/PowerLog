"use client";

import type { CalculationResults, CalculationResultItem, CostBreakdown } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Info } from "lucide-react";

interface ResultsDisplayProps {
  results: CalculationResults;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

function CostBreakdownTable({ breakdown, currency }: { breakdown: CostBreakdown, currency: string }) {
  const items = [
    { label: "Base Freight", value: breakdown.baseFreight },
    { label: "Terminal Handling Charges (THC)", value: breakdown.thc },
    { label: "Insurance Cost", value: breakdown.insuranceCost },
    { label: "Customs Cost", value: breakdown.customsCost },
    { label: "Other Charges", value: breakdown.otherCharges },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cost Component</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) =>
          item.value !== undefined && item.value !== null ? (
            <TableRow key={index}>
              <TableCell>{item.label}</TableCell>
              <TableCell className="text-right">
                {formatCurrency(item.value, currency)}
              </TableCell>
            </TableRow>
          ) : null
        )}
        <TableRow className="font-semibold bg-muted/50">
          <TableCell>Total Cost</TableCell>
          <TableCell className="text-right text-lg">
            {formatCurrency(breakdown.totalCost, currency)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}


function ResultItemCard({ item, isRecommended }: { item: CalculationResultItem, isRecommended?: boolean }) {
  return (
    <Card className={`flex-1 ${isRecommended ? 'border-accent ring-2 ring-accent shadow-accent/30 shadow-lg' : 'shadow-md'}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {item.mode}
          {isRecommended && <Badge variant="default" className="bg-accent text-accent-foreground"><CheckCircle className="mr-1 h-4 w-4" /> Recommended</Badge>}
        </CardTitle>
        {item.transitTime && <CardDescription>Estimated Transit Time: {item.transitTime}</CardDescription>}
      </CardHeader>
      <CardContent>
        <CostBreakdownTable breakdown={item.costBreakdown} currency={item.currency} />
      </CardContent>
    </Card>
  );
}


export default function ResultsDisplay({ results }: ResultsDisplayProps) {
  const { seaFreightResult, railFreightResult, recommendedMode, savings } = results;

  return (
    <div className="space-y-6">
      {savings && (
        <Card className="bg-accent/20 border-accent">
          <CardHeader>
            <CardTitle className="text-accent-foreground flex items-center">
              <Info className="mr-2 h-5 w-5 text-accent" /> Cost Saving Opportunity!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-accent-foreground">
              Choosing <strong>{savings.cheaperMode}</strong> could save you approximately{" "}
              <strong className="text-lg">{formatCurrency(savings.amount, savings.currency)}</strong>.
            </p>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col md:flex-row gap-6">
        <ResultItemCard item={seaFreightResult} isRecommended={recommendedMode === "Sea Freight"} />
        <ResultItemCard item={railFreightResult} isRecommended={recommendedMode === "Direct Rail"} />
      </div>
       {!recommendedMode || recommendedMode === "None" && !savings && (
        <p className="text-center text-muted-foreground pt-4">
          Costs are similar or other factors might be more important for your decision.
        </p>
      )}
    </div>
  );
}
