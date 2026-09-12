import type { ButtonHTMLAttributes } from "react";

export function Button({ variant = "secondary", className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return <button {...props} type={type} className={`studio-button studio-button-${variant} ${className}`.trim()} />;
}
