import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    email: "admin@scheduleapp.com",
    emailNotifications: true,
    conflictAlerts: true,
    dailyDigest: true,
    notificationTiming: "15",
    studyPriority: true,
  });

  const testEmailMutation = useMutation({
    mutationFn: (email: string) => api.sendTestEmail(email),
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: `A test notification has been sent to ${settings.email}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send test email. Make sure your Brevo API key is configured.",
        variant: "destructive",
      });
    },
  });

  const digestMutation = useMutation({
    mutationFn: (email: string) => api.sendDailyDigest(email),
    onSuccess: (data) => {
      toast({
        title: "Daily Digest Sent",
        description: `Sent summary of ${data.eventCount} events to ${settings.email}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send daily digest.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    console.log("Saving settings:", settings);
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully.",
    });
  };

  const handleTestEmail = () => {
    testEmailMutation.mutate(settings.email);
  };

  const handleSendDigest = () => {
    digestMutation.mutate(settings.email);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your notification preferences and application settings
        </p>
      </div>

      <div className="grid gap-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Email Notifications</CardTitle>
            <CardDescription>
              Configure how you receive notifications about your schedule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  data-testid="input-email"
                />
                <Button 
                  variant="outline" 
                  onClick={handleTestEmail}
                  disabled={testEmailMutation.isPending}
                  data-testid="button-test-email"
                >
                  {testEmailMutation.isPending ? "Sending..." : "Test"}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailNotifications">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive email alerts for upcoming events
                </p>
              </div>
              <Switch
                id="emailNotifications"
                checked={settings.emailNotifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailNotifications: checked })
                }
                data-testid="switch-email-notifications"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="conflictAlerts">Conflict Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when scheduling conflicts are detected
                </p>
              </div>
              <Switch
                id="conflictAlerts"
                checked={settings.conflictAlerts}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, conflictAlerts: checked })
                }
                data-testid="switch-conflict-alerts"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5 flex-1">
                <Label htmlFor="dailyDigest">Daily Schedule Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a summary of your schedule each morning
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="dailyDigest"
                  checked={settings.dailyDigest}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, dailyDigest: checked })
                  }
                  data-testid="switch-daily-digest"
                />
                {settings.dailyDigest && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendDigest}
                    disabled={digestMutation.isPending}
                  >
                    {digestMutation.isPending ? "Sending..." : "Send Now"}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notificationTiming">Notification Timing</Label>
              <Select
                value={settings.notificationTiming}
                onValueChange={(value) =>
                  setSettings({ ...settings, notificationTiming: value })
                }
              >
                <SelectTrigger id="notificationTiming" data-testid="select-notification-timing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutes before</SelectItem>
                  <SelectItem value="15">15 minutes before</SelectItem>
                  <SelectItem value="30">30 minutes before</SelectItem>
                  <SelectItem value="60">1 hour before</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Preferences</CardTitle>
            <CardDescription>
              Configure how conflicts are handled
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="studyPriority">Study Events Priority</Label>
                <p className="text-sm text-muted-foreground">
                  Always prioritize study events over personal activities
                </p>
              </div>
              <Switch
                id="studyPriority"
                checked={settings.studyPriority}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, studyPriority: checked })
                }
                data-testid="switch-study-priority"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => console.log("Reset")}>
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} data-testid="button-save-settings">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
