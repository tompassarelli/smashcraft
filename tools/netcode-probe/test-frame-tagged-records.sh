#!/usr/bin/env bash
set -euo pipefail
project_dir=$(cd -- "$(dirname -- "$0")/../.." && pwd)
compiler_checkout=/home/tom/code/wurst-compiler/pins/9913e1bd300c2053637d756a11bae8c3c8ed568f
stdlib=/home/tom/code/wurst-stdlib/pins/4dfc8a0474bd
mkdir -p "$project_dir/_build" "$project_dir/build/wurst-tests"
cp "$compiler_checkout/de.peeeq.wurstscript/src/main/resources/common.j" "$project_dir/_build/common.j"
cp "$compiler_checkout/de.peeeq.wurstscript/src/main/resources/blizzard.j" "$project_dir/_build/blizzard.j"
exec /home/tom/.wurst/wurst-runtime/bin/java -Xmx512m -XX:ActiveProcessorCount=2 \
    -jar "$project_dir/toolchain/wurstscript.jar" -lua -runtests \
    -testFilter "${1:-Tests}" -testTimeout 90 -runcompiletimefunctions \
    -stacktraces -workspaceroot "$project_dir" -lib "$stdlib" \
    -out "$project_dir/build/wurst-tests/frame-tagged-record-tests.lua" \
    "$project_dir/_build/common.j" "$project_dir/_build/blizzard.j" \
    "$project_dir/tools/netcode-probe/FrameTaggedRecord.wurst" \
    "$project_dir/tools/netcode-probe/FrameTaggedRecordTests.wurst" \
    "$project_dir/tools/netcode-probe/InputFrameOracle.wurst" \
    "$project_dir/tools/netcode-probe/InputFrameOracleTests.wurst"
