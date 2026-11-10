import { useEffect, useRef, useState } from "react";
export function NumberField({
  label,
  value,
  onSave,
  min = -100000,
  max = 100000,
  step = 1,
  disabled = false,
}: {
  label: string;
  value: number;
  onSave: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(String(value));
  }, [value]);
  return (
    <label>
      {label}
      <input
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onBlur={(e) => {
          editing.current = false;
          const number = Number(draft);
          if (
            draft !== "" &&
            e.currentTarget.validity.valid &&
            Number.isFinite(number) &&
            number !== value
          )
            onSave(number);
          else setDraft(String(value));
        }}
      />
    </label>
  );
}
export function TextField({
  label,
  value,
  onSave,
  maxLength = 80,
  disabled = false,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  return (
    <label>
      {label}
      <input
        value={draft}
        maxLength={maxLength}
        disabled={disabled}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onBlur={() => {
          editing.current = false;
          if (draft.trim() !== value) onSave(draft.trim());
        }}
      />
    </label>
  );
}
