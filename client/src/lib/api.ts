import { Event } from "@shared/schema";

export interface ConflictPair {
  id: string;
  event1: Event;
  event2: Event;
  priority: string;
  resolution: string;
}

export interface ParsedICSEvent {
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
}

export interface ICSParseResponse {
  success: boolean;
  eventsFound: number;
  events: ParsedICSEvent[];
}

export interface ImportEventsResponse {
  success: boolean;
  imported: number;
  events: Event[];
}

// API client functions
export const api = {
  // Events
  async getEvents(): Promise<Event[]> {
    const response = await fetch('/api/events');
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  },

  async getEventsByRange(startDate: Date, endDate: Date): Promise<Event[]> {
    const params = new URLSearchParams({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });
    const response = await fetch(`/api/events/range?${params}`);
    if (!response.ok) throw new Error('Failed to fetch events');
    return response.json();
  },

  async getEvent(id: string): Promise<Event> {
    const response = await fetch(`/api/events/${id}`);
    if (!response.ok) throw new Error('Event not found');
    return response.json();
  },

  async createEvent(event: {
    title: string;
    type: 'study' | 'personal';
    startTime: string;
    endTime: string;
    location?: string;
    description?: string;
  }): Promise<Event> {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create event');
    }
    return response.json();
  },

  async updateEvent(id: string, updates: Partial<{
    title: string;
    type: 'study' | 'personal';
    startTime: string;
    endTime: string;
    location?: string;
    description?: string;
  }>): Promise<Event> {
    const response = await fetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update event');
    }
    return response.json();
  },

  async deleteEvent(id: string): Promise<void> {
    const response = await fetch(`/api/events/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete event');
  },

  // Conflicts
  async getConflicts(): Promise<ConflictPair[]> {
    const response = await fetch('/api/conflicts');
    if (!response.ok) throw new Error('Failed to fetch conflicts');
    return response.json();
  },

  // Import
  async parseICSFile(file: File): Promise<ICSParseResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/import/ics', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to parse ICS file');
    }
    return response.json();
  },

  async importEvents(events: Array<{
    title: string;
    type?: 'study' | 'personal';
    startTime: string;
    endTime: string;
    location?: string;
    description?: string;
  }>): Promise<ImportEventsResponse> {
    const response = await fetch('/api/import/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to import events');
    }
    return response.json();
  },

  // Notifications
  async sendTestEmail(email: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send test email');
    }
    return response.json();
  },

  async sendDailyDigest(email: string): Promise<{ success: boolean; message: string; eventCount: number }> {
    const response = await fetch('/api/notifications/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send daily digest');
    }
    return response.json();
  },
};
