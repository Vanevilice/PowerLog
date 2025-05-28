
"use client";

import React from 'react';
import Link from 'next/link';
import { usePricingData, type DashboardServiceSection } from '@/contexts/PricingDataContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, UploadCloud, Info } from 'lucide-react';

export default function DashboardPage() {
  const { dashboardServiceSections, isSeaRailExcelDataLoaded } = usePricingData();

  // Log context values when component renders
  React.useEffect(() => {
    console.log("[DashboardPage] isSeaRailExcelDataLoaded:", isSeaRailExcelDataLoaded);
    console.log("[DashboardPage] dashboardServiceSections:", dashboardServiceSections);
  }, [isSeaRailExcelDataLoaded, dashboardServiceSections]);

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
          <CardContent className="p-0"> {/* Remove padding to allow table to fill */}
            {section.dataRows && section.dataRows.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%] pl-6">Route (Origin - Destination)</TableHead>
                    <TableHead className="w-[20%]">Rate</TableHead>
                    <TableHead className="w-[25%]">Container Info</TableHead>
                    <TableHead className="w-[15%] pr-6">Additional Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.dataRows.map((row, rowIndex) => (
                    <TableRow key={`row-${sectionIndex}-${rowIndex}`} className="hover:bg-muted/10">
                      <TableCell className="font-medium pl-6 py-3">{row.route || 'N/A'}</TableCell>
                      <TableCell className="py-3">{row.rate || 'N/A'}</TableCell>
                      <TableCell className="py-3">{row.containerInfo || 'N/A'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground pr-6 py-3">{row.additionalComment || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="p-6 text-muted-foreground">No data rows found for this service.</p>
            )}
          </CardContent>
        </Card>
      ))}
       {dashboardServiceSections.length === 0 && isSeaRailExcelDataLoaded && ( // This specific case might be caught by the earlier check, but kept for safety
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
