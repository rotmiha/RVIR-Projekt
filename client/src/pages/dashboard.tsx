import { StatCard } from "@/components/stat-card";
import { ConflictAlert } from "@/components/conflict-alert";
import { EventCard } from "@/components/event-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertTriangle, Users, Plus } from "lucide-react";
import { useState } from "react";
import { EventFormDialog } from "@/components/event-form-dialog";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { startOfWeek, endOfWeek } from "date-fns";

export default function Dashboard() {
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: allEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['/api/events'],
    queryFn: () => api.getEvents(),
  });

  const { data: conflicts = [] } = useQuery({
    queryKey: ['/api/conflicts'],
    queryFn: () => api.getConflicts(),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conflicts'] });
      toast({
        title: "Event Deleted",
        description: "The event has been removed from your schedule.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  
  const thisWeekEvents = allEvents.filter(event => {
    const eventStart = new Date(event.startTime);
    return eventStart >= thisWeekStart && eventStart <= thisWeekEnd;
  });

  const studyEvents = allEvents.filter(e => e.type === 'study');
  const totalStudyHours = studyEvents.reduce((acc, event) => {
    const duration = (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / (1000 * 60 * 60);
    return acc + duration;
  }, 0);

  const upcomingEvents = allEvents
    .filter(event => new Date(event.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 3);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your schedule and activities</p>
        </div>
        <Button onClick={() => setShowEventDialog(true)} data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      {conflicts.length > 0 && (
        <ConflictAlert
          count={conflicts.length}
          onView={() => setLocation("/conflicts")}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Events"
          value={allEvents.length}
          icon={Calendar}
          description="All scheduled"
        />
        <StatCard
          title="Study Hours"
          value={totalStudyHours.toFixed(1)}
          icon={Clock}
          description="Total scheduled"
        />
        <StatCard
          title="Conflicts"
          value={conflicts.length}
          icon={AlertTriangle}
          description={conflicts.length > 0 ? "Need attention" : "All clear"}
        />
        <StatCard
          title="This Week"
          value={thisWeekEvents.length}
          icon={Users}
          description="Events scheduled"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Upcoming Events</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/events")} data-testid="link-view-all-events">
              View All
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {eventsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading events...</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No upcoming events</p>
            ) : (
              upcomingEvents.map((event) => (
                <EventCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  type={event.type as 'study' | 'personal'}
                  startTime={new Date(event.startTime)}
                  endTime={new Date(event.endTime)}
                  location={event.location || undefined}
                  onEdit={(id) => console.log("Edit:", id)}
                  onDelete={(id) => deleteEventMutation.mutate(id)}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setLocation("/import")}
              data-testid="button-import-schedule"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Import University Schedule
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowEventDialog(true)}
              data-testid="button-create-event"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Personal Event
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setLocation("/calendar")}
              data-testid="button-view-calendar"
            >
              <Clock className="h-4 w-4 mr-2" />
              View Weekly Calendar
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setLocation("/settings")}
              data-testid="button-configure-notifications"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Configure Notifications
            </Button>
          </CardContent>
        </Card>
      </div>

      <EventFormDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
      />
    </div>
  );
}
