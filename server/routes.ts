import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema } from "@shared/schema";
import multer from "multer";
import { emailService } from "./services/email";

const upload = multer({ storage: multer.memoryStorage() });

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Get all events for the default user
  app.get("/api/events", async (_req, res) => {
    try {
      const events = await storage.getEventsByUserId("default-user-id");
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // Get events within a date range
  app.get("/api/events/range", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      const events = await storage.getEventsByUserIdAndDateRange(
        "default-user-id",
        start,
        end
      );
      res.json(events);
    } catch (error) {
      console.error("Error fetching events by range:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // Get a single event by ID
  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

 app.post("/api/events", async (req, res) => {
  try {
    console.log("POST /api/events - body:", req.body);

    const startTime = new Date(req.body.startTime);
    const endTime = new Date(req.body.endTime);

    if (isNaN(startTime.getTime())) {
      return res.status(400).json({ error: "Invalid startTime format" });
    }
    if (isNaN(endTime.getTime())) {
      return res.status(400).json({ error: "Invalid endTime format" });
    }
    if (startTime >= endTime) {
      return res.status(400).json({ error: "Event end time must be after start time" });
    }

    console.log("POST /api/events - dates OK");

    const validatedData = insertEventSchema.parse({
      ...req.body,
      userId: "default-user-id",
      startTime,
      endTime,
    });

    console.log("POST /api/events - zod OK, calling storage.createEvent...");

    const event = await storage.createEvent(validatedData);

    console.log("POST /api/events - storage.createEvent DONE");

    return res.status(201).json(event);
  } catch (error: any) {
    console.error("Error creating event:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid event data", details: error.errors });
    }
    return res.status(500).json({ error: "Failed to create event" });
  }
});


  // Update an event
  app.put("/api/events/:id", async (req, res) => {
    try {
      // Prevent updating immutable fields
      const { userId, source, ...updateData } = req.body;
      
      // Build update object with validated dates
      const updates: any = {};
      
      if (updateData.title !== undefined) updates.title = updateData.title;
      if (updateData.type !== undefined) {
        if (updateData.type !== 'study' && updateData.type !== 'personal') {
          return res.status(400).json({ error: "Invalid event type" });
        }
        updates.type = updateData.type;
      }
      if (updateData.location !== undefined) updates.location = updateData.location;
      if (updateData.description !== undefined) updates.description = updateData.description;
      
      // Validate and convert dates
      if (updateData.startTime) {
        const startTime = new Date(updateData.startTime);
        if (isNaN(startTime.getTime())) {
          return res.status(400).json({ error: "Invalid startTime format" });
        }
        updates.startTime = startTime;
      }
      
      if (updateData.endTime) {
        const endTime = new Date(updateData.endTime);
        if (isNaN(endTime.getTime())) {
          return res.status(400).json({ error: "Invalid endTime format" });
        }
        updates.endTime = endTime;
      }

      // Get existing event to check temporal validity
      const existingEvent = await storage.getEvent(req.params.id);
      if (!existingEvent) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Validate that startTime < endTime
      const finalStartTime = updates.startTime || existingEvent.startTime;
      const finalEndTime = updates.endTime || existingEvent.endTime;
      
      if (finalStartTime >= finalEndTime) {
        return res.status(400).json({ error: "Event end time must be after start time" });
      }

      const event = await storage.updateEvent(req.params.id, updates);
      res.json(event);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  // Delete an event
  app.delete("/api/events/:id", async (req, res) => {
    try {
      const success = await storage.deleteEvent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  // Get conflicts for the default user
  app.get("/api/conflicts", async (_req, res) => {
    try {
      const events = await storage.getEventsByUserId("default-user-id");
      
      // Find overlapping events
      const conflicts: any[] = [];
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          const event1 = events[i];
          const event2 = events[j];
          
          // Check if events overlap
          if (event1.startTime < event2.endTime && event1.endTime > event2.startTime) {
            // Determine which event takes priority (study > personal)
            const priority = event1.type === 'study' ? event1 : event2;
            const deprioritized = event1.type === 'study' ? event2 : event1;
            
            conflicts.push({
              id: `${event1.id}-${event2.id}`,
              event1,
              event2,
              priority: priority.id,
              resolution: priority.type === 'study' 
                ? "Study event takes priority. Personal event will be skipped."
                : "Both events have same priority. Manual resolution required.",
            });
          }
        }
      }
      
      res.json(conflicts);
    } catch (error) {
      console.error("Error detecting conflicts:", error);
      res.status(500).json({ error: "Failed to detect conflicts" });
    }
  });

  // Upload and parse ICS file (limit to 5MB)
  const uploadLimited = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === 'text/calendar' || file.originalname.endsWith('.ics')) {
        cb(null, true);
      } else {
        cb(new Error('Only .ics calendar files are allowed'));
      }
    }
  });

  app.post("/api/import/ics", uploadLimited.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ical = await import('node-ical');
      const fileContent = req.file.buffer.toString('utf-8');
      const parsed = ical.parseICS(fileContent);

      const events: any[] = [];
      for (const k in parsed) {
        const event = parsed[k];
        if (event.type === 'VEVENT') {
          events.push({
            title: event.summary || 'Untitled Event',
            startTime: event.start,
            endTime: event.end,
            location: event.location || null,
            description: event.description || null,
          });
        }
      }

      res.json({ 
        success: true, 
        eventsFound: events.length,
        events 
      });
    } catch (error) {
      console.error("Error parsing ICS file:", error);
      res.status(500).json({ error: "Failed to parse ICS file" });
    }
  });

  // Import parsed events into the database
  app.post("/api/import/events", async (req, res) => {
    try {
      const { events } = req.body;
      
      if (!Array.isArray(events)) {
        return res.status(400).json({ error: "Events must be an array" });
      }

      const importedEvents = [];
      for (const eventData of events) {
        const validatedData = insertEventSchema.parse({
          userId: "default-user-id",
          title: eventData.title,
          type: eventData.type || 'study', // Default to study for imported events
          startTime: new Date(eventData.startTime),
          endTime: new Date(eventData.endTime),
          location: eventData.location,
          description: eventData.description,
          source: 'imported',
        });

        const event = await storage.createEvent(validatedData);
        importedEvents.push(event);
      }

      res.status(201).json({ 
        success: true, 
        imported: importedEvents.length,
        events: importedEvents 
      });
    } catch (error: any) {
      console.error("Error importing events:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to import events" });
    }
  });

  // Send test email
  app.post("/api/notifications/test", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }

      const success = await emailService.sendTestEmail(email);
      
      if (success) {
        res.json({ success: true, message: "Test email sent successfully" });
      } else {
        res.status(500).json({ error: "Failed to send test email. Check server logs." });
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ error: "Failed to send test email" });
    }
  });

  // Send conflict notification
  app.post("/api/notifications/conflict", async (req, res) => {
    try {
      const { email, event1Id, event2Id } = req.body;
      
      if (!email || !event1Id || !event2Id) {
        return res.status(400).json({ error: "Email, event1Id, and event2Id are required" });
      }

      const event1 = await storage.getEvent(event1Id);
      const event2 = await storage.getEvent(event2Id);

      if (!event1 || !event2) {
        return res.status(404).json({ error: "One or both events not found" });
      }

      const success = await emailService.sendConflictNotification({
        to: email,
        event1: {
          title: event1.title,
          startTime: event1.startTime,
          endTime: event1.endTime,
          location: event1.location,
        },
        event2: {
          title: event2.title,
          startTime: event2.startTime,
          endTime: event2.endTime,
          location: event2.location,
        },
      });

      if (success) {
        res.json({ success: true, message: "Conflict notification sent" });
      } else {
        res.status(500).json({ error: "Failed to send notification" });
      }
    } catch (error) {
      console.error("Error sending conflict notification:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Send daily digest
  app.post("/api/notifications/digest", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }

      // Get today's events
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const events = await storage.getEventsByUserIdAndDateRange(
        "default-user-id",
        today,
        tomorrow
      );

      const success = await emailService.sendDailyDigest(email, events);

      if (success) {
        res.json({ success: true, message: "Daily digest sent", eventCount: events.length });
      } else {
        res.status(500).json({ error: "Failed to send digest" });
      }
    } catch (error) {
      console.error("Error sending daily digest:", error);
      res.status(500).json({ error: "Failed to send digest" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
