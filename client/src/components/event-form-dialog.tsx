import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EventFormData {
  title: string;
  type: "study" | "personal";
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  description: string;
}

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<EventFormData>;
}

export function EventFormDialog({
  open,
  onOpenChange,
  defaultValues,
}: EventFormDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<EventFormData>({
    title: defaultValues?.title || "",
    type: defaultValues?.type || "personal",
    startDate: defaultValues?.startDate || "",
    startTime: defaultValues?.startTime || "",
    endDate: defaultValues?.endDate || "",
    endTime: defaultValues?.endTime || "",
    location: defaultValues?.location || "",
    description: defaultValues?.description || "",
  });

  const createEventMutation = useMutation({
    mutationFn: (data: {
      title: string;
      type: 'study' | 'personal';
      startTime: string;
      endTime: string;
      location?: string;
      description?: string;
    }) => api.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conflicts'] });
      toast({
        title: "Event Created",
        description: "Your event has been added to the schedule.",
      });
      onOpenChange(false);
      setFormData({
        title: "",
        type: "personal",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        location: "",
        description: "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const startTime = new Date(`${formData.startDate}T${formData.startTime}`).toISOString();
    const endTime = new Date(`${formData.endDate}T${formData.endTime}`).toISOString();

    createEventMutation.mutate({
      title: formData.title,
      type: formData.type,
      startTime,
      endTime,
      location: formData.location || undefined,
      description: formData.description || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-event-form">
        <DialogHeader>
          <DialogTitle>Add Event</DialogTitle>
          <DialogDescription>
            Create a new event in your schedule. Study events take priority over personal events.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                placeholder="e.g., Mathematics Lecture"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                data-testid="input-event-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Event Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: "study" | "personal") =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger id="type" data-testid="select-event-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="study">Study Event</SelectItem>
                  <SelectItem value="personal">Personal Event</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  required
                  data-testid="input-start-time"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                  data-testid="input-end-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  required
                  data-testid="input-end-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location (Optional)</Label>
              <Input
                id="location"
                placeholder="e.g., Room 101, Building A"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                data-testid="input-event-location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Add any additional details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                data-testid="input-event-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-event">
              Cancel
            </Button>
            <Button type="submit" disabled={createEventMutation.isPending} data-testid="button-save-event">
              {createEventMutation.isPending ? "Saving..." : "Save Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
