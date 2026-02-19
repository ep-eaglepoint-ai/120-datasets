export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrencePattern {
    frequency: RecurrenceFrequency;
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
    endDate?: Date;
    count?: number;
}

export interface Event {
    id: string;
    title: string;
    startDate: Date;
    startTime: string;
    timezone: string;
    recurrence?: RecurrencePattern;
}

export interface Occurrence {
    eventId: string;
    date: Date;
    originalDate: Date;
    isException: boolean;
}

export interface SchedulerOptions {
    maxOccurrences?: number;
    weekStartsOn?: number; // 0 = Sunday, 1 = Monday, etc.
}
