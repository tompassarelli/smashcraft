#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
corpus_dir="$project_dir/build/input-journal-corpus"
compiler_checkout=/home/tom/code/wurst-compiler/pins/9913e1bd300c2053637d756a11bae8c3c8ed568f
stdlib=/home/tom/code/wurst-stdlib/pins/bb1e0458db5a
compiler="$project_dir/toolchain/wurstscript.jar"
[[ $(sha256sum "$compiler" | cut -d ' ' -f1) == 2ed2ee8cf563aedaef7e384b2e0c68f50a306144e99fa506b90935c62b64a18a ]]
[[ $(git -C "$stdlib" rev-parse HEAD) == bb1e0458db5a372ba2a6928112452785e435d01a ]]
mkdir -p "$corpus_dir/wurst"
# This workspace checks packet data, not map objects or imports.
# This isolated workspace replaces the compiler's normal run defaults with its
# own args file. Keep the standalone test/compiletime defaults explicit; the
# command line below selects Lua and the exact corpus test separately.
printf '%s\n' '-runcompiletimefunctions' '-stacktraces' > "$corpus_dir/wurst_run.args"
for source in NetworkInput InputProtocol KeyBindings; do
    cp "$project_dir/wurst/$source.wurst" "$corpus_dir/wurst/"
done
cp "$project_dir/tools/netcode-probe/InputJournalCorpus.wurst" "$corpus_dir/wurst/"
cp "$compiler_checkout/de.peeeq.wurstscript/src/main/resources/common.j" "$corpus_dir/common.j"
cp "$compiler_checkout/de.peeeq.wurstscript/src/main/resources/blizzard.j" "$corpus_dir/blizzard.j"
if ! /home/tom/.wurst/wurst-runtime/bin/java -Xmx512m -XX:ActiveProcessorCount=2 \
    -jar "$compiler" -lua -runtests -testFilter InputJournalCorpus \
    -testTimeout 90 -runcompiletimefunctions -stacktraces -workspaceroot "$corpus_dir" -lib "$stdlib" \
    -out "$corpus_dir/checked.lua" "$corpus_dir/common.j" "$corpus_dir/blizzard.j" \
    "$corpus_dir/wurst/NetworkInput.wurst" "$corpus_dir/wurst/InputProtocol.wurst" \
    "$corpus_dir/wurst/KeyBindings.wurst" "$corpus_dir/wurst/InputJournalCorpus.wurst" \
    > "$corpus_dir/generation.log" 2>&1; then
    tail -60 "$corpus_dir/generation.log"
    exit 1
fi
rg '^JOURNAL_CORPUS ' "$corpus_dir/generation.log" > "$corpus_dir/corpus.tsv"
[[ $(wc -l < "$corpus_dir/corpus.tsv") == 2400 ]]
printf 'Validated 2400 authored rows with production InputPacket encode/decode: %s\n' "$corpus_dir/corpus.tsv"
rg '^JOURNAL_PAIR ' "$corpus_dir/generation.log" > "$corpus_dir/pairs.tsv"
[[ $(wc -l < "$corpus_dir/pairs.tsv") == 1200 ]]
printf 'Validated 1200 authored pairs: %s\n' "$corpus_dir/pairs.tsv"
