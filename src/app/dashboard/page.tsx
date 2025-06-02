
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
  const [railwaySelection, setRailwaySelection] = React.useState<Record<string, number | null>>({});

  React.useEffect(() => {
    // console.log("[DashboardPage] isSeaRailExcelDataLoaded:", isSeaRailExcelDataLoaded);
    // console.log("[DashboardPage] dashboardServiceSections:", dashboardServiceSections);
  }, [isSeaRailExcelDataLoaded, dashboardServiceSections]);

  const handleRailwayLegCheckboxChange = (sectionIndex: number, rowIndex: number, legIndex: number) => {
    const key = `${sectionIndex}-${rowIndex}`;
    setRailwaySelection(prev => {
      const currentSelectedLegIndex = prev[key];
      if (currentSelectedLegIndex === legIndex) {
        return { ...prev, [key]: null }; // Deselect if already selected
      } else {
        return { ...prev, [key]: legIndex }; // Select the new leg
      }
    });
  };

  const handleDashboardCopyRate = async (row: DashboardServiceDataRow, sectionIndex: number, rowIndex: number) => {
    // --- Start Detailed Logging ---
    console.log(`[DashboardCopyRate] >>> BUTTON CLICKED for Section ${sectionIndex}, Row ${rowIndex}, Route: '${row.route}'`);
    console.log(`[DashboardCopyRate] Current 'row' object being processed:`, JSON.parse(JSON.stringify(row)));
    
    const selectionKey = `${sectionIndex}-${rowIndex}`;
    const selectedLegIndex = railwaySelection[selectionKey];
    console.log(`[DashboardCopyRate] selectionKey: '${selectionKey}', selectedLegIndex from state: ${selectedLegIndex}`);

    let selectedLeg: RailwayLegData | null | undefined = null;

    if (selectedLegIndex !== null && selectedLegIndex !== undefined) {
      if (row.railwayLegs && row.railwayLegs.length > selectedLegIndex) {
        selectedLeg = row.railwayLegs[selectedLegIndex];
        console.log(`[DashboardCopyRate] Selected Leg (index ${selectedLegIndex}) from CURRENT row:`, JSON.parse(JSON.stringify(selectedLeg)));
      } else {
        console.log(`[DashboardCopyRate] Current row has no/insufficient railwayLegs. Attempting to use last row in section.`);
        const currentSection = dashboardServiceSections[sectionIndex];
        if (currentSection && currentSection.dataRows.length > 0) {
          const lastFobFiRowInSection = currentSection.dataRows[currentSection.dataRows.length - 1];
          if (lastFobFiRowInSection && lastFobFiRowInSection.railwayLegs && lastFobFiRowInSection.railwayLegs.length > selectedLegIndex) {
            selectedLeg = lastFobFiRowInSection.railwayLegs[selectedLegIndex];
            console.log(`[DashboardCopyRate] Selected Leg (index ${selectedLegIndex}) from LAST row in section:`, JSON.parse(JSON.stringify(selectedLeg)));
          } else {
            console.log(`[DashboardCopyRate] Last row in section also has no/insufficient railwayLegs for index ${selectedLegIndex}.`);
          }
        } else {
          console.log(`[DashboardCopyRate] Could not find current section or it has no data rows.`);
        }
      }
    }
     if (selectedLegIndex !== undefined && selectedLeg === null) {
        console.warn(`[DashboardCopyRate] A railway leg was selected (index: ${selectedLegIndex}), but no valid leg data could be retrieved for copying.`);
    }


    let textToCopy = "";
    const routeParts = row.route.split(' - ');
    const originPartRaw = routeParts[0] || 'N/A';
    const originPart = originPartRaw.replace(/^(FOB|FI)\s*/i, '').trim();
    
    let forPartDisplay = 'N/A';
    let railwayCostDisplay = 'N/A';
    let includeRailwayPart = false;

    if (selectedLeg) { // Check if selectedLeg was successfully populated
        console.log(`[DashboardCopyRate] USING Selected Leg (source: ${row.railwayLegs && row.railwayLegs[selectedLegIndex!] === selectedLeg ? 'current_row' : 'last_row_in_section_or_undefined'}) :`, JSON.parse(JSON.stringify(selectedLeg)));
        if (selectedLeg.originInfo && selectedLeg.originInfo !== 'N/A') {
            forPartDisplay = selectedLeg.originInfo.replace(/^(FOB|FI|CY)\s*/i, '').trim();
        }
        if (selectedLeg.cost && selectedLeg.cost !== 'N/A') {
            railwayCostDisplay = selectedLeg.cost;
            includeRailwayPart = true;
        } else {
             console.log(`[DashboardCopyRate] Selected leg (from either current or last row) has no valid cost ('${selectedLeg.cost}'). Railway part will NOT be included.`);
        }
    } else {
        console.log(`[DashboardCopyRate] NO specific railway leg selected or data found (selectedLegIndex: ${selectedLegIndex}). Falling back to main route destination for 'FOR' part.`);
        if (routeParts.length > 1) { 
            const destinationPartRaw = routeParts.slice(1).join(' - ');
            forPartDisplay = destinationPartRaw.replace(/^(FOB|FI|CY)\s*/i, '').trim();
        }
    }
    
    textToCopy += `FOB ${originPart} - Владивосток - FOR ${forPartDisplay} :\n`;
    textToCopy += `Фрахт: ${row.rate || 'N/A'}\n`;

    if (includeRailwayPart) {
      textToCopy += `Ж/Д Составляющая: ${railwayCostDisplay}\n`;
    }
    
    console.log(`[DashboardCopyRate] Final textToCopy for Row ${rowIndex}:\n${textToCopy}`);
    console.log(`[DashboardCopyRate] <<< END OF COPY for Section ${sectionIndex}, Row ${rowIndex}`);


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
                            className="border-primary text-primary hover:bg-primary/10"
                            onClick={() => handleDashboardCopyRate(row, sectionIndex, rowIndex)}
                          >
                            <Copy className="mr-2 h-3 w-3" /> Copy Rate
                          </Button>
                        </TableCell>
                      </TableRow>
                      {row.railwayLegs && row.railwayLegs.map((leg, legIndex) => (
                        <TableRow key={`leg-${sectionIndex}-${rowIndex}-${legIndex}`} className="bg-muted/20 hover:bg-muted/30 border-t border-dashed">
                           <TableCell className="pl-6 py-2 text-sm font-medium text-primary flex items-center">
                             <Checkbox
                                id={`rail-select-${sectionIndex}-${rowIndex}-${legIndex}`}
                                checked={railwaySelection[`${sectionIndex}-${rowIndex}`] === legIndex}
                                onCheckedChange={() => {
                                  handleRailwayLegCheckboxChange(sectionIndex, rowIndex, legIndex);
                                }}
                                className="mr-2"
                              />
                            <Train className="mr-2 h-4 w-4 text-primary/80" /> 
                            {leg.originInfo || 'Railway Leg'}
                          </TableCell>
                          <TableCell className="py-2 text-sm font-semibold text-primary">{leg.cost}</TableCell>
                          <TableCell className="py-2 text-sm">{leg.containerInfo || 'N/A'}</TableCell>
                          <TableCell colSpan={2} className="pr-6 py-2 text-xs text-muted-foreground">{leg.comment || '-'}</TableCell>
                        </TableRow>
                      ))}
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

