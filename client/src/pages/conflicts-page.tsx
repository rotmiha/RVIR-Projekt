import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, MapPin, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function ConflictsPage() {
  const { data: conflicts = [], isLoading } = useQuery({
    queryKey: ['/api/conflicts'],
    queryFn: () => api.getConflicts(),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">Konflikti</h1>
        <p className="text-muted-foreground mt-1">
          Odpravite prekrivajoče se dogodke (učni dogodki imajo vedno prednost)
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Nalaganje konfliktov...</p>
          </CardContent>
        </Card>
      ) : conflicts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-accent p-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">Brez konfliktov</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Vaš urnik je brez konfliktov. Vsi dogodki so pravilno razporejeni brez prekrivanj.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {conflicts.map((conflict) => (
            <Card key={conflict.id} className="border-l-4 border-l-destructive" data-testid={`card-conflict-${conflict.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Konflikt zaznan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={conflict.event1.type === "study" ? "default" : "secondary"}>
                        {conflict.event1.type}
                      </Badge>
                      <h3 className="font-medium" data-testid={`text-conflict-event1-${conflict.id}`}>{conflict.event1.title}</h3>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(conflict.event1.startTime), "EEEE, MMMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          {format(new Date(conflict.event1.startTime), "HH:mm")} -{" "}
                          {format(new Date(conflict.event1.endTime), "HH:mm")}
                        </span>
                      </div>
                      {conflict.event1.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{conflict.event1.location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={conflict.event2.type === "study" ? "default" : "secondary"}>
                        {conflict.event2.type}
                      </Badge>
                      <h3 className="font-medium" data-testid={`text-conflict-event2-${conflict.id}`}>{conflict.event2.title}</h3>
                    </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(conflict.event2.startTime), "EEEE, MMMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          {format(new Date(conflict.event2.startTime), "HH:mm")} -{" "}
                          {format(new Date(conflict.event2.endTime), "HH:mm")}
                        </span>
                      </div>
                      {conflict.event2.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{conflict.event2.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-accent p-4">
                  <p className="text-sm">
                    <span className="font-medium">Rešitev: </span>
                    {conflict.resolution}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => console.log("Edit event 1")}
                    data-testid={`button-edit-event1-${conflict.id}`}
                  >
                    Uredi {conflict.event1.title}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => console.log("Edit event 2")}
                    data-testid={`button-edit-event2-${conflict.id}`}
                  >
                    Uredi {conflict.event2.title}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
