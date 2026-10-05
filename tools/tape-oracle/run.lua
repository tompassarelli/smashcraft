-- Irreducible host boundary: serve a tape to the Wurst-compiled oracle and
-- print its records. Run by smashcraft:ts/scripts/tapes.ts in 32-bit Lua.
-- Usage: lua run.lua ORACLE.lua RUNTIME_DIR TAPE
local oracle, runtime, tapePath = arg[1], arg[2], arg[3]
assert(oracle and runtime and tapePath, "usage: run.lua ORACLE.lua RUNTIME_DIR TAPE")

local lines = {}
for text in io.lines(tapePath) do lines[#lines + 1] = text end
assert(lines[1] == "smashcraft-tape 1", tapePath .. ": not a version 1 tape")

local lineNumber, words, cursor = 1, {}, 1

function TapeOracleFail(message)
    io.stderr:write(tapePath, ":", lineNumber, ": ", message, "\n")
    os.exit(1)
end

function TapeOracleNextLine()
    while lineNumber < #lines do
        lineNumber = lineNumber + 1
        local text = lines[lineNumber]
        if text:sub(1, 1) ~= "#" and text:find("%S") then
            words, cursor = {}, 1
            -- name=value and comma-separated arguments are plain words to the oracle.
            for word in text:gmatch("[^%s=,]+") do words[#words + 1] = word end
            return true
        end
    end
    return false
end

function TapeOracleLineNumber() return lineNumber end

function TapeOracleWord()
    local word = words[cursor]
    cursor = cursor + 1
    return word or ""
end

function TapeOracleInt()
    local word = TapeOracleWord()
    local value = math.tointeger(tonumber(word))
    if value == nil then TapeOracleFail("expected a whole number, got '" .. word .. "'") end
    return value
end

function TapeOracleReal()
    local word = TapeOracleWord()
    local value = tonumber(word)
    if value == nil then TapeOracleFail("expected a number, got '" .. word .. "'") end
    return value + 0.0
end

function TapeOracleEmit(record) io.write(record, "\n") end

dofile(runtime .. "/wc3shim.lua")
dofile(runtime .. "/common.j.lua")
dofile(runtime .. "/blizzard.j.lua")

-- The handle natives the standard library touches while initializing: one
-- local player, and forces that enumerate their players synchronously.
local localPlayer = { handleKind = "player", id = 0 }
local enumPlayer = nil
function Player(id) return id == 0 and localPlayer or { handleKind = "player", id = id } end
function GetLocalPlayer() return localPlayer end
function GetPlayerId(player) return player.id end
function CreateForce() return { players = {} } end
function ForceAddPlayer(force, player) force.players[#force.players + 1] = player end
function GetEnumPlayer() return enumPlayer end
function ForForce(force, callback)
    for _, player in ipairs(force.players) do
        enumPlayer = player
        callback()
    end
    enumPlayer = nil
end
function Filter(callback) return { handleKind = "boolexpr", callback = callback } end

-- Pure natives the simulation calls, in the host's 32-bit Lua numbers, as the
-- runtime fixture's SquareRoot and Atan2 are.
function BlzBitOr(a, b) return a | b end
function BlzBitAnd(a, b) return a & b end
function BlzBitXor(a, b) return a ~ b end
function Cos(radians) return math.cos(radians) end
function Sin(radians) return math.sin(radians) end
function I2R(value) return value + 0.0 end
function R2I(value) return math.tointeger(value >= 0 and math.floor(value) or math.ceil(value)) end

dofile(oracle)
-- Package initialization reports errors through BJDebugMsg and carries on.
local failed = false
BJDebugMsg = function(message)
    io.stderr:write(message, "\n")
    failed = true
end
main()
if failed or lineNumber < #lines then
    io.stderr:write(tapePath, ": the oracle stopped at line ", lineNumber, " of ", #lines, "\n")
    os.exit(1)
end
