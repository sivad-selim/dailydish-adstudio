#!/usr/bin/env python3
"""Read secrets without echo and send directly to Firebase Secret Manager."""
import getpass
import json
import shutil
import subprocess
import sys
import tempfile
import warnings
import urllib.request
import urllib.error

PAGE_IDS = {"en": "1207160595823403", "fr": "1289897627544141", "br": "1268961959637083"}


def verify_page(account, token):
    request = urllib.request.Request(
        "https://graph.facebook.com/v26.0/me?fields=id,name",
        headers={"Authorization": "Bearer " + token},
    )
    # Never forward credentials to a redirect destination.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=20) as response:
            identity = json.load(response)
        if str(identity.get("id")) != PAGE_IDS[account]:
            sys.exit(f"Le jeton {account.upper()} ne correspond pas à la bonne Page Facebook. Installation annulée.")
    except (urllib.error.URLError, ValueError, OSError, AttributeError):
        sys.exit(f"Impossible de vérifier le jeton {account.upper()} auprès de Facebook. Installation annulée.")


def main():
    if not sys.stdin.isatty():
        sys.exit("Ouvre ce script dans ton terminal interactif.")
    if not shutil.which("firebase"):
        sys.exit("La commande firebase doit être installée et connectée à ton compte Google.")
    warnings.simplefilter("error", getpass.GetPassWarning)
    print("Installation des tokens dans Firebase Secret Manager (daily-dish-b10b4).")
    print("La saisie est masquée. Aucun token ne sera enregistré dans le projet.")
    print("Utilise les jetons de Page dont tu as vérifié la validité dans le Débogueur Meta.")
    tokens = {}
    for account, username in [("en", "DailyDish"), ("fr", "DailyDish - fr"), ("br", "DailyDish - br")]:
        token = getpass.getpass(f"Token {account.upper()} — {username} : ").strip()
        if not token or any(char.isspace() for char in token):
            sys.exit("Token vide ou contenant des espaces : installation annulée.")
        tokens[account] = token
        verify_page(account, token)
    if len(set(tokens.values())) != 3:
        sys.exit("Les trois tokens sont identiques en partie : vérifie tes copies. Installation annulée.")
    # Isolate and delete any Firebase CLI debug logs, even on failure.
    with tempfile.TemporaryDirectory(prefix="ad-studio-facebook-") as workdir:
        result = subprocess.run([
            "firebase", "functions:secrets:set", "AD_STUDIO_FACEBOOK_TOKENS",
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
