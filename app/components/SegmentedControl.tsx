import type {ReactNode} from "react";

type Props<Value extends string> = {
  label: string;
  value: Value;
  options: readonly {id: Value; label: ReactNode; className?: string}[];
  onChange: (value: Value) => void;
  disabled?: boolean;
  stretch?: boolean;
  as?: "div" | "nav";
  className?: string;
};

export function SegmentedControl<Value extends string>({label, value, options, onChange,
  disabled = false, stretch = false, as: Container = "div", className = ""}: Props<Value>) {
  return <Container aria-label={label} role={Container === "div" ? "group" : undefined}
    className={`studio-segmented-control ${stretch ? "studio-segmented-control-stretch" : ""} ${className}`.trim()}>
    {options.map((option) => <button key={option.id} type="button" disabled={disabled}
      className={`${value === option.id ? "selected" : ""} ${option.className ?? ""}`.trim()}
      aria-pressed={value === option.id} onClick={() => onChange(option.id)}>
      {option.label}
    </button>)}
  </Container>;
}
