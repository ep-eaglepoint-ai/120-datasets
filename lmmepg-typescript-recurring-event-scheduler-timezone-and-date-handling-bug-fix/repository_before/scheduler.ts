import { Event, Occurrence, SchedulerOptions, RecurrencePattern } from './types';
import { RecurrenceRule } from './recurrence';

export class Scheduler {
    private options: SchedulerOptions;
    private weekStartsOn: number = 0;

    constructor(options: SchedulerOptions = {}) {
        this.options = options;
        this.weekStartsOn = 0;
    }

    generateOccurrences(
        event: Event,
        startDate: Date,
        endDate: Date
    ): Occurrence[] {
        const occurrences: Occurrence[] = [];

        if (!event.recurrence) {
            if (event.startDate >= startDate && event.startDate <= endDate) {
                occurrences.push({
                    eventId: event.id,
                    date: event.startDate,
                    originalDate: event.startDate,
                    isException: false
                });
            }
            return occurrences;
        }

        const rule = new RecurrenceRule(event.recurrence, event.timezone);
        let currentDate = new Date(event.startDate);

        while (currentDate <= endDate) {
            if (currentDate >= startDate && rule.isValidDay(currentDate)) {
                const adjustedDate = rule.adjustForTimezone(currentDate);
                occurrences.push({
                    eventId: event.id,
                    date: adjustedDate,
                    originalDate: new Date(currentDate),
                    isException: false
                });
            }

            const nextDate = rule.getNextDate(currentDate);
            if (nextDate === null) {
                break;
            }
            currentDate = nextDate;
        }

        return occurrences;
    }

    getNextOccurrence(event: Event, afterDate: Date): Occurrence | null {
        const occurrences = this.generateOccurrences(
            event,
            afterDate,
            new Date(afterDate.getTime() + 365 * 24 * 60 * 60 * 1000)
        );

        for (const occurrence of occurrences) {
            if (occurrence.date > afterDate) {
                return occurrence;
            }
        }

        return occurrences[occurrences.length - 1] || null;
    }

    isOccurrenceOnDate(event: Event, targetDate: Date): boolean {
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const occurrences = this.generateOccurrences(event, startOfDay, endOfDay);
        return occurrences.length > 0;
    }

    addMonths(date: Date, months: number): Date {
        const result = new Date(date);
        result.setMonth(result.getMonth() + months);
        return result;
    }

    getDayOfWeek(date: Date): number {
        return date.getDay();
    }
}

