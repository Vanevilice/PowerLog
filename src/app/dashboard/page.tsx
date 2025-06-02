
"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePricingData, type DashboardServiceSection, type DashboardServiceDataRow, type RailwayLegData } from '@/contexts/PricingDataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, FileText, UploadCloud, Info, Train, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { dashboardServiceSections, isSeaRailExcelDataLoaded } = usePricingData();
  const { toast } = useToast();
  const [railwaySelection, setRailwaySelection] = React.useState<Record<number, number | null>>({});

  React.useEffect(() => {
    // console.log("[DashboardPage] isSeaRailExcelDataLoaded:", isSeaRailExcelDataLoaded);
    // console.log("[DashboardPage] dashboardServiceSections:", dashboardServiceSections);
  }, [isSeaRailExcelDataLoaded, dashboardServiceSections]);

  const handleRailwayLegCheckboxChange = (sectionIndex: number, legIndex: number) => {
    setRailwaySelection(prev => {
      const currentSelectedLegIndexForSection = prev[sectionIndex];
      if (currentSelectedLegIndexForSection === legIndex) {
        return { ...prev, [sectionIndex]: null }; 
      } else {
        return { ...prev, [sectionIndex]: legIndex }; 
      }
    });
  };

  const handleDashboardCopyRate = async (row: DashboardServiceDataRow, sectionIndex: number) => {
    console.log(`[DashboardCopyRate] >>> BUTTON CLICKED for Section ${sectionIndex}, Route: '${row.route}'`);
    console.log(`[DashboardCopyRate] Current 'row' object being processed:`, JSON.parse(JSON.stringify(row)));
    
    const selectedLegIndexForSection = railwaySelection[sectionIndex];
    console.log(`[DashboardCopyRate] selectedLegIndex for section ${sectionIndex}: ${selectedLegIndexForSection}`);

    let selectedLeg: RailwayLegData | null = null;

    if (selectedLegIndexForSection !== null && selectedLegIndexForSection !== undefined) {
      const sectionData = dashboardServiceSections[sectionIndex];
      if (sectionData && sectionData.dataRows && sectionData.dataRows.length > 0) {
        // Railway legs are common for the section, so take from the first row.
        const commonLegs = sectionData.dataRows[0]?.railwayLegs;
        if (commonLegs && commonLegs.length > selectedLegIndexForSection) {
          selectedLeg = commonLegs[selectedLegIndexForSection];
          console.log(`[DashboardCopyRate] Selected Leg (index ${selectedLegIndexForSection}) from COMMON section legs:`, JSON.parse(JSON.stringify(selectedLeg)));
        } else {
          console.log(`[DashboardCopyRate] Could not retrieve common railway legs for section ${sectionIndex} or leg index ${selectedLegIndexForSection} is out of bounds.`);
        }
      }
    }
     if (selectedLegIndexForSection !== undefined && selectedLeg === null) {
        console.warn(`[DashboardCopyRate] A railway leg was selected for section ${sectionIndex} (index: ${selectedLegIndexForSection}), but no valid leg data could be retrieved.`);
    }

    let textToCopy = "";
    const routeParts = row.route.split(' - ');
    const originPartRaw = routeParts[0] || 'N/A';
    const originPart = originPartRaw.replace(/^(FOB|FI)\s*/i, '').trim();
    
    let forPartDisplay = 'N/A';
    let railwayCostDisplay = 'N/A';
    let includeRailwayPart = false;

    if (selectedLeg) {
        console.log(`[DashboardCopyRate] USING Selected Leg for section ${sectionIndex}:`, JSON.parse(JSON.stringify(selectedLeg)));
        if (selectedLeg.originInfo && selectedLeg.originInfo !== 'N/A') {
            forPartDisplay = selectedLeg.originInfo.replace(/^(FOB|FI|CY)\s*/i, '').trim();
        }
        if (selectedLeg.cost && selectedLeg.cost !== 'N/A') {
            railwayCostDisplay = selectedLeg.cost;
            includeRailwayPart = true;
        } else {
             console.log(`[DashboardCopyRate] Selected common leg for section ${sectionIndex} has no valid cost ('${selectedLeg.cost}'). Railway part will NOT be included.`);
        }
    } else {
        console.log(`[DashboardCopyRate] NO specific railway leg selected for section ${sectionIndex} or data found. Falling back to main route destination for 'FOR' part.`);
        if (routeParts.length > 1) { 
            const destinationPartRaw = routeParts.slice(1).join(' - ');
            forPartDisplay = destinationPartRaw.replace(/^(FOB|FI|CY)\s*/i, '').trim();
        }
    }
    
    textToCopy += `FOB (${row.containerInfo || 'N/A'}) ${originPart} - Владивосток - FOR ${forPartDisplay} :\n`;
    textToCopy += `Фрахт: ${row.rate || 'N/A'}\n`;

    if (includeRailwayPart) {
      textToCopy += `Ж/Д Составляющая: ${railwayCostDisplay}\n`;
    }
    
    console.log(`[DashboardCopyRate] Final textToCopy for route ${row.route}:\n${textToCopy}`);
    console.log(`[DashboardCopyRate] <<< END OF COPY for Section ${sectionIndex}, Route: ${row.route}`);

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

      {dashboardServiceSections.map((section, sectionIndex) => {
        const commonRailwayLegsForSection = section.dataRows[0]?.railwayLegs || [];
        return (
        <Card key={`section-${sectionIndex}`} className="shadow-xl rounded-xl overflow-hidden bg-card border border-border hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="pb-4 bg-muted/30 border-b">
            <CardTitle className="text-xl font-semibold text-primary">{section.serviceName || `Service Section ${sectionIndex + 1}`}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {section.dataRows && section.dataRows.length > 0 ? (
              <>
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
                      <TableRow key={`row-${sectionIndex}-${rowIndex}`} className="hover:bg-muted/10">
                        <TableCell className="font-medium pl-6 py-3">{row.route || 'N/A'}</TableCell>
                        <TableCell className="py-3">{row.rate || 'N/A'}</TableCell>
                        <TableCell className="py-3">{row.containerInfo || 'N/A'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3">{row.additionalComment || '-'}</TableCell>
                        <TableCell className="text-right pr-6 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-primary text-primary hover:bg-primary/10"
                            onClick={() => handleDashboardCopyRate(row, sectionIndex)}
                          >
                            <Copy className="mr-2 h-3 w-3" /> Copy Rate
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {commonRailwayLegsForSection.length > 0 && (
                  <div className="p-4 border-t">
                    <h4 className="text-md font-semibold mb-2 text-primary flex items-center">
                        <Train className="mr-2 h-5 w-5 text-accent" /> Available Railway Legs for this Section
                    </h4>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead> {/* Checkbox column */}
                                <TableHead>Origin Info</TableHead>
                                <TableHead>Cost</TableHead>
                                <TableHead>Container</TableHead>
                                <TableHead>Comment</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {commonRailwayLegsForSection.map((leg, legIndex) => (
                                <TableRow key={`common-leg-${sectionIndex}-${legIndex}`} className="hover:bg-muted/10">
                                    <TableCell className="p-2">
                                        <Checkbox
                                            id={`rail-select-section-${sectionIndex}-leg-${legIndex}`}
                                            checked={railwaySelection[sectionIndex] === legIndex}
                                            onCheckedChange={() => handleRailwayLegCheckboxChange(sectionIndex, legIndex)}
                                        />
                                    </TableCell>
                                    <TableCell className="py-2 text-sm">{leg.originInfo || 'N/A'}</TableCell>
                                    <TableCell className="py-2 text-sm font-semibold">{leg.cost || 'N/A'}</TableCell>
                                    <TableCell className="py-2 text-sm">{leg.containerInfo || 'N/A'}</TableCell>
                                    <TableCell className="py-2 text-xs text-muted-foreground">{leg.comment || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                  </div>
                )}
              </>
            ) : (
              <p className="p-6 text-muted-foreground">No data rows found for this service.</p>
            )}
          </CardContent>
        </Card>
      )})}
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
