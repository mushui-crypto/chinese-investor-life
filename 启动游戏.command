#!/bin/zsh
cd "${0:A:h}"
GAME_NODE="$(command -v node)"
if [[ -z "$GAME_NODE" && -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  GAME_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ -z "$GAME_NODE" ]]; then
  echo '需要 Node.js 22 或更新版本。安装后重新双击本文件。'
  read -r '?按回车关闭…'
  exit 1
fi
"$GAME_NODE" scripts/launch.mjs
