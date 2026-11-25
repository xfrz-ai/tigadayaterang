"use client";
import { useEffect, useState } from "react";
import { OPENING_HOURS, TIME_ZONE } from "@/lib/site";

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const dateFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const clockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Today's date, the time now and whether the office is open, in Jakarta time. */
function jakartaNow(now: Date) {
  const parts = clockFormat.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const hours = OPENING_HOURS[WEEKDAY[get("weekday")] ?? 0];
  return {
    // "Rabu, 25 November 2026"
    date: dateFormat.format(now),
    // "14.32"
    time: timeFormat.format(now).replace(":", "."),
    open:
      !!hours &&
      minutes >= toMinutes(hours[0]) &&
      minutes < toMinutes(hours[1]),
  };
}

/**
 * Today's date and the time now in Jakarta, with an "Buka" mark while the
 * office is open. Worked out in the browser after mounting (it depends on
 * when the page is viewed) and updated as each minute turns.
 */
export default function TodayHours({ className }: { className?: string }) {
  const [now, setNow] = useState<ReturnType<typeof jakartaNow> | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const date = new Date();
      setNow(jakartaNow(date));
      // Next update just after the minute changes.
      timer = setTimeout(tick, 60_000 - (date.getTime() % 60_000) + 50);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return (
    <p className={`today-hours ${className ?? ""}`}>
      <span className="today-hours-day">{now?.date ?? " "}</span>
      <span className="today-hours-time">
        {now ? (
          <>
            <time>{now.time} WIB</time>
            {now.open && <span className="today-hours-status">Buka</span>}
          </>
        ) : (
          " "
        )}
      </span>
    </p>
  );
}
