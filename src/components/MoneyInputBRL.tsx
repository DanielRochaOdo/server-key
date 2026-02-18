import React, { useMemo } from "react";

type Props = {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showPlaceholderWhenZero?: boolean;
};

function formatBRLFromCents(cents: number) {
  const n = cents / 100;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

export default function MoneyInputBRL({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  showPlaceholderWhenZero,
}: Props) {
  const cents = useMemo(() => Math.round((Number(value || 0)) * 100), [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={showPlaceholderWhenZero && cents === 0 ? "" : formatBRLFromCents(cents)}
      onChange={(e) => {
        const digits = onlyDigits(e.target.value);
        const newCents = Number(digits || 0);
        onChange(newCents / 100);
      }}
    />
  );
}
