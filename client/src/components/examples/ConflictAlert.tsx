import { ConflictAlert } from "../conflict-alert";

export default function ConflictAlertExample() {
  return (
    <div className="p-6 bg-background">
      <ConflictAlert
        count={3}
        onView={() => console.log("View conflicts")}
        onDismiss={() => console.log("Dismiss alert")}
      />
    </div>
  );
}
