import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface CalendarEvent {
  id: string;
  title: string;
  type: "učenje" | "osebno";
  startTime: Date;
  endTime: Date;
  location?: string;
}

interface WeekCalendarProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const DAYS = ["Pon", "Tor", "Sre", "Čet", "Pet", "Sob", "Ned"];

export function WeekCalendar({ events, onEventClick }: WeekCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => isSameDay(event.startTime, date));
  };

  const getEventPosition = (event: CalendarEvent) => {
    const hour = event.startTime.getHours();
    const minute = event.startTime.getMinutes();
    const top = ((hour - 7) * 60 + minute) / 60;
    
    const duration = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60);
    const height = duration / 60;

    return { top: `${top * 60}px`, height: `${height * 60}px` };
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Tedenski urnik</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center" data-testid="text-current-week">
            {format(weekStart, "MMM d")} - {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-8 border-b border-border">
              <div className="p-2 text-xs font-medium text-muted-foreground">Čas</div>
              {DAYS.map((day, index) => {
                const date = addDays(weekStart, index);
                return (
                  <div key={day} className="p-2 text-center border-l border-border">
                    <div className="text-xs font-medium">{day}</div>
                    <div className="text-xs text-muted-foreground">{format(date, "d")}</div>
                  </div>
                );
              })}
            </div>
            <div className="relative">
              <div className="grid grid-cols-8">
                <div>
                  {HOURS.map((hour) => (
                    <div key={hour} className="h-[60px] p-2 text-xs text-muted-foreground border-b border-border">
                      {String(hour).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {DAYS.map((_, dayIndex) => {
                  const date = addDays(weekStart, dayIndex);
                  const dayEvents = getEventsForDay(date);
                  
                  return (
                    <div key={dayIndex} className="relative border-l border-border">
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="h-[60px] border-b border-border hover-elevate cursor-pointer"
                        />
                      ))}
                      {dayEvents.map((event) => {
                        const position = getEventPosition(event);
                        return (
                          <div
                            key={event.id}
                            className="absolute left-0 right-0 mx-1 rounded-md p-1 cursor-pointer overflow-hidden hover-elevate active-elevate-2"
                            style={position}
                            onClick={() => onEventClick?.(event)}
                            data-testid={`calendar-event-${event.id}`}
                          >
                            <Badge
                              variant={event.type === "učenje" ? "default" : "secondary"}
                              className="text-[10px] px-1 py-0 h-auto mb-0.5"
                            >
                              {event.type}
                            </Badge>
                            <div className="text-xs font-medium truncate">{event.title}</div>
                            {event.location && (
                              <div className="text-[10px] text-muted-foreground truncate">
                                {event.location}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
