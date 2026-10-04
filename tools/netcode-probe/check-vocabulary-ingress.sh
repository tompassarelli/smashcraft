#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
check_dir="$project_dir/build/vocabulary-check"
compiler_pin=/home/tom/code/wurst-compiler/pins/6b129956f6e7cf9582510f26b99d305526bf3ded
compiler="$project_dir/toolchain/wurstscript.jar"
stdlib=/home/tom/code/wurst-stdlib/pins/bb1e0458db5a
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == 9495b1f3ad1f1baf53335934e9152874773e6c735b0e5db819b3e7f06c82ed15 ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == bb1e0458db5a372ba2a6928112452785e435d01a ]]
mkdir -p "$check_dir/wurst"
printf '%s\n' '-stacktraces' > "$check_dir/wurst_run.args"
for source in NetworkInput InputProtocol KeyBindings InputLedger ParticipantInputs JournalInputSource VocabularyProbeCorpus VocabularyIngress NativePreloadProbe; do
    cp "$project_dir/wurst/$source.wurst" "$check_dir/wurst/"
done
cp "$project_dir/tools/netcode-probe/VocabularyCorpusTests.wurst" "$check_dir/wurst/"
printf 'package BuildInfo\npublic constant string BUILD_ID = "vocabulary-check"\n' > "$check_dir/wurst/BuildInfo.wurst"
cp "$compiler_pin/de.peeeq.wurstscript/src/main/resources/common.j" "$check_dir/common.j"
cp "$compiler_pin/de.peeeq.wurstscript/src/main/resources/blizzard.j" "$check_dir/blizzard.j"
/home/tom/.wurst/wurst-runtime/bin/java -Xmx768m -XX:ActiveProcessorCount=2 \
    -jar "$compiler" -lua -runtests -testFilter VocabularyCorpusTests -testTimeout 90 \
    -stacktraces -workspaceroot "$check_dir" -lib "$stdlib" \
    -out "$check_dir/checked.lua" "$check_dir/common.j" "$check_dir/blizzard.j" \
    "$check_dir/wurst" > "$check_dir/check.log" 2>&1 || { tail -70 "$check_dir/check.log"; exit 1; }
rg '^VOCABULARY_(CORPUS|ALPHABET|MAX_BYTES) ' "$check_dir/check.log" > "$check_dir/corpus.txt"
[[ $(rg -c '^VOCABULARY_CORPUS ' "$check_dir/corpus.txt") == 2400 ]]
printf 'Validated 3600 canonical packets/5400 original rows and compiled ingress/probe: %s\n' "$check_dir/corpus.txt"
