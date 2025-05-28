
"use client";

import React from 'react';
import Link from 'next/link';
import { usePricingData, type DashboardServiceSection, type DashboardServiceDataRow } from '@/contexts/PricingDataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, UploadCloud, Info, Train, DollarSign, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast'; // Import useToast

export default function DashboardPage() {
  const { dashboardServiceSections, isSeaRailExcelDataLoaded } = usePricingData();
  const { toast } = useToast(); // Initialize toast

  React.useEffect(() => {
    console.log("[DashboardPage] isSeaRailExcelDataLoaded:", isSeaRailExcelDataLoaded);
    console.log("[DashboardPage] dashboardServiceSections:", dashboardServiceSections);
  }, [isSeaRailExcelDataLoaded, dashboardServiceSections]);

  const handleDashboardCopyRate = async (row: DashboardServiceDataRow) => {
    let textToCopy = "";
    const routeParts = row.route.split(' - ');
    const originPart = routeParts[0]?.replace(/^(FOB|FI)\s*/i, '').trim() || 'N/A';
    const primaryDestinationPart = routeParts.length > 1 ? routeParts.slice(1).join(' - ').trim() : 'N/A';

    // Use railwayOriginInfo for the "FOR" part if available, otherwise use the primary destination part
    const forPart = row.railwayOriginInfo && row.railwayOriginInfo !== 'N/A' 
                    ? row.railwayOriginInfo.replace(/^(FOB|FI)\s*/i, '').trim() 
                    : primaryDestinationPart;

    textToCopy += `FOB ${originPart} - Владивосток - FOR ${forPart} :\n`;
    textToCopy += `Фрахт: ${row.rate || 'N/A'}\n`;
    if (row.railwayCost && row.railwayCost !== 'N/A') {
      textToCopy += `Ж/Д Составляющая: ${row.railwayCost}\n`;
    }
    // Add a standard line if not already present (optional, based on requirements)
    // textToCopy += `Прием и вывоз контейнера в режиме ГТД в пределах МКАД: 48 000 руб. с НДС 0%\n`;


    try {
      await navigator.clipboard.writeText(textToCopy.trim());
      toast({ title: "Success!", description: "Rate copied to clipboard." });
    } catch (err) {
      toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy to clipboard." });
    }
  };


  if (!isSeaRailExcelDataLoaded) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Card className="w-full max-w-lg shadow-lg rounded-xl bg-card border border-border">
          <CardHeader>
            <div className="flex justify-center items-center mb-3">
              <AlertTriangle className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-semibold text-primary">Dashboard Data Not Loaded</CardTitle>
            <CardDescription className="text-muted-foreground">
              Please upload the &quot;Море + Ж/Д&quot; Excel file on the Calculator page to view dashboard data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="default" className="w-full">
              <Link href="/">
                <UploadCloud className="mr-2 h-4 w-4" /> Go to Calculator to Upload File
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboardServiceSections || dashboardServiceSections.length === 0) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center flex flex-col items-center justify-center min-h-[calc(100vh-10rem)]">
        <Card className="w-full max-w-lg shadow-lg rounded-xl bg-card border border-border">
          <CardHeader>
            <div className="flex justify-center items-center mb-3">
              <Info className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-semibold text-primary">No Dashboard Data Found</CardTitle>
            <CardDescription className="text-muted-foreground">
              The &quot;Море + Ж/Д&quot; Excel file was loaded, but no dashboard sections were found or parsed from its first sheet. Please check the file format.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                <UploadCloud className="mr-2 h-4 w-4" /> Back to Calculator
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center">
            <FileText className="mr-3 h-8 w-8 text-accent" />
            Sea + Rail Services Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Displaying data from the first sheet of the uploaded &quot;Море + Ж/Д&quot; Excel file.
          </p>
        </div>
      </header>

      {dashboardServiceSections.map((section, sectionIndex) => (
        <Card key={`section-${sectionIndex}`} className="shadow-xl rounded-xl overflow-hidden bg-card border border-border hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="pb-4 bg-muted/30 border-b">
            <CardTitle className="text-xl font-semibold text-primary">{section.serviceName || `Service Section ${sectionIndex + 1}`}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {section.dataRows && section.dataRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%] pl-6">Route (Origin - Destination)</TableHead>
                    <TableHead className="w-[15%]">Sea Rate</TableHead>
                    <TableHead className="w-[15%]">Container Info</TableHead>
                    <TableHead className="w-[25%]">Comments / Details</TableHead>
                    <TableHead className="w-[15%] text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.dataRows.map((row, rowIndex) => (
                    <React.Fragment key={`row-frag-${sectionIndex}-${rowIndex}`}>
                      <TableRow className="hover:bg-muted/10">
                        <TableCell className="font-medium pl-6 py-3">{row.route || 'N/A'}</TableCell>
                        <TableCell className="py-3">{row.rate || 'N/A'}</TableCell>
                        <TableCell className="py-3">{row.containerInfo || 'N/A'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3">{row.additionalComment || '-'}</TableCell>
                        <TableCell className="text-right pr-6 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDashboardCopyRate(row)}
                          >
                            <Copy className="mr-2 h-3 w-3" /> Copy Rate
                          </Button>
                        </TableCell>
                      </TableRow>
                      {row.railwayCost && (
                        <TableRow className="bg-muted/20 hover:bg-muted/30 border-t border-dashed">
                          <TableCell className="pl-10 py-2 text-sm font-medium text-primary flex items-center">
                            <Train className="mr-2 h-4 w-4 text-primary/80" /> Railway Leg: {row.railwayOriginInfo || ''}
                          </TableCell>
                          <TableCell className="py-2 text-sm font-semibold text-primary">{row.railwayCost}</TableCell>
                          <TableCell className="py-2 text-sm">{row.railwayContainerInfo || 'N/A'}</TableCell>
                          <TableCell colSpan={2} className="pr-6 py-2 text-xs text-muted-foreground">{row.railwayComment || '-'}</TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="p-6 text-muted-foreground">No data rows found for this service.</p>
            )}
          </CardContent>
        </Card>
      ))}
       {dashboardServiceSections.length === 0 && isSeaRailExcelDataLoaded && (
         <Card className="shadow-lg rounded-xl bg-card border border-border">
           <CardHeader>
             <CardTitle className="text-xl font-semibold text-primary">No Services Found</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground">The first sheet of your Excel file does not seem to contain data in the expected format for the dashboard.</p>
           </CardContent>
         </Card>
       )}
    </div>
  );
}
