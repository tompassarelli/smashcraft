#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "$0")" && pwd)
compiler_jar="$project_dir/toolchain/wurstscript.jar"
java=/home/tom/.wurst/wurst-runtime/bin/java
stdlib_checkout=/home/tom/code/wurst-stdlib/pins/e3714f629113
compiler_checkout=/home/tom/code/wurst-compiler/pins/6b129956f6e7cf9582510f26b99d305526bf3ded
test_timeout=${2:-90}
[[ "$test_timeout" =~ ^[1-9][0-9]*$ ]] || { echo 'Test timeout must be positive seconds.' >&2; exit 2; }
mkdir -p "$project_dir/_build" "$project_dir/build/wurst-tests"
cp "$compiler_checkout/de.peeeq.wurstscript/src/main/resources/common.j" "$project_dir/_build/common.j"
cp "$compiler_checkout/de.peeeq.wurstscript/src/main/resources/blizzard.j" "$project_dir/_build/blizzard.j"

test_measure_args=()
if [[ "${WC3_TEST_MEASURE:-0}" == 1 ]]; then
    test_measure_args=(-measure)
fi

exec "$java" -Xmx2048m -XX:ActiveProcessorCount=2 -jar "$compiler_jar" \
    -lua "${test_measure_args[@]}" -runtests -testFilter "${1:-Tests}" -testTimeout "$test_timeout" -runcompiletimefunctions -stacktraces \
    -workspaceroot "$project_dir" \
    -lib "$stdlib_checkout" \
    -out "$project_dir/build/wurst-tests/test.lua" \
    "$project_dir/_build/common.j" \
    "$project_dir/_build/blizzard.j" \
    "$project_dir/wurst/Simulation.wurst" \
    "$project_dir/wurst/TechInput.wurst" \
    "$project_dir/wurst/TechInputTests.wurst" \
    "$project_dir/wurst/MeleeContactGeometry.wurst" \
    "$project_dir/wurst/WorldTestSupport.wurst" \
    "$project_dir/wurst/FourPlayerWorldTests.wurst" \
    "$project_dir/wurst/MeleeScalarMath.wurst" \
    "$project_dir/wurst/MeleeScalarMathTests.wurst" \
    "$project_dir/wurst/RollTravel.wurst" \
    "$project_dir/wurst/PhysicsTests.wurst" \
    "$project_dir/wurst/FrameIntegrityExperiment.wurst" \
    "$project_dir/wurst/IllidanMotion.wurst" \
    "$project_dir/build/animation-assets/FighterAssetInfo.wurst" \
    "$project_dir/build/illidan-animation/DemonHunterAssetInfo.wurst" \
    "$project_dir/wurst/FighterPose.wurst" \
    "$project_dir/wurst/FighterPoseTests.wurst" \
    "$project_dir/build/original-clips-static-lights/wurst/FighterOriginalClipInfo.wurst" \
    "$project_dir/build/model-sounds/wurst/ModelSoundInfo.wurst" \
    "$project_dir/wurst/ConfirmedModelSounds.wurst" \
    "$project_dir/wurst/ModelSoundPresentation.wurst" \
    "$project_dir/wurst/ConfirmedModelSoundsTests.wurst" \
    "$project_dir/wurst/ShieldPose.wurst" \
    "$project_dir/wurst/ShieldPoseTests.wurst" \
    "$project_dir/wurst/ProjectilePose.wurst" \
    "$project_dir/wurst/ProjectilePoseTests.wurst" \
    "$project_dir/wurst/IllidanMotionTests.wurst" \
    "$project_dir/wurst/DirectionalInput.wurst" \
    "$project_dir/wurst/DirectionalInputTests.wurst" \
    "$project_dir/wurst/SimulationTests.wurst" \
    "$project_dir/wurst/RecoveryTests.wurst" \
    "$project_dir/wurst/GrabTests.wurst" \
    "$project_dir/wurst/HitTimingTests.wurst" \
    "$project_dir/wurst/BotRecovery.wurst" \
    "$project_dir/wurst/BotRecoveryTests.wurst" \
    "$project_dir/wurst/SelectionDrag.wurst" \
    "$project_dir/wurst/SelectionDragTests.wurst" \
    "$project_dir/wurst/StageSelection.wurst" \
    "$project_dir/wurst/StageSelectionTests.wurst" \
    "$project_dir/wurst/MatchRules.wurst" \
    "$project_dir/wurst/MatchRulesTests.wurst" \
    "$project_dir/wurst/MatchControls.wurst" \
    "$project_dir/wurst/MatchControlsTests.wurst" \
    "$project_dir/wurst/MatchStep.wurst" \
    "$project_dir/wurst/MatchStepTests.wurst" \
    "$project_dir/wurst/FreezeTrapTests.wurst" \
    "$project_dir/wurst/SpecialMoveTests.wurst" \
    "$project_dir/wurst/DemonHunterTests.wurst" \
    "$project_dir/wurst/ParryScenario.wurst" \
    "$project_dir/wurst/ParryScenarioTests.wurst" \
    "$project_dir/wurst/SpikeScenario.wurst" \
    "$project_dir/wurst/SpikeScenarioTests.wurst" \
    "$project_dir/wurst/CommandBuffer.wurst" \
    "$project_dir/wurst/CommandBufferTests.wurst" \
    "$project_dir/wurst/CombatInput.wurst" \
    "$project_dir/wurst/CombatInputTests.wurst" \
    "$project_dir/wurst/InputAdapter.wurst" \
    "$project_dir/wurst/InputAdapterTests.wurst" \
    "$project_dir/wurst/KeyBindings.wurst" \
    "$project_dir/wurst/KeyBindingsTests.wurst" \
    "$project_dir/wurst/PlayerInputState.wurst" \
    "$project_dir/wurst/PlayerInputStateTests.wurst" \
    "$project_dir/wurst/ReplayState.wurst" \
    "$project_dir/wurst/ReplayStateTests.wurst" \
    "$project_dir/wurst/ReplayHistory.wurst" \
    "$project_dir/wurst/ReplayHistoryTests.wurst" \
    "$project_dir/wurst/ReplaySoak.wurst" \
    "$project_dir/wurst/NetworkInput.wurst" \
    "$project_dir/wurst/KeyboardInputCapture.wurst" \
    "$project_dir/wurst/KeyboardInputCaptureTests.wurst" \
    "$project_dir/wurst/NetworkInputTests.wurst" \
    "$project_dir/wurst/InputProtocol.wurst" \
    "$project_dir/wurst/InputProtocolTests.wurst" \
    "$project_dir/wurst/JournalInputSource.wurst" \
    "$project_dir/wurst/JournalInputSourceTests.wurst" \
    "$project_dir/wurst/JournalTextStream.wurst" \
    "$project_dir/wurst/JournalTextStreamTests.wurst" \
    "$project_dir/wurst/KeyboardJournalIngress.wurst" \
    "$project_dir/wurst/KeyboardJournalIngressTests.wurst" \
    "$project_dir/wurst/JournalPauseBarrier.wurst" \
    "$project_dir/wurst/JournalPauseBarrierTests.wurst" \
    "$project_dir/wurst/InputBatch.wurst" \
    "$project_dir/wurst/InputBatchTests.wurst" \
    "$project_dir/wurst/ParticipantInputs.wurst" \
    "$project_dir/wurst/InputLedger.wurst" \
    "$project_dir/wurst/InputLedgerTests.wurst" \
    "$project_dir/wurst/FixedInputSchedule.wurst" \
    "$project_dir/wurst/FixedInputScheduleTests.wurst" \
    "$project_dir/wurst/FixedInputPlayback.wurst" \
    "$project_dir/wurst/FixedInputPlaybackTests.wurst" \
    "$project_dir/wurst/ShadowInputSchedule.wurst" \
    "$project_dir/wurst/ShadowInputScheduleTests.wurst" \
    "$project_dir/wurst/ShadowInputPlayback.wurst" \
    "$project_dir/wurst/ShadowInputPlaybackTests.wurst" \
    "$project_dir/wurst/ImpactEvents.wurst" \
    "$project_dir/wurst/ImpactState.wurst" \
    "$project_dir/wurst/ImpactStateTests.wurst" \
    "$project_dir/wurst/SpecialEffectState.wurst" \
    "$project_dir/build/summon-original-clips/wurst/SummonOriginalClipInfo.wurst" \
    "$project_dir/wurst/SummonPose.wurst" \
    "$project_dir/wurst/SummonState.wurst" \
    "$project_dir/wurst/SummonStateTests.wurst" \
    "$project_dir/wurst/SpecialEffectStateTests.wurst" \
    "$project_dir/wurst/DamagePose.wurst" \
    "$project_dir/wurst/DamagePoseTests.wurst" \
    "$project_dir/wurst/ImpactEventsTests.wurst"
