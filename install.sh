#!/bin/bash
# One-time installer for slideshowagent on a new computer (macOS or Linux).
# Run it from inside the project folder:   bash install.sh

cd "$(dirname "$0")" || exit 1

echo ""
echo "📦  Installing slideshowagent"
echo "============================="
echo ""

# --- 1. Node.js (required) ---
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js is not installed."
  echo "   Install Node 18 or newer:"
  echo "     • macOS/Windows: https://nodejs.org  (click the 'LTS' button)"
  echo "     • Linux:         sudo apt-get install -y nodejs npm   (or use nvm)"
  echo "   Then run this installer again."
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node $(node -v) is too old. Please install Node 18 or newer and re-run."
  exit 1
fi
echo "✅ Node $(node -v)"

# --- 2. Install dependencies ---
echo "→ installing the agent (root)…"
npm install --no-audit --no-fund
echo "→ installing the video engine (slideshow/)…"
(cd slideshow && npm install --no-audit --no-fund)

# --- 3. API keys ---
[ -f .env ] || touch .env
set_key() {
  local name="$1" prompt="$2"
  if grep -qE "^${name}=.+" .env; then
    echo "✅ ${name} already set"
    return
  fi
  echo ""
  read -r -p "$prompt" val
  if [ -z "$val" ]; then
    echo "   (skipped — you can add ${name} to .env later)"
    return
  fi
  awk -v k="$val" -v n="$name" '
    $0 ~ "^" n "=" { print n "=" k; done=1; next }
    { print }
    END { if (!done) print n "=" k }
  ' .env > .env.tmp && mv .env.tmp .env
  echo "   ✅ saved ${name}"
}
echo ""
echo "🔑 API keys (stored locally in .env, never committed):"
set_key "ANTHROPIC_API_KEY" "Claude API key (console.anthropic.com → API Keys), starts 'sk-ant-': "
set_key "KIE_AI_API_KEY"    "Kie.ai API key (for NanoBanana images): "

# --- 4. Done ---
echo ""
echo "🎉 Installed. Try it:"
echo "     node slideshow-agent.mjs \"glowy morning skincare routine\""
echo "   or from Python:"
echo "     python3 -c \"from slideshow import make_slideshow; print(make_slideshow('cozy oat milk latte', scenes=3, render=True)['video'])\""
echo ""
