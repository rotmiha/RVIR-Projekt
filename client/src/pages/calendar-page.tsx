import { WeekCalendar } from "@/components/week-calendar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useState } from "react";
import { EventFormDialog } from "@/components/event-form-dialog";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function CalendarPage() {
  const [showEventDialog, setShowEventDialog] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['/api/events'],
    queryFn: () => api.getEvents(),
  });

  const calendarEvents = events.map(event => ({
    id: event.id,
    title: event.title,
    type: event.type as 'study' | 'personal',
    startTime: new Date(event.startTime),
    endTime: new Date(event.endTime),
    location: event.location || undefined,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Weekly Calesssndar</h1>
          <p className="text-muted-foreground mt-1">Your complete schedule at a glance</p>
        </div>
        <Button onClick={() => setShowEventDialog(true)} data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading calendar...</p>
        </div>
      ) : (
        <WeekCalendar
          events={calendarEvents}
          onEventClick={(event) => console.log("Event clicked:", event)}
        />
      )}

      <EventFormDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
      />
    </div>
  );
}
