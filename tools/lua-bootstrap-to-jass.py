#!/usr/bin/env python3
"""Convert a straight-line World Editor terrain bootstrap at the foreign-map boundary."""
import re
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text()
functions = set(re.findall(r"^function (\w+)\(\)$", source, re.M))
if not {"main", "config"} <= functions:
    raise SystemExit("Terrain bootstrap must define main and config")
output = []
globals_ = []
inside = False
suppressed = 0
for number, raw in enumerate(source.splitlines(), 1):
    line = raw.strip()
    if not line:
        continue
    function = re.fullmatch(r"function (\w+)\(\)", line)
    if function and not inside:
        inside = True
        output.append(f"function {function[1]} takes nothing returns nothing")
    elif line == "end" and inside:
        inside = False
        output.append("endfunction")
    elif not inside and re.fullmatch(r"gg_trg_\w+ = nil", line):
        globals_.append("trigger " + line.replace(" = nil", " = null"))
    elif inside:
        if line == "RunInitializationTriggers()":
            suppressed += 1
            continue
        # Strings are copied verbatim. Only null literals and function-valued
        # arguments differ in this deliberately limited straight-line grammar.
        tokens = re.split(r'("(?:\\.|[^"\\])*")', line)
        for i in range(0, len(tokens), 2):
            tokens[i] = re.sub(r"\bnil\b", "null", tokens[i])
            for name in functions:
                tokens[i] = re.sub(r"\b" + re.escape(name) + r"\b(?!\s*\()", "function " + name, tokens[i])
        expression = "".join(tokens)
        if re.fullmatch(r"\w+\(.*\)", line):
            output.append("call " + expression)
        elif re.fullmatch(r"gg_trg_\w+ = \w+\(.*\)", line):
            output.append("set " + expression)
        else:
            raise SystemExit(f"Unsupported terrain bootstrap statement at line {number}")
    else:
        raise SystemExit(f"Unsupported terrain bootstrap declaration at line {number}")
if inside or suppressed != 1:
    raise SystemExit("Expected one complete bootstrap and one default melee initialization call")
Path(sys.argv[2]).write_text("globals\n" + "\n".join(globals_) + "\nendglobals\n" + "\n".join(output) + "\n")
