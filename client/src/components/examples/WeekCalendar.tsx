import { WeekCalendar } from "../week-calendar";
import { addDays, setHours, setMinutes, startOfWeek } from "date-fns";

const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

const mockEvents = [
  {
    id: "1",
    title: "Mathematics",
    type: "study" as const,
    startTime: setMinutes(setHours(weekStart, 9), 0),
    endTime: setMinutes(setHours(weekStart, 11), 0),
    location: "Room 201",
  },
  {
    id: "2",
    title: "Physics Lab",
    type: "study" as const,
    startTime: setMinutes(setHours(addDays(weekStart, 1), 13), 0),
    endTime: setMinutes(setHours(addDays(weekStart, 1), 15), 30),
    location: "Lab 3",
  },
  {
    id: "3",
    title: "Gym",
    type: "personal" as const,
    startTime: setMinutes(setHours(addDays(weekStart, 2), 17), 0),
    endTime: setMinutes(setHours(addDays(weekStart, 2), 18), 30),
  },
  {
    id: "4",
    title: "Programming",
    type: "study" as const,
    startTime: setMinutes(setHours(addDays(weekStart, 3), 10), 0),
    endTime: setMinutes(setHours(addDays(weekStart, 3), 12), 0),
    location: "Room 105",
  },
];

export default function WeekCalendarExample() {
  return (
    <div className="p-6 bg-background">
      <WeekCalendar
        events={mockEvents}
        onEventClick={(event) => console.log("Event clicked:", event)}
      />
    </div>
  );
}
