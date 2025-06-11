
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
import { generateDashboardCopyText } from '@/lib/pricing/ui-helpers';
import { useLocalization } from '@/contexts/LocalizationContext'; // Import useLocalization

export default function DashboardPage() {
  const { dashboardServiceSections, isSeaRailExcelDataLoaded } = usePricingData();
  const { toast } = useToast();
  const { translate } = useLocalization(); // Use the hook
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
      // Railway legs are common for the section, so take from the first row as they are now copied.
      const commonLegs = sectionData?.dataRows?.[0]?.railwayLegs; 
      if (commonLegs && commonLegs.length > selectedLegIndexForSection) {
        selectedLeg = commonLegs[selectedLegIndexForSection];
        console.log(`[DashboardCopyRate] Selected Leg (index ${selectedLegIndexForSection}) from COMMON section legs:`, JSON.parse(JSON.stringify(selectedLeg)));
      } else {
        console.log(`[DashboardCopyRate] Could not retrieve common railway legs for section ${sectionIndex} or leg index ${selectedLegIndexForSection} is out of bounds.`);
      }
    }
     if (selectedLegIndexForSection !== undefined && selectedLeg === null) {
        console.warn(`[DashboardCopyRate] A railway leg was selected for section ${sectionIndex} (index: ${selectedLegIndexForSection}), but no valid leg data could be retrieved.`);
    }

    const routeParts = row.route.split(' - ');
    const originPartRaw = routeParts[0] || 'N/A';
    const originPart = originPartRaw.replace(/^(FOB|FI)\s*/i, '').trim();
    
    let forPartDisplay = 'N/A';
    
    if (selectedLeg) {
        console.log(`[DashboardCopyRate] USING Selected Leg for section ${sectionIndex}:`, JSON.parse(JSON.stringify(selectedLeg)));
        if (selectedLeg.originInfo && selectedLeg.originInfo !== 'N/A') {
            forPartDisplay = selectedLeg.originInfo.replace(/^(FOB|FI|CY)\s*/i, '').trim();
        }
    } else {
        console.log(`[DashboardCopyRate] NO specific railway leg selected or data found (selectedLegIndex: ${selectedLegIndexForSection}). Falling back to main route destination for 'FOR' part.`);
        if (routeParts.length > 1) { 
            const destinationPartRaw = routeParts.slice(1).join(' - ');
            forPartDisplay = destinationPartRaw.replace(/^(FOB|FI|CY)\s*/i, '').trim();
        }
    }
    
    const textToCopy = generateDashboardCopyText(row, selectedLeg, originPart, forPartDisplay);
    
    console.log(`[DashboardCopyRate] Final textToCopy for route ${row.route}:\n${textToCopy}`);
    console.log(`[DashboardCopyRate] <<< END OF COPY for Section ${sectionIndex}, Route: ${row.route}`);

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({ title: translate('toast_Success_Title'), description: translate('toast_Dashboard_RateCopied') });
    } catch (err) {
      toast({ variant: "destructive", title: translate('toast_CopyFailed_Title'), description: translate('toast_CopyFailed_Description') });
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
            <CardTitle className="text-2xl font-semibold text-primary">{translate('dashboard_DataNotLoaded_Title')}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {translate('dashboard_DataNotLoaded_Description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="default" className="w-full">
              <Link href="/">
                <UploadCloud className="mr-2 h-4 w-4" /> {translate('dashboard_DataNotLoaded_Button')}
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
            <CardTitle className="text-2xl font-semibold text-primary">{translate('dashboard_NoDataFound_Title')}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {translate('dashboard_NoDataFound_Description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                <UploadCloud className="mr-2 h-4 w-4" /> {translate('dashboard_BackToCalculator_Button')}
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
            {translate('dashboard_MainTitle')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {translate('dashboard_MainDescription')}
          </p>
        </div>
      </header>

      {dashboardServiceSections.map((section, sectionIndex) => {
        const commonRailwayLegsForSection = section.dataRows[0]?.railwayLegs || [];
        return (
        <Card key={`section-${sectionIndex}`} className="shadow-xl rounded-xl overflow-hidden bg-card border border-border hover:shadow-2xl transition-shadow duration-300">
          <CardHeader className="pb-4 bg-muted/30 border-b">
            <CardTitle className="text-xl font-semibold text-primary">{section.serviceName || translate('dashboard_ServiceSection_FallbackTitle', { sectionNumber: sectionIndex + 1 })}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {section.dataRows && section.dataRows.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30%] pl-6">{translate('dashboard_TableHead_Route')}</TableHead>
                      <TableHead className="w-[15%]">{translate('dashboard_TableHead_SeaRate')}</TableHead>
                      <TableHead className="w-[15%]">{translate('dashboard_TableHead_ContainerInfo')}</TableHead>
                      <TableHead className="w-[25%]">{translate('dashboard_TableHead_CommentsDetails')}</TableHead>
                      <TableHead className="w-[15%] text-right pr-6">{translate('dashboard_TableHead_Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.dataRows.map((row, rowIndex) => (
                      <TableRow key={`row-${sectionIndex}-${rowIndex}`} className="hover:bg-muted/10">
                        <TableCell className="font-medium pl-6 py-3">{row.route || translate('common_NA')}</TableCell>
                        <TableCell className="py-3">{row.rate || translate('common_NA')}</TableCell>
                        <TableCell className="py-3">{row.containerInfo || translate('common_NA')}</TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3">{row.additionalComment || translate('common_Dash')}</TableCell>
                        <TableCell className="text-right pr-6 py-3">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-primary text-primary hover:bg-primary/10"
                            onClick={() => handleDashboardCopyRate(row, sectionIndex)}
                          >
                            <Copy className="mr-2 h-3 w-3" /> {translate('dashboard_CopyRate_Button')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {commonRailwayLegsForSection.length > 0 && (
                  <div className="p-4 border-t">
                    <h4 className="text-md font-semibold mb-2 text-primary flex items-center">
                        <Train className="mr-2 h-5 w-5 text-accent" /> {translate('dashboard_RailwayLegs_Title')}
                    </h4>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-8"></TableHead> {/* Checkbox column */}
                                <TableHead>{translate('dashboard_RailwayLegs_OriginInfo')}</TableHead>
                                <TableHead>{translate('dashboard_RailwayLegs_Cost')}</TableHead>
                                <TableHead>{translate('dashboard_RailwayLegs_Container')}</TableHead>
                                <TableHead>{translate('dashboard_RailwayLegs_Comment')}</TableHead>
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
                                    <TableCell className="py-2 text-sm">{leg.originInfo || translate('common_NA')}</TableCell>
                                    <TableCell className="py-2 text-sm font-semibold">{leg.cost || translate('common_NA')}</TableCell>
                                    <TableCell className="py-2 text-sm">{leg.containerInfo || translate('common_NA')}</TableCell>
                                    <TableCell className="py-2 text-xs text-muted-foreground">{leg.comment || translate('common_Dash')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                  </div>
                )}
              </>
            ) : (
              <p className="p-6 text-muted-foreground">{translate('dashboard_NoDataRowsForService')}</p>
            )}
          </CardContent>
        </Card>
      )})}
       {dashboardServiceSections.length === 0 && isSeaRailExcelDataLoaded && (
         <Card className="shadow-lg rounded-xl bg-card border border-border">
           <CardHeader>
             <CardTitle className="text-xl font-semibold text-primary">{translate('dashboard_NoServicesFound_Title')}</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground">{translate('dashboard_NoServicesFound_Description')}</p>
           </CardContent>
         </Card>
       )}
    </div>
  );
}


    