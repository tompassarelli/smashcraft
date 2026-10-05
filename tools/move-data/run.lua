-- Irreducible host boundary: run the pinned compiler output and write its rows.
local output, runtime = arg[1], arg[2]
dofile(runtime .. '/wc3shim.lua')
dofile(runtime .. '/common.j.lua')
dofile(runtime .. '/blizzard.j.lua')
dofile(output .. '/moves.lua')
__wurst_init_bootstrap()
initGlobals()
initCompiletimeState()
init_Real()
init_Integer()
init_ParticipantInputs()
init_MeleeScalarMath()
init_MeleeContactGeometry()
init_Simulation()
local file = assert(io.open(output .. '/moves.jsonl', 'w'))
local rows = 0
BJDebugMsg = function(message)
    assert(message:sub(1, 1) == '{', 'Unexpected move export output')
    assert(file:write(message, '\n'))
    rows = rows + 1
end
init_MoveDataExport()
assert(file:close())
assert(rows > 0, 'No move data emitted')
print('Exported ' .. rows .. ' rows to ' .. output .. '/moves.jsonl')
