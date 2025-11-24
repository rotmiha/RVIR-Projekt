import { StatCard } from "../stat-card";
import { Calendar, Clock, AlertTriangle, Users } from "lucide-react";

export default function StatCardExample() {
  return (
    <div className="p-6 bg-background">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Events"
          value={42}
          icon={Calendar}
          description="This week"
        />
        <StatCard
          title="Study Hours"
          value="28.5"
          icon={Clock}
          description="This week"
        />
        <StatCard
          title="Conflicts"
          value={3}
          icon={AlertTriangle}
          description="Need attention"
        />
        <StatCard
          title="Active Users"
          value={1}
          icon={Users}
          description="Logged in"
        />
      </div>
    </div>
  );
}
