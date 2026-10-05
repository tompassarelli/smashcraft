// Issue #26's native integrity API. The host CLI is Waygate; these operations
// are exported for its traced parity capture and result commands.
export { captureMatches, parseCaptureArguments } from "./integrity/capture";
export { reconcileCapture } from "./integrity/evidence";
