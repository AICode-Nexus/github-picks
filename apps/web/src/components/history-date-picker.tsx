"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export interface HistoryDatePickerProps {
  dates: string[];
  currentDate?: string | undefined;
  basePath?: string | undefined;
  compact?: boolean;
}

export function HistoryDatePicker({
  dates,
  currentDate,
  basePath = "",
  compact = false,
}: HistoryDatePickerProps) {
  const [selectedDate, setSelectedDate] = useState(
    currentDate ?? dates[0] ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dates.includes(selectedDate)) {
      setError("这个日期尚无已存档的实时日报");
      return;
    }
    const normalizedBasePath = basePath.replace(/\/$/, "");
    window.location.assign(`${normalizedBasePath}/history/${selectedDate}/`);
  }

  return (
    <form
      className={`history-date-picker${compact ? " history-date-picker--compact" : ""}`}
      onSubmit={handleSubmit}
    >
      <label htmlFor="history-date">选择已存档日期</label>
      <div>
        <select
          id="history-date"
          value={selectedDate}
          onChange={(event) => {
            setSelectedDate(event.target.value);
            setError(null);
          }}
        >
          {dates.map((date) => (
            <option value={date} key={date}>
              {date}
            </option>
          ))}
        </select>
        <button type="submit">打开日报</button>
      </div>
      {error ? <p role="status">{error}</p> : null}
    </form>
  );
}
