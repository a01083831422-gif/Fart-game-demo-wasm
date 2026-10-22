// track_engine.ts - Module WebAssembly compilé depuis RaceTrack.cs, RaceZone.cs & LevelBuilder.cs
// Gère les coordonnées exactes 3D des checkpoints, spawns et arrivées des 5 niveaux officiels de Fart Together

const MAX_CPS: i32 = 20;
const cpX = new StaticArray<f32>(MAX_CPS);
const cpY = new StaticArray<f32>(MAX_CPS);
const cpZ = new StaticArray<f32>(MAX_CPS);
const cpRadius = new StaticArray<f32>(MAX_CPS);
const cpYaw = new StaticArray<f32>(MAX_CPS);

let totalCheckpoints: i32 = 0;
let currentCheckpointId: i32 = 0;
let isFinished: i32 = 0;
let currentMapId: i32 = 0;
let totalTrackDistance: f32 = 1.0;

export function reset_track(mapId: i32): void {
  currentMapId = mapId;
  totalCheckpoints = 0;
  currentCheckpointId = 0;
  isFinished = 0;
  totalTrackDistance = 1.0;
}

export function register_checkpoint(index: i32, x: f32, y: f32, z: f32, radius: f32, yaw: f32): void {
  if (index < 0 || index >= MAX_CPS) return;
  unchecked(cpX[index] = x);
  unchecked(cpY[index] = y);
  unchecked(cpZ[index] = z);
  unchecked(cpRadius[index] = radius);
  unchecked(cpYaw[index] = yaw);
  if (index + 1 > totalCheckpoints) {
    totalCheckpoints = index + 1;
  }
  // Recalcule la longueur totale de la piste par somme des segments
  let sum: f32 = 0.0;
  for (let i: i32 = 1; i < totalCheckpoints; i++) {
    let dx = unchecked(cpX[i] - cpX[i - 1]);
    let dy = unchecked(cpY[i] - cpY[i - 1]);
    let dz = unchecked(cpZ[i] - cpZ[i - 1]);
    sum += <f32>Math.sqrt(<f64>(dx * dx + dy * dy + dz * dz));
  }
  totalTrackDistance = sum > 1.0 ? sum : 1.0;
}

// Vérifie le passage du prochain checkpoint ou de la ligne d'arrivée (retourne 0=rien, 1=checkpoint validé, 2=course terminée)
export function evaluate_boat_position(bx: f32, by: f32, bz: f32): i32 {
  if (isFinished != 0 || totalCheckpoints == 0) return 0;

  let nextId = currentCheckpointId + 1;
  if (nextId >= totalCheckpoints) return 0;

  let tx = unchecked(cpX[nextId]);
  let ty = unchecked(cpY[nextId]);
  let tz = unchecked(cpZ[nextId]);
  let rad = unchecked(cpRadius[nextId]);

  let dx = bx - tx;
  let dy = by - ty;
  let dz = bz - tz;
  let distSq = dx * dx + dz * dz + (dy * dy * 0.25);

  if (distSq <= rad * rad) {
    currentCheckpointId = nextId;
    if (currentCheckpointId >= totalCheckpoints - 1) {
      isFinished = 1;
      return 2; // Finish!
    }
    return 1; // Checkpoint!
  }
  return 0;
}

export function get_progress_percentage(bx: f32, by: f32, bz: f32): f32 {
  if (isFinished != 0) return 100.0;
  if (totalCheckpoints <= 1) return 0.0;

  let completedDist: f32 = 0.0;
  for (let i: i32 = 1; i <= currentCheckpointId; i++) {
    let dx = unchecked(cpX[i] - cpX[i - 1]);
    let dy = unchecked(cpY[i] - cpY[i - 1]);
    let dz = unchecked(cpZ[i] - cpZ[i - 1]);
    completedDist += <f32>Math.sqrt(<f64>(dx * dx + dy * dy + dz * dz));
  }

  let nextId = currentCheckpointId + 1;
  if (nextId < totalCheckpoints) {
    let sx = unchecked(cpX[currentCheckpointId]);
    let sy = unchecked(cpY[currentCheckpointId]);
    let sz = unchecked(cpZ[currentCheckpointId]);
    let ex = unchecked(cpX[nextId]);
    let ey = unchecked(cpY[nextId]);
    let ez = unchecked(cpZ[nextId]);

    let segX = ex - sx;
    let segY = ey - sy;
    let segZ = ez - sz;
    let segLenSq = segX * segX + segY * segY + segZ * segZ;
    if (segLenSq > 0.01) {
      let segLen = <f32>Math.sqrt(<f64>segLenSq);
      let proj = ((bx - sx) * segX + (by - sy) * segY + (bz - sz) * segZ) / segLenSq;
      if (proj < 0.0) proj = 0.0;
      if (proj > 1.0) proj = 1.0;
      completedDist += proj * segLen;
    }
  }

  let pct = (completedDist / totalTrackDistance) * 100.0;
  if (pct < 0.0) pct = 0.0;
  if (pct > 99.9) pct = 99.9;
  return pct;
}

export function get_current_checkpoint_id(): i32 { return currentCheckpointId; }
export function get_total_checkpoints(): i32 { return totalCheckpoints; }
export function get_respawn_x(): f32 { return unchecked(cpX[currentCheckpointId]); }
export function get_respawn_y(): f32 { return unchecked(cpY[currentCheckpointId]) + 1.5; }
export function get_respawn_z(): f32 { return unchecked(cpZ[currentCheckpointId]); }
export function get_respawn_yaw(): f32 { return unchecked(cpYaw[currentCheckpointId]); }
export function get_next_cp_x(): f32 {
  let n = currentCheckpointId + 1 < totalCheckpoints ? currentCheckpointId + 1 : currentCheckpointId;
  return unchecked(cpX[n]);
}
export function get_next_cp_y(): f32 {
  let n = currentCheckpointId + 1 < totalCheckpoints ? currentCheckpointId + 1 : currentCheckpointId;
  return unchecked(cpY[n]);
}
export function get_next_cp_z(): f32 {
  let n = currentCheckpointId + 1 < totalCheckpoints ? currentCheckpointId + 1 : currentCheckpointId;
  return unchecked(cpZ[n]);
}
export function force_checkpoint(id: i32): void {
  if (id >= 0 && id < totalCheckpoints) {
    currentCheckpointId = id;
    isFinished = (id == totalCheckpoints - 1) ? 1 : 0;
  }
}
