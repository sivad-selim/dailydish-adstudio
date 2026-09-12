"use client";

import { Icon } from "./components/Icon";
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
      <Icon name="expand_more" className="dropdown-chevron" />
    </span>
  );
}
