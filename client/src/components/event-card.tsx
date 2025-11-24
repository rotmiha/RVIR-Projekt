import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface EventCardProps {
  id: string;
  title: string;
  type: "study" | "personal";
  startTime: Date;
  endTime: Date;
  location?: string;
  hasConflict?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function EventCard({
  id,
  title,
  type,
  startTime,
  endTime,
  location,
  hasConflict,
  onEdit,
  onDelete,
}: EventCardProps) {
  return (
    <Card className={`hover-elevate ${hasConflict ? 'border-l-4 border-l-destructive' : ''}`} data-testid={`card-event-${id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium truncate" data-testid={`text-event-title-${id}`}>{title}</h3>
              <Badge variant={type === "study" ? "default" : "secondary"} data-testid={`badge-event-type-${id}`}>
                {type}
              </Badge>
              {hasConflict && (
                <Badge variant="destructive" data-testid={`badge-conflict-${id}`}>Conflict</Badge>
              )}
            </div>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span data-testid={`text-event-time-${id}`}>
                  {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
                </span>
              </div>
              {location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="truncate" data-testid={`text-event-location-${id}`}>{location}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit?.(id)}
              data-testid={`button-edit-event-${id}`}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete?.(id)}
              data-testid={`button-delete-event-${id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
