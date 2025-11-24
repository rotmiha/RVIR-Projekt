import { EventCard } from "@/components/event-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { EventFormDialog } from "@/components/event-form-dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function EventsPage() {
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['/api/events'],
    queryFn: () => api.getEvents(),
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

  const filteredEvents = events.filter((event) => {
    const matchesType = filterType === "all" || event.type === filterType;
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Dogodki</h1>
          <p className="text-muted-foreground mt-1">Upravljajte vse vaše načrtovane aktivnosti</p>
        </div>
        <Button onClick={() => setShowEventDialog(true)} data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-2" />
          Dodaj dogodek
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Išči dogodke..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-events"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-filter-type">
            <SelectValue placeholder="Filtriraj po tipu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsi dogodki</SelectItem>
            <SelectItem value="učenje">Učni dogodki</SelectItem>
            <SelectItem value="osebno">Osebni dogodki</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nalaganje dogodkov...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Ni najdenih dogodkov</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
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
      </div>

      <EventFormDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
      />
    </div>
  );
}
