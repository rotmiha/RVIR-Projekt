import { UploadZone } from "@/components/upload-zone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Upload } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { api, ParsedICSEvent } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export default function ImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedEvents, setParsedEvents] = useState<ParsedICSEvent[]>([]);
  const { toast } = useToast();

  const parseFileMutation = useMutation({
    mutationFn: (file: File) => api.parseICSFile(file),
    onSuccess: (data) => {
      setParsedEvents(data.events);
      toast({
        title: "Schedule Parsed Successfully",
        description: `Found ${data.eventsFound} events in the calendar file.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Parsing Failed",
        description: error.message,
        variant: "destructive",
      });
      setParsedEvents([]);
      setSelectedFile(null);
    },
  });

  const importEventsMutation = useMutation({
    mutationFn: (events: ParsedICSEvent[]) => api.importEvents(events.map(e => ({
      ...e,
      type: 'study' as const,
    }))),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conflicts'] });
      toast({
        title: "Events Imported",
        description: `${data.imported} events have been added to your schedule.`,
      });
      setParsedEvents([]);
      setSelectedFile(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    parseFileMutation.mutate(file);
  };

  const handleImport = () => {
    importEventsMutation.mutate(parsedEvents);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">Import Schedule</h1>
        <p className="text-muted-foreground mt-1">
          Upload your university timetable (.ics format) to automatically sync events
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Calendar File</CardTitle>
            <CardDescription>
              Select your .ics file exported from Wise Timetable or any other calendar application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadZone onFileSelect={handleFileSelect} accept=".ics,.ical" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
            <CardDescription>How to export your university schedule</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">From Wise Timetable:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Visit the Wise Timetable website</li>
                <li>Select your study program</li>
                <li>Click on "iCal-vse" to download the .ics file</li>
                <li>Upload the downloaded file here</li>
              </ol>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Supported Formats:</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">.ics</Badge>
                <Badge variant="secondary">.ical</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {parseFileMutation.isPending && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4"></div>
            <p className="text-sm text-muted-foreground">Processing calendar file...</p>
          </CardContent>
        </Card>
      )}

      {parsedEvents.length > 0 && !parseFileMutation.isPending && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle>Preview Events</CardTitle>
              <CardDescription>
                {parsedEvents.length} events found. Review before importing.
              </CardDescription>
            </div>
            <Button 
              onClick={handleImport} 
              disabled={importEventsMutation.isPending}
              data-testid="button-import-events"
            >
              <Upload className="h-4 w-4 mr-2" />
              {importEventsMutation.isPending ? "Importing..." : "Import All Events"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {parsedEvents.map((event, index) => (
              <div
                key={index}
                className="p-4 rounded-lg border hover-elevate"
                data-testid={`preview-event-${index}`}
              >
                <h3 className="font-medium mb-2">{event.title}</h3>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(event.startTime).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>
                      {new Date(event.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                      {new Date(event.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
