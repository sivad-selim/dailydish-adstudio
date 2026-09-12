"use client";
import { Button } from "./components/Button";

import { useRef, useState } from "react";
import { SectionHeading } from "./SectionHeading";
import { Dropdown } from "./Dropdown";
import { instagramConnectionError, verifyInstagramConnection, type InstagramAccount, type InstagramConnection as Connection } from "../firebase/instagram";

export function InstagramConnection() {
  const [account, setAccount] = useState<InstagramAccount>("fr");
  const [connections, setConnections] = useState<Partial<Record<InstagramAccount, Connection>>>({});
  const [errors, setErrors] = useState<Partial<Record<InstagramAccount, string>>>({});
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const current = connections[account];
  async function check() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setErrors((old) => ({ ...old, [account]: undefined }));
    setConnections((old) => ({ ...old, [account]: undefined }));
    try {
      const result = await verifyInstagramConnection(account);
      setConnections((old) => ({ ...old, [account]: result }));
    } catch (error) {
      setErrors((old) => ({ ...old, [account]: instagramConnectionError(error) }));
    } finally { pending.current = false; setBusy(false); }
  }
  return <section className="planner-instagram" aria-label="Connexion Instagram">
    <SectionHeading><h3>Instagram</h3></SectionHeading>
    <div className="planner-toolbar">
      <Dropdown aria-label="Compte Instagram à vérifier" value={account} disabled={busy} onChange={(event) => setAccount(event.target.value as InstagramAccount)}>
        <option value="en">EN · @mydailydishapp</option>
        <option value="fr">FR · @mydailydishapp.fr</option>
        <option value="br">BR · @mydailydishapp.br</option>
      </Dropdown>
      <Button variant="primary" type="button" className="planner-verify-instagram" disabled={busy} onClick={() => void check()}>{busy ? "Vérification…" : "Vérifier la connexion"}</Button>
    </div>
    <p className="planner-help" role="status">{current ? `Connexion vérifiée pour @${current.username} à ${new Date(current.checkedAt).toLocaleTimeString("fr-FR")}.` : "Vérifie l’accès à chaque compte Instagram en cas de problème de connexion."} Cette vérification ne publie aucun contenu.</p>
    {errors[account] && <p className="planner-error" role="alert">{errors[account]}</p>}
  </section>;
}
