import { Fragment } from "react";
import type { TextColorTone } from "../firebase/postPages";

export type ThemeColorTarget = {
  id: string;
  label: string;
  help: string;
  color: string;
  previewColor?: string;
  tone?: TextColorTone;
  sectionLabel?: string;
};

type ThemeColorControlsProps = {
  colors: string[];
  targets: ThemeColorTarget[];
  activeTarget: string;
  onSelectTarget: (targetId: string) => void;
  onSelectColor: (targetId: string, color: string) => void;
  onSelectTone?: (targetId: string, tone: TextColorTone) => void;
  note?: string;
};

export function ThemeColorControls({
  colors,
  targets,
  activeTarget,
  onSelectTarget,
  onSelectColor,
  onSelectTone,
  note,
}: ThemeColorControlsProps) {
  const selectedTarget =
    targets.find(({ id }) => id === activeTarget) ?? targets[0];
  const selectableColors = Array.from(
    new Set(
      (colors.length ? colors : targets.map(({ color }) => color)).filter(
        Boolean,
      ),
    ),
  );
  const usedColors = new Set(
    targets.map(({ color }) => color.toLowerCase()).filter(Boolean),
  );
  const usedColorCount = selectableColors.filter((color) =>
    usedColors.has(color.toLowerCase()),
  ).length;
  const availableColorCount = selectableColors.length - usedColorCount;

  return (
    <div className="theme-color-controls">
      <div className="background-palette-overview">
        <div className="background-palette-overview-heading">
          <strong>Palette du thème</strong>
          <small>
            {usedColorCount} utilisée{usedColorCount > 1 ? "s" : ""} ·{" "}
            {availableColorCount} disponible
            {availableColorCount > 1 ? "s" : ""}
          </small>
        </div>
        <div
          className="background-palette-usage"
          aria-label="Couleurs utilisées et disponibles"
        >
          {selectableColors.map((color, index) => {
            const used = usedColors.has(color.toLowerCase());
            const selected =
              color.toLowerCase() === selectedTarget?.color.toLowerCase();
            return (
              <button
                key={`${color}-${index}`}
                type="button"
                className={`${used ? "used" : "unused"} ${selected ? "selected" : ""}`}
                aria-pressed={selected}
                disabled={!selectedTarget}
                title={`${color.toUpperCase()} — ${selected ? `sélectionnée pour ${selectedTarget.label}` : used ? "utilisée" : "disponible"}`}
                onClick={() =>
                  selectedTarget && onSelectColor(selectedTarget.id, color)
                }
              >
                <i style={{ background: color }} />
                {selected && <b aria-hidden="true">✓</b>}
              </button>
            );
          })}
        </div>
      </div>

      {note && <p className="background-color-image-note">{note}</p>}

      <div className="background-color-target-list">
        {targets.map((target) => {
          const active = selectedTarget?.id === target.id;
          return (
            <Fragment key={target.id}>
              {target.sectionLabel && (
                <h3 className="theme-color-target-section-title">
                  {target.sectionLabel}
                </h3>
              )}
              <button
                className={`background-color-target ${active ? "active" : ""}`}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectTarget(target.id)}
              >
                <span className="background-color-current">
                  <span
                    className="background-color-preview"
                    style={{ background: target.previewColor ?? target.color }}
                    aria-hidden="true"
                  />
                  <span>
                    <strong>{target.label}</strong>
                    <small>{target.help}</small>
                  </span>
                  <code>
                    {(target.previewColor ?? target.color).toUpperCase()}
                  </code>
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>

      {onSelectTone && selectedTarget?.tone && (
        <div className="theme-color-tone-control">
          <div>
            <strong>Luminosité</strong>
            <small>{selectedTarget.label}</small>
          </div>
          <div role="group" aria-label={`Luminosité de ${selectedTarget.label}`}>
            {(
              [
                ["original", "Original"],
                ["light", "Clair"],
                ["dark", "Foncé"],
              ] as Array<[TextColorTone, string]>
            ).map(([tone, label]) => (
              <button
                key={tone}
                type="button"
                className={selectedTarget.tone === tone ? "selected" : ""}
                aria-pressed={selectedTarget.tone === tone}
                onClick={() => onSelectTone(selectedTarget.id, tone)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
