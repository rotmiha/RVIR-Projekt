import { EventFormDialog } from "../event-form-dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function EventFormDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-6 bg-background">
      <Button onClick={() => setOpen(true)}>Open Event Form</Button>
      <EventFormDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={(data) => console.log("Form submitted:", data)}
      />
    </div>
  );
}
