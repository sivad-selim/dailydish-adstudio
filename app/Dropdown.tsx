"use client";

import type { SelectHTMLAttributes } from "react";

type DropdownProps = SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
};

export function Dropdown({
  children,
  className = "",
  wrapperClassName = "",
  ...selectProps
}: DropdownProps) {
  return (
    <span className={`dropdown ${wrapperClassName}`.trim()}>
      <select
        {...selectProps}
        className={`dropdown-select ${className}`.trim()}
      >
        {children}
      </select>
      <span className="dropdown-chevron" aria-hidden="true" />
    </span>
  );
}
