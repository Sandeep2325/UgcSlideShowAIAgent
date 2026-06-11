#!/bin/bash
# Double-click this file to make a slideshow. No commands to memorize.
# It checks setup, asks for your Claude API key the first time, then asks what to make.

cd "$(dirname "$0")" || exit 1

echo ""
echo "🎬  Slideshow Maker"
echo "==================="
echo ""

# --- check Node is installed ---
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js isn't installed. Install it from https://nodejs.org (the 'LTS' button), then try again."
  echo ""
  read -n1 -r -p "Press any key to close..."
  exit 1
fi

# --- first-run installs (only if missing) ---
if [ ! -d "node_modules" ]; then
  echo "📦 First-time setup (installing the agent)…"
  npm install --no-audit --no-fund >/dev/null 2>&1
fi
if [ ! -d "slideshow/node_modules" ]; then
  echo "📦 First-time setup (installing the video engine — this can take a minute)…"
  (cd slideshow && npm install --no-audit --no-fund >/dev/null 2>&1)
fi

# --- make sure .env exists ---
[ -f .env ] || touch .env

# --- ensure the Claude API key is set ---
if ! grep -qE "^ANTHROPIC_API_KEY=.+" .env; then
  echo "🔑 I need your Claude API key (one time only)."
  echo "   Get one at https://console.anthropic.com  →  API Keys  →  Create Key"
  echo "   It starts with 'sk-ant-'."
  echo ""
  read -r -p "Paste your Claude API key: " KEY
  if [ -z "$KEY" ]; then
    echo "No key entered — can't continue. Run me again when you have it."
    read -n1 -r -p "Press any key to close..."
    exit 1
  fi
  awk -v k="$KEY" '
    /^ANTHROPIC_API_KEY=/ { print "ANTHROPIC_API_KEY=" k; done=1; next }
    { print }
    END { if (!done) print "ANTHROPIC_API_KEY=" k }
  ' .env > .env.tmp && mv .env.tmp .env
  echo "✅ Saved. You won't be asked again."
  echo ""
fi

# --- ask what to make ---
echo "What slideshow do you want to make?"
echo "  (e.g.  glowy skincare routine   /   protein coffee for busy moms)"
echo ""
read -r -p "Topic: " TOPIC
if [ -z "$TOPIC" ]; then
  echo "No topic entered — nothing to make."
  read -n1 -r -p "Press any key to close..."
  exit 0
fi

echo ""
read -r -p "How many slides? [6]: " SCENES
SCENES="${SCENES:-6}"

echo ""
echo "▶️  Making your slideshow…"
echo ""
node slideshow-agent.mjs "$TOPIC" --scenes "$SCENES"

echo ""
echo "When you're done viewing, you can close this window."
read -n1 -r -p "Press any key to close..."
