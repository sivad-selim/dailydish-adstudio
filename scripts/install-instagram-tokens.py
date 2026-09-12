#!/usr/bin/env python3
"""Read secrets without echo and send directly to Firebase Secret Manager."""
import getpass
import json
import shutil
import subprocess
import sys
import tempfile
import warnings


def main():
    if not sys.stdin.isatty():
        sys.exit("Ouvre ce script dans ton terminal interactif.")
    if not shutil.which("firebase"):
        sys.exit("La commande firebase doit être installée et connectée à ton compte Google.")
    warnings.simplefilter("error", getpass.GetPassWarning)
    print("Installation des tokens dans Firebase Secret Manager (daily-dish-b10b4).")
    print("La saisie est masquée. Aucun token ne sera enregistré dans le projet.")
    tokens = {}
    for account, username in [("en", "mydailydishapp"), ("fr", "mydailydishapp.fr"), ("br", "mydailydishapp.br")]:
        token = getpass.getpass(f"Token {account.upper()} — @{username} : ").strip()
        if not token or any(char.isspace() for char in token):
            sys.exit("Token vide ou contenant des espaces : installation annulée.")
        tokens[account] = token
    if len(set(tokens.values())) != 3:
        sys.exit("Les trois tokens sont identiques en partie : vérifie tes copies. Installation annulée.")
    # Isolate and delete any Firebase CLI debug logs, even on failure.
    with tempfile.TemporaryDirectory(prefix="ad-studio-instagram-") as workdir:
        result = subprocess.run([
            "firebase", "functions:secrets:set", "AD_STUDIO_INSTAGRAM_TOKENS",
            "--project", "daily-dish-b10b4", "--data-file", "-", "--format", "json",
            "--non-interactive",
        ], input=json.dumps(tokens), text=True, capture_output=True, cwd=workdir)
        output = result.stdout + result.stderr
        for token in tokens.values():
            output = output.replace(token, "[TOKEN MASQUÉ]")
        print(output)
    if result.returncode:
        sys.exit("Installation échouée. Aucun déploiement n’a été lancé.")
    print("Tokens installés. Indique à Codex que la saisie est terminée pour déployer la fonction.")


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError, getpass.GetPassWarning):
        sys.exit("\nInstallation annulée.")
