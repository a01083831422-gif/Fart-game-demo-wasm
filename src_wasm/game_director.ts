// game_director.ts - Module WebAssembly compilé depuis RaceState.cs, MatchFlow.cs & RaceLapTracker.cs
// Gère l'état de la course, le chronomètre précis, les morts/respawns et les records des 5 maps

let gameState: i32 = 1; // 1=Racing, 2=Victory
let raceTimer: f32 = 0.0;
let deathCount: i32 = 0;
let totalFarts: i32 = 0;
let currentScore: i32 = 0;
const bestTimes = new StaticArray<f32>(8);

export function init_director(): void {
  for (let i: i32 = 0; i < 8; i++) {
    unchecked(bestTimes[i] = 9999.0);
  }
}

export function start_race(): void {
  gameState = 1;
  raceTimer = 0.0;
  deathCount = 0;
  totalFarts = 0;
  currentScore = 0;
}

export function update_timer(dt: f32): f32 {
  if (gameState == 1) {
    raceTimer += dt;
  }
  return raceTimer;
}

export function register_fart(): void {
  totalFarts += 1;
  currentScore += 25;
}

export function register_death(): void {
  deathCount += 1;
}

export function register_checkpoint(cpId: i32): void {
  currentScore += 250 * cpId;
}

export function finish_race(mapId: i32): i32 {
  gameState = 2;
  currentScore += 1500;
  if (mapId >= 0 && mapId < 8) {
    if (raceTimer < unchecked(bestTimes[mapId])) {
      unchecked(bestTimes[mapId] = raceTimer);
      return 1;
    }
  }
  return 0;
}

export function get_game_state(): i32 { return gameState; }
export function get_race_time(): f32 { return raceTimer; }
export function get_deaths(): i32 { return deathCount; }
export function get_farts_count(): i32 { return totalFarts; }
export function get_score(): i32 { return currentScore; }
export function get_best_time(mapId: i32): f32 {
  if (mapId >= 0 && mapId < 8) return unchecked(bestTimes[mapId]);
  return 9999.0;
}
