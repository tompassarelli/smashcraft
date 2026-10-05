-- Irreducible host boundary: execute the locked Wurst output and persist rows.
local output, runtime = arg[1], arg[2]
dofile(runtime .. '/wc3shim.lua')
dofile(runtime .. '/common.j.lua')
dofile(runtime .. '/blizzard.j.lua')
dofile(output .. '/reference.lua')
__wurst_init_bootstrap()
initGlobals()
initCompiletimeState()
init_MoveReference()
local file = assert(io.open(output .. '/reference-join.jsonl', 'w'))
local rows = 0
BJDebugMsg = function(message)
    assert(message:sub(1, 1) == '{', 'Unexpected reference output')
    assert(file:write(message, '\n'))
    rows = rows + 1
end
init_MoveReferenceInput()
assert(file:close())
assert(rows > 0, 'No reference rows emitted')
print('Exported ' .. rows .. ' rows to ' .. output .. '/reference-join.jsonl')
