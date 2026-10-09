# TypeScript

Map code compiles to Lua and cannot import Effect; Bun host tools use Effect for processes, waits, retries, resources and outside data.
One test may consume at most 4 s CPU in Bun or 6 s in Lua32; only Tom raises these ceilings.
All load-bearing determinism, rollback, netcode and input checks use one broader farm run.
CPU observation history shares samples via copyBotMemory and releases them via clearBotMemory; never transfer a history between owners. Keep observation checks streaming canonical bytes, replay text on request and the allocation-free route; whole-frame acceptance uses playable-bot-four.
