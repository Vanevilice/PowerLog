"use client";

import type { CalculationResults, CalculationResultItem, CostBreakdown } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Info, TrendingUp } from "lucide-react";
import { BarChart, CartesianGrid, XAxis, YAxis, Bar, Cell as RechartsCell } from 'recharts'; // Renamed Cell to avoid conflict
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from '@/components/ui/chart';

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
  const { seaFreightResult, railFreightResult, recommendedMode, savings, currency = "USD" } = results;

  const chartData = [
    { mode: "Sea Freight", totalCost: seaFreightResult.costBreakdown.totalCost, fill: "hsl(var(--chart-1))" },
    { mode: "Direct Rail", totalCost: railFreightResult.costBreakdown.totalCost, fill: "hsl(var(--chart-2))" },
  ];

  const chartConfig = {
    totalCost: {
      label: `Total Cost (${currency})`,
    },
    // Keys for legend items, matching dataKey in legendPayloadForChart
    seaFreight: {
      label: "Sea Freight",
      color: "hsl(var(--chart-1))",
    },
    directRail: {
      label: "Direct Rail",
      color: "hsl(var(--chart-2))",
    }
  } satisfies ChartConfig;
  
  const legendPayloadForChart = [
    { value: 'Sea Freight', type: 'square', id: 'sea', color: chartData[0].fill, dataKey: 'seaFreight' },
    { value: 'Direct Rail', type: 'square', id: 'rail', color: chartData[1].fill, dataKey: 'directRail' },
  ];


  return (
    <div className="space-y-8">
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

      <Card className="shadow-xl border-border overflow-hidden rounded-xl bg-card">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-6 w-6 text-primary" />
            Cost Comparison Chart
          </CardTitle>
          <CardDescription>Visual comparison of total logistics costs.</CardDescription>
        </CardHeader>
        <CardContent className="pl-2 pr-6 pb-6">
          <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
            <BarChart 
              accessibilityLayer 
              data={chartData} 
              margin={{ top: 5, right: 0, left: 0, bottom: 5 }}
              barGap={8}
              barSize={60}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="mode"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value, currency)}
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                width={80}
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <ChartLegend content={<ChartLegendContent payload={legendPayloadForChart} />} />
              <Bar dataKey="totalCost" radius={5}>
                {chartData.map((entry, index) => (
                  <RechartsCell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
      
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
