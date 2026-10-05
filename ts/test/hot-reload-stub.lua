-- Lua32 replay of hot reload: stubs the Warcraft natives the reloader uses,
-- loads ts/build/map.lua as one client, and runs its timers. Point
-- scripts/hot.ts at ts/build/hotstub to publish into it.
-- Usage (from ts/): ROUNDS=40 <lua32> test/hot-reload-stub.lua & bun scripts/hot.ts --data build/hotstub
local dir = "build/hotstub/"
local tooltips = {}
function BlzSetAbilityTooltip(id, text, level) tooltips[level] = text end
function BlzGetAbilityTooltip(id, level) return tooltips[level] or " " end
function Preloader(name)
  local f = io.open(dir .. name, "rb"); if not f then return end
  local whole = f:read("a"); f:close()
  local user = whole:match("//!beginusercode\n(.*)//!endusercode")
  if user then assert(load(user))() return end
  f = io.open(dir .. name, "r")
  for line in f:lines() do
    local text, level = line:match('BlzSetAbilityTooltip%(\'%$wsl\', "(.*)", (%d+)%)')
    if text then tooltips[tonumber(level)] = text end
  end
  f:close()
end
local timers, triggers, syncData = {}, {}, nil
PLAYER_SLOT_STATE_PLAYING, MAP_CONTROL_USER = "playing", "user"
function GetPlayerSlotState(p) return p == 0 and "playing" or "empty" end
function GetPlayerController(p) return "user" end
function CreateTimer() return {} end
function TimerGetElapsed(t) return 0.0 end
function TimerStart(t, timeout, periodic, fn) timers[#timers + 1] = fn end
function CreateTrigger() return { actions = {} } end
function TriggerAddAction(t, fn) t.actions[#t.actions + 1] = fn end
function BlzTriggerRegisterPlayerSyncEvent(t, p, prefix) triggers[prefix] = t end
function BlzSendSyncData(prefix, data)
  syncData = data
  for _, fn in ipairs(triggers[prefix].actions) do fn() end
  return true
end
function BlzGetTriggerSyncData() return syncData end
function GetLocalPlayer() return 0 end
function GetPlayerId(p) return p end
function Player(n) return n end
local preload = {}
function PreloadGenClear() preload = {} end
function PreloadGenStart() end
function Preload(text) preload[#preload + 1] = text end
function PreloadGenEnd(name)
  local f = assert(io.open(dir .. name, "w"))
  f:write('function PreloadFiles takes nothing returns nothing\n')
  for _, text in ipairs(preload) do f:write('\tcall Preload( "' .. text .. '" )\n') end
  f:write('endfunction\n'); f:close()
end
function DisplayTextToPlayer(p, x, y, text) print("display: " .. text) end
local module = assert(loadfile("build/map.lua"))()
module.start()
for round = 1, tonumber(os.getenv("ROUNDS") or "12") do
  for _, fn in ipairs(timers) do local ok, err = pcall(fn) if not ok then print("ERROR " .. tostring(err)) end end
  os.execute("sleep 0.25")
end
