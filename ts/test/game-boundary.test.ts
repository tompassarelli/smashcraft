import { Cause, Effect, Exit, Option } from "effect";
import { expect, test } from "bun:test";
import { MalformedGameFile } from "waygate/scripts/waygate/boundary";
import { writtenGameFileKind } from "../scripts/waygate/boundary";

const preload = (lines: readonly string[]) => `function PreloadFiles takes nothing returns nothing\n\n\tcall PreloadStart()\r\n${lines.map((line) => `\tcall Preload( "${line}" )\r\n`).join("")}\tcall PreloadEnd( 0.1 )\r\nendfunction\n`;

// Native wire records: names are also the companion and capture-tool contract.
const fixtures = [
  {
    name: "smashcraft-journal-control-playable-0042-e2-s1-n3.txt", field: "frame", valid: "frame=417", invalid: "frame=nope",
    lines: ["SMASHCRAFT JOURNAL CONTROL v=1 build=playable-0042 epoch=2 slot=1 sequence=3 state=PAUSE_COMMIT frame=417"],
  },
  {
    name: "smashcraft-journal-start-playable-0042-e2-s1.txt", field: "state", valid: "state=START", invalid: "state=UNKNOWN",
    lines: ["SMASHCRAFT JOURNAL CONTROL v=1 build=playable-0042 epoch=2 slot=1 sequence=0 state=START frame=1"],
  },
  {
    name: "smashcraft-journal-end-playable-0042-e2-s1.txt", field: "sequence", valid: "sequence=0", invalid: "sequence=-1",
    lines: ["SMASHCRAFT JOURNAL CONTROL v=1 build=playable-0042 epoch=2 slot=1 sequence=0 state=END frame=900"],
  },
  {
    name: "smashcraft-journal-menu-playable-0042-s1.txt", field: "humanFighters", valid: "human-fighters=3", invalid: "human-fighters=bad",
    lines: ["SMASHCRAFT JOURNAL MENU v=1 build=playable-0042 epoch=2 slot=1 phase=STAGE", "connected=3 human-fighters=3 computers=4 fighters=7"],
  },
  {
    name: "smashcraft-journal-ready-playable-0042-e2-p1.txt", field: "firstFrame", valid: "first_frame=1", invalid: "first_frame=bad",
    lines: ["SMASHCRAFT JOURNAL v=1 build=playable-0042 epoch=2 slot=1", "input=input-v4 delay=0 rollback=24 first_frame=1",
      "filename=smashcraft-journal-playable-0042-e2-s1-n{SEQUENCE}.pld", "packet=canonical I4; records=1 or 2 consecutive original frames; include neutral rows; no sparse events",
      "transport=editbox-v1; semicolon-delimited I4; local poll and consumed-prefix drain; text-capacity=4096",
      "pause=sequenced control request; companion ACK names the next input frame; simulation pauses or resumes only at that acknowledged confirmed frame"],
  },
  {
    name: "smashcraft-journal-transport-ready-playable-0042-e2-p1.txt", field: "receivedMask", valid: "received-mask=3", invalid: "received-mask=bad",
    lines: ["build=playable-0042 epoch=2 slot=1 received-mask=3 before-journal-reads=yes"],
  },
  {
    name: "smashcraft-journal-failure-playable-0042-e2-p1.txt", field: "sequence", valid: "sequence=3", invalid: "sequence=bad",
    lines: ["build=playable-0042 epoch=2 slot=1", "reason=synchronized input submission failed sequence=3 frame=417"],
  },
  {
    name: "smashcraft-response-p0-run1-page0.txt", field: "rows", valid: "rows=2533", invalid: "rows=bad",
    lines: ["RS v=3 build=playable-0042 local=0 run=1 page=0 rows=2533 mode=clean edge_pairs=0 edge_limit=64 edge_dropped=0",
      "integrity retained=2388 dropped=0", "counts poll=1536 capture_attempt=0 advance=1700 present=2533",
      "transport sent_frames=1536 received_frames=1536 unmatched_receipts=0 dropped_from_export=0 retained=1536",
      "clock=native-game-ms not-host-wall; row=zero-based-service; marker_x=0.04+(row%32)*0.0032 y=0.595-((row/32)%4)*0.01",
      "A row entry_ms poll_ms capture_ms advance_ms present_ms frame_before frame_after F_before F_after K_before target",
      "B row held pressed released capture_result phase confirmed_shield predicted_shield pose_serial correction",
      "C row journal_read_count journal_read_bytes journal_read_ms sync_send_count sync_send_ms",
      "D epoch frame sync_send_ms local_echo_ms echo_age_ms; echo=-1 means not observed before export",
      "I 132 capture 1 0 103 0 1 1 103", "I 132 action 1 0 103 1 1 1", "I 139 rollback 1 8", "I 140 stall 1 111 103", "I 140 checksum 1 111 247377:465362 2",
      "A 0 0.1 -1 -1 -1 0.2 0 0 0 0 0 -1", "B 0 -1 -1 -1 -1 2 -1 -1 -1 -1", "C 0 0 0 0.0 0 0.0", "D 1 103 1.0 -1 -1"],
  },
  {
    name: "smashcraft-edge-p0-run1-row3-poll.txt", field: "nativeMs", valid: "native_ms=42.5", invalid: "native_ms=bad",
    lines: ["EDGE v=1 build=playable-0042 local=0 run=1 row=3 stage=poll held=1 pressed=1 released=0 active=1 native_ms=42.5"],
  },
  {
    name: "smashcraft-frame-cost-trial-p0-typescript.txt", field: "frames", valid: "frames=4096", invalid: "frames=4095",
    lines: ["SOURCE trial", "frames=4096", "total_seconds=1.5", "mean_seconds=0.000366211", "initial_checksum=10:11", "final_checksum=20:21", "state=SmashcraftReplay2|frame=4096"],
  },
  {
    name: "smashcraft-frame-cost-clock-p0.txt", field: "work", valid: "work=704982704", invalid: "work=bad",
    lines: ["frame-cost-clock os=present os.clock=present os.delta=0.010 timer.before=0.000 timer.after=0.000 timer.delta=0.000 work=704982704"],
  },
  {
    name: "smashcraft-native-physics-precision.txt", field: "messages", valid: "MESSAGES 1", invalid: "MESSAGES bad",
    lines: ["SOURCE trial", "GROUNDED_BINARY32_EXACT_PASS", "MESSAGES 1", "NATIVE_PHYSICS_COMPLETED"],
  },
] as const;

test("game file inventory decodes native records and returns a typed filename and field for malformed fixtures", async () => {
  for (const fixture of fixtures) {
    const kind = writtenGameFileKind(fixture.name);
    expect(kind, fixture.name).toBeDefined();
    if (kind === undefined) throw new Error(`missing file kind for ${fixture.name}`);
    const text = preload(fixture.lines);
    await Effect.runPromise(kind.decode(fixture.name, text));
    const exit = await Effect.runPromiseExit(kind.decode(fixture.name, text.replace(fixture.valid, fixture.invalid)));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const failure = Cause.findErrorOption(exit.cause);
      expect(Option.isSome(failure)).toBe(true);
      if (Option.isSome(failure)) {
        expect(failure.value).toBeInstanceOf(MalformedGameFile);
        expect(failure.value.file).toBe(fixture.name);
        expect(failure.value.field).toBe(fixture.field);
      }
    }
  }
});

test("response pages reject malformed numeric data rows at their line field", async () => {
  const fixture = fixtures[7];
  const kind = writtenGameFileKind(fixture.name);
  if (kind === undefined) throw new Error("missing response decoder");
  const text = preload(fixture.lines).replace("I 139 rollback 1 8", "I 139 rollback 1 nope");
  const exit = await Effect.runPromiseExit(kind.decode(fixture.name, text));
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    const failure = Cause.findErrorOption(exit.cause);
    expect(Option.isSome(failure)).toBe(true);
    if (Option.isSome(failure)) {
      expect(failure.value.file).toBe(fixture.name);
      expect(failure.value.field).toBe("lines.7");
    }
  }
});
