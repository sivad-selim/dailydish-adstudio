import { useEffect, useRef } from "react";
import type { FormatChangeAnchor } from "../imagePositioning";
import { Button } from "./Button";

export function FormatChangeDialog({ from, to, onChoose, onCancel }: {
  from: string;
  to: string;
  onChoose: (anchor: FormatChangeAnchor) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="format-change-dialog" aria-labelledby="format-change-title" aria-describedby="format-change-description" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    <h2 id="format-change-title">Changer de format</h2>
    <p>{from} → {to}</p>
    <p id="format-change-description">Choisis l’ancrage des images pour appliquer le changement.</p>
    <div className="format-change-anchors">
      {([["top", "Haut"], ["center", "Centre"], ["bottom", "Bas"]] as const).map(([anchor, label]) =>
        <Button key={anchor} variant="primary" autoFocus={anchor === "center"} onClick={() => onChoose(anchor)}>{label}</Button>,
      )}
    </div>
    <Button className="format-change-cancel" onClick={onCancel}>Annuler</Button>
  </dialog>;
}
