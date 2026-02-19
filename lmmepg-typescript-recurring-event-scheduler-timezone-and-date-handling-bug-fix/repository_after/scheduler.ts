import { Event, Occurrence, SchedulerOptions } from "./types.js";
import { RecurrenceRule } from "./recurrence.js";

export class Scheduler {
  private options: SchedulerOptions;
  private weekStartsOn: number;

  constructor(options: SchedulerOptions = {}) {
    this.options = options;
    // Requirement 6: Read weekStartsOn from options
    this.weekStartsOn =
      options.weekStartsOn !== undefined ? options.weekStartsOn : 0;
  }

  generateOccurrences(
    event: Event,
    startDate: Date,
    endDate: Date
  ): Occurrence[] {
    const occurrences: Occurrence[] = [];
    // Requirement 9: Default limit of 1000
    const limit = this.options.maxOccurrences || 1000;

    if (!event.recurrence) {
      if (event.startDate >= startDate && event.startDate <= endDate) {
        occurrences.push({
          eventId: event.id,
          date: event.startDate,
          originalDate: event.startDate,
          isException: false,
        });
      }
      return occurrences;
    }

    const recurrence = event.recurrence;
    const rule = new RecurrenceRule(
      recurrence,
      event.startDate,
      event.timezone,
      this.weekStartsOn
    );

    // Requirement 12: Skip ahead
    // Initialize currentDate close to startDate if possible
    let currentDate: Date;

    if (event.startDate < startDate) {
      // Jump logic
      const interval = recurrence.interval;

      if (
        recurrence.frequency === "daily" ||
        recurrence.frequency === "weekly"
      ) {
        // Calculate days diff
        const msPerDay = 24 * 60 * 60 * 1000;
        const diffMs = startDate.getTime() - event.startDate.getTime();
        const diffDays = Math.floor(diffMs / msPerDay);

        const cycles = Math.floor(diffDays / interval);

        // Optimization threshold
        if (cycles > 100) {
          // Conservative jump: 90% of estimated cycles to avoid overshooting
          // due to DST shifts or math approximations.
          const cyclesToSkip = Math.floor(cycles * 0.9);

          if (cyclesToSkip > 0) {
            currentDate = new Date(event.startDate);
            const multiplier = recurrence.frequency === "weekly" ? 7 : 1;
            const totalDaysToAdd = cyclesToSkip * interval * multiplier;

            currentDate.setDate(currentDate.getDate() + totalDaysToAdd);
          } else {
            currentDate = new Date(event.startDate);
          }
        } else {
          currentDate = new Date(event.startDate);
        }
      } else {
        currentDate = new Date(event.startDate);
      }
    } else {
      currentDate = new Date(event.startDate);
    }

    if (!currentDate) currentDate = new Date(event.startDate);

    while (currentDate <= endDate) {
      if (occurrences.length >= limit) break;

      // Check if valid
      if (rule.isValidDay(currentDate)) {
        if (currentDate >= startDate) {
          occurrences.push({
            eventId: event.id,
            date: new Date(currentDate), // Return copy
            originalDate: new Date(currentDate),
            isException: false,
          });
        }
      }

      // Next
      const nextDate = rule.getNextDate(currentDate);
      if (!nextDate) break;
      currentDate = nextDate;
    }

    return occurrences;
  }

  getNextOccurrence(event: Event, afterDate: Date): Occurrence | null {
    // Requirement 7: Return null if no occurrence strictly after.
    // Optimization: don't generate 1000 items if we just need 1.

    // Use a small lookahead logic reusing generateOccurrences
    const queryStart = new Date(afterDate.getTime() + 1);
    const nextYear = new Date(queryStart);
    nextYear.setFullYear(nextYear.getFullYear() + 2); // Look ahead 2 years

    const optionsBackup = this.options.maxOccurrences;
    this.options.maxOccurrences = 1;

    const occurrences = this.generateOccurrences(event, queryStart, nextYear);

    this.options.maxOccurrences = optionsBackup;

    return occurrences.length > 0 ? occurrences[0] : null;
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
    const d = new Date(date);
    const targetMonth = d.getMonth() + months;
    const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
    const newMonth = ((targetMonth % 12) + 12) % 12;

    d.setDate(1);
    d.setFullYear(targetYear);
    d.setMonth(newMonth);

    const originalDay = date.getDate();
    const daysInMonth = new Date(targetYear, newMonth + 1, 0).getDate();
    d.setDate(Math.min(originalDay, daysInMonth));
    return d;
  }
}
