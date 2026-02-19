import { RecurrencePattern } from "./types.js";

export class RecurrenceRule {
  private pattern: RecurrencePattern;
  private startDate: Date;
  private timezone: string;
  private weekStartsOn: number;

  constructor(
    pattern: RecurrencePattern,
    startDate: Date,
    timezone: string,
    weekStartsOn: number = 0
  ) {
    this.pattern = pattern;
    this.startDate = startDate;
    this.timezone = timezone;
    this.weekStartsOn = weekStartsOn;
    this.validateTimezone(timezone);
  }

  private validateTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch (e) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }
  }

  getNextDate(currentDate: Date): Date | null {
    // Special handling for weekly with daysOfWeek
    if (
      this.pattern.frequency === "weekly" &&
      this.pattern.daysOfWeek &&
      this.pattern.daysOfWeek.length > 0
    ) {
      const nextDate = this.getNextWeeklyDate(currentDate);
      if (this.pattern.endDate) {
        const endParts = this.getZonedParts(this.pattern.endDate);
        const nextParts = this.getZonedParts(nextDate);
        const endDateValue =
          endParts.year * 10000 + endParts.month * 100 + endParts.day;
        const nextDateValue =
          nextParts.year * 10000 + nextParts.month * 100 + nextParts.day;
        if (nextDateValue > endDateValue) return null;
      }
      return nextDate;
    }

    // 1. Get current date parts in the target timezone
    const parts = this.getZonedParts(currentDate);

    // 2. Increment
    let { year, month, day, hour, minute, second } = parts;

    switch (this.pattern.frequency) {
      case "daily":
        day += this.pattern.interval;
        break;
      case "weekly":
        day += this.pattern.interval * 7;
        break;
      case "monthly":
        month += this.pattern.interval;
        break;
      case "yearly":
        year += this.pattern.interval;
        break;
    }

    let nextDate: Date;

    if (
      this.pattern.frequency === "monthly" ||
      this.pattern.frequency === "yearly"
    ) {
      // Stateless Day Logic:
      // Target Day is either pattern.dayOfMonth OR startDate's day
      let targetDay = this.pattern.dayOfMonth;
      if (!targetDay) {
        const startParts = this.getZonedParts(this.startDate);
        targetDay = startParts.day;
      }

      // Check if we are "recovering" the day (Snap back)
      // If we just added to Month, 'day' (variable) is currently the *previous* occurrence's day.
      // We want to force it to targetDay, then clamp.

      day = targetDay;

      const safeDate = this.constructSafeDate(
        year,
        month,
        day,
        hour,
        minute,
        second
      );
      nextDate = safeDate;
    } else {
      // Daily/Weekly
      nextDate = this.createDateFromParts({
        year,
        month,
        day,
        hour,
        minute,
        second,
      });
    }

    // Check End Date
    if (this.pattern.endDate) {
      const endParts = this.getZonedParts(this.pattern.endDate);
      const nextParts = this.getZonedParts(nextDate);

      // Lexicographical comparison of YYYYMMDD
      const endDateValue =
        endParts.year * 10000 + endParts.month * 100 + endParts.day;
      const nextDateValue =
        nextParts.year * 10000 + nextParts.month * 100 + nextParts.day;

      // Requirement 5: inclusive comparison. If nextDate > endDate, stop.
      if (nextDateValue > endDateValue) {
        return null;
      }
    }

    return nextDate;
  }

  private getNextWeeklyDate(currentDate: Date): Date {
    const currentZoned = this.getZonedParts(currentDate);
    const currentDw = this.getZonedDayOfWeek(currentDate);
    const daysOfWeek = this.pattern.daysOfWeek || [];

    // Normalize day index based on weekStartsOn
    const normalize = (d: number) => (d - this.weekStartsOn + 7) % 7;
    const currentIdx = normalize(currentDw);

    // Sort based on normalized index
    const sortedDays = [...daysOfWeek].sort(
      (a, b) => normalize(a) - normalize(b)
    );

    // Find next day in current week
    let nextDayDiff = -1;
    for (const dw of sortedDays) {
      const idx = normalize(dw);
      if (idx > currentIdx) {
        nextDayDiff = idx - currentIdx;
        break;
      }
    }

    // Helper to reconstruct
    const reconstruct = (addDays: number) => {
      let { year, month, day, hour, minute, second } = currentZoned;
      day += addDays;
      return this.createDateFromParts({
        year,
        month,
        day,
        hour,
        minute,
        second,
      });
    };

    if (nextDayDiff !== -1) {
      return reconstruct(nextDayDiff);
    }

    // Next interval
    const firstDw = sortedDays[0];
    const firstIdx = normalize(firstDw);

    // Jump: (remainder of current week) + (interval-1)*7 + (index in next week)
    const jumpDays =
      7 - currentIdx + (this.pattern.interval - 1) * 7 + firstIdx;

    return reconstruct(jumpDays);
  }

  isValidDay(date: Date): boolean {
    if (this.pattern.frequency === "weekly" && this.pattern.daysOfWeek) {
      const dayOfWeek = this.getZonedDayOfWeek(date);
      return this.pattern.daysOfWeek.includes(dayOfWeek);
    }
    return true;
  }

  // --- Helper Methods ---

  private getZonedParts(date: Date) {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: this.timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const getPart = (type: string) =>
      parseInt(parts.find((p) => p.type === type)?.value || "0", 10);
    return {
      year: getPart("year"),
      month: getPart("month"),
      day: getPart("day"),
      hour: getPart("hour"),
      minute: getPart("minute"),
      second: getPart("second"),
    };
  }

  private getZonedDayOfWeek(date: Date): number {
    // Intl weekday: 'narrow' -> S, M, T... ambiguous.
    // Helper: Create a UTC date from the Zoned Year-Month-Day and getUTCDay()
    // This effectively treats the Zoned Date as a UTC Date to check the day of week.
    const parts = this.getZonedParts(date);
    const checkDate = new Date(
      Date.UTC(parts.year, parts.month - 1, parts.day)
    );
    return checkDate.getUTCDay();
  }

  private createDateFromParts(parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  }): Date {
    // Approximation helper
    const utcDate = new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
      )
    );
    let guess = utcDate.getTime();

    for (let i = 0; i < 3; i++) {
      const zonedParts = this.getZonedParts(new Date(guess));
      const zonedAsUtc = Date.UTC(
        zonedParts.year,
        zonedParts.month - 1,
        zonedParts.day,
        zonedParts.hour,
        zonedParts.minute,
        zonedParts.second
      );
      const diff = utcDate.getTime() - zonedAsUtc;
      if (diff === 0) return new Date(guess);
      guess += diff;
    }
    return new Date(guess);
  }

  private constructSafeDate(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number
  ): Date {
    const targetDate = new Date(Date.UTC(year, month - 1, 1));
    const finalYear = targetDate.getUTCFullYear();
    const finalMonth = targetDate.getUTCMonth();
    const daysInMonth = new Date(
      Date.UTC(finalYear, finalMonth + 1, 0)
    ).getUTCDate();

    // Clamp day
    const clampedDay = Math.min(day, daysInMonth);

    return this.createDateFromParts({
      year: finalYear,
      month: finalMonth + 1,
      day: clampedDay,
      hour,
      minute,
      second,
    });
  }

  adjustForTimezone(date: Date): Date {
    // No-op in new logic, returning date is enough as it is already the correct timestamp
    return new Date(date);
  }
}
