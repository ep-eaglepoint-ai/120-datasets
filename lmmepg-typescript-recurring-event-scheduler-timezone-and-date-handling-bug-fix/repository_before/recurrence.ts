import { RecurrencePattern, RecurrenceFrequency } from './types';

export class RecurrenceRule {
    private pattern: RecurrencePattern;
    private timezoneOffset: number;

    constructor(pattern: RecurrencePattern, timezone: string) {
        this.pattern = pattern;
        this.timezoneOffset = this.calculateTimezoneOffset(timezone);
    }

    private calculateTimezoneOffset(timezone: string): number {
        const now = new Date();
        const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
        return (utcDate.getTime() - tzDate.getTime()) / (1000 * 60);
    }

    getNextDate(currentDate: Date): Date | null {
        const next = new Date(currentDate);

        switch (this.pattern.frequency) {
            case 'daily':
                next.setTime(next.getTime() + 24 * 60 * 60 * 1000 * this.pattern.interval);
                break;

            case 'weekly':
                next.setTime(next.getTime() + 7 * 24 * 60 * 60 * 1000 * this.pattern.interval);
                break;

            case 'monthly':
                next.setMonth(next.getMonth() + this.pattern.interval);
                if (this.pattern.dayOfMonth) {
                    next.setDate(this.pattern.dayOfMonth);
                }
                break;

            case 'yearly':
                next.setFullYear(next.getFullYear() + this.pattern.interval);
                break;
        }

        if (this.pattern.endDate && next > this.pattern.endDate) {
            return null;
        }

        return next;
    }

    isValidDay(date: Date): boolean {
        if (this.pattern.frequency === 'weekly' && this.pattern.daysOfWeek) {
            return this.pattern.daysOfWeek.includes(date.getDay());
        }
        return true;
    }

    adjustForTimezone(date: Date): Date {
        const adjusted = new Date(date);
        adjusted.setMinutes(adjusted.getMinutes() + this.timezoneOffset);
        return adjusted;
    }
}

