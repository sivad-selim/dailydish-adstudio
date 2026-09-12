import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import Home from "../app/page";
import { allowedEmail, firebaseAuth } from "./firebaseAuth";

type AccessStatus = "loading" | "signedOut" | "ready" | "denied";

const normalizeEmail = (email: string | null | undefined) =>
  email?.trim().toLowerCase() ?? "";

export function AuthGate() {
  const [status, setStatus] = useState<AccessStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth, (nextUser) => {
        setUser(nextUser);
        setErrorMessage("");

        if (!nextUser) {
          setStatus("signedOut");
          return;
        }

        setStatus(
          normalizeEmail(nextUser.email) === allowedEmail ? "ready" : "denied",
        );
      }),
    [],
  );

  const connectWithGoogle = async () => {
    setIsSigningIn(true);
    setErrorMessage("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        login_hint: allowedEmail,
        prompt: "select_account",
      });
      await signInWithPopup(firebaseAuth, provider);
    } catch (error: unknown) {
      if (
        error instanceof FirebaseError &&
        error.code === "auth/popup-closed-by-user"
      ) {
        return;
      }
      setErrorMessage(
        "La connexion Google n’a pas abouti. Réessaie dans quelques instants.",
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const disconnect = async () => {
    setErrorMessage("");
    await signOut(firebaseAuth);
  };

  if (status === "ready") {
    return (
      <Home
        accountEmail={user?.email ?? allowedEmail}
        onSignOut={() => void disconnect()}
      />
    );
  }

  return (
    <main className="auth-gate">
      <div className="auth-orb auth-orb-green" />
      <div className="auth-orb auth-orb-purple" />
      <section className="auth-card" aria-live="polite">
        <img src="/brand/logo-transparent.png" alt="" />
        <p className="auth-eyebrow">DailyDish</p>
        <h1>Ad Studio</h1>

        {status === "loading" ? (
          <p className="auth-message">Vérification de ton accès…</p>
        ) : status === "denied" ? (
          <>
            <p className="auth-message">
              Le compte <strong>{user?.email}</strong> n’est pas autorisé à
              accéder à ce studio.
            </p>
            <button className="auth-secondary-button" onClick={disconnect}>
              Utiliser un autre compte
            </button>
          </>
        ) : (
          <>
            <p className="auth-message">
              Connecte-toi avec le compte Google DailyDish pour ouvrir le
              studio publicitaire.
            </p>
            <button
              className="auth-google-button"
              type="button"
              disabled={isSigningIn}
              onClick={connectWithGoogle}
            >
              {isSigningIn ? "Connexion…" : "Continuer avec Google"}
            </button>
          </>
        )}

        {errorMessage && <p className="auth-error">{errorMessage}</p>}
        <small>Accès réservé à {allowedEmail}</small>
      </section>
    </main>
  );
}
