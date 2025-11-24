import { EventCard } from "../event-card";

export default function EventCardExample() {
  return (
    <div className="p-6 bg-background space-y-4 max-w-2xl">
      <EventCard
        id="1"
        title="Mathematics Lecture"
        type="study"
        startTime={new Date(2024, 0, 15, 9, 0)}
        endTime={new Date(2024, 0, 15, 11, 0)}
        location="Room 201, Building A"
        onEdit={(id) => console.log("Edit event:", id)}
        onDelete={(id) => console.log("Delete event:", id)}
      />
      <EventCard
        id="2"
        title="Gym Session"
        type="personal"
        startTime={new Date(2024, 0, 15, 10, 0)}
        endTime={new Date(2024, 0, 15, 11, 30)}
        location="Sports Center"
        hasConflict
        onEdit={(id) => console.log("Edit event:", id)}
        onDelete={(id) => console.log("Delete event:", id)}
      />
    </div>
  );
}
