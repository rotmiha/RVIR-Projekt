import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

interface ConflictAlertProps {
  count: number;
  onView?: () => void;
  onDismiss?: () => void;
}

export function ConflictAlert({ count, onView, onDismiss }: ConflictAlertProps) {
  if (count === 0) return null;

  return (
    <Alert className="border-l-4 border-l-destructive" data-testid="alert-conflicts">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Schedule Conflicts Detected</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span data-testid="text-conflict-count">
          You have {count} scheduling {count === 1 ? 'conflict' : 'conflicts'} that need attention.
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onView} data-testid="button-view-conflicts">
            View Conflicts
          </Button>
          {onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss} data-testid="button-dismiss-alert">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
