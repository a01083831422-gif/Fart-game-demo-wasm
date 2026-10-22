// game_director.ts - Module WebAssembly pour la gestion des courses, chronos et records

let gameState: i32 = 0; // 0=Menu/Ready, 1=Racing, 2=Victory, 3=GameOver
let raceTimer: f32 = 0.0;
let bestTimeLevel1: f32 = 999.0;
let bestTimeLevel2: f32 = 999.0;
let bestTimeLevel3: f32 = 999.0;
let currentScore: i32 = 0;
let totalFarts: i32 = 0;

export function start_race(): void {
    gameState = 1;
    raceTimer = 0.0;
    currentScore = 0;
    totalFarts = 0;
}

export function update_timer(dt: f32): f32 {
    if (gameState == 1) {
        raceTimer += dt;
    }
    return raceTimer;
}

export function add_fart_score(): void {
    totalFarts += 1;
    currentScore += 25;
}

export function add_checkpoint_score(cp_num: i32): void {
    currentScore += 200 * cp_num;
}

export function finish_race(level: i32): i32 {
    gameState = 2; // Victoire
    currentScore += 1000;

    let isNewRecord: i32 = 0;
    if (level == 1 && raceTimer < bestTimeLevel1) {
        bestTimeLevel1 = raceTimer;
        isNewRecord = 1;
    } else if (level == 2 && raceTimer < bestTimeLevel2) {
        bestTimeLevel2 = raceTimer;
        isNewRecord = 1;
    } else if (level == 3 && raceTimer < bestTimeLevel3) {
        bestTimeLevel3 = raceTimer;
        isNewRecord = 1;
    }

    return isNewRecord;
}

export function get_game_state(): i32 { return gameState; }
export function get_race_time(): f32 { return raceTimer; }
export function get_score(): i32 { return currentScore; }
export function get_farts_count(): i32 { return totalFarts; }
export function get_best_time(level: i32): f32 {
    if (level == 1) return bestTimeLevel1;
    if (level == 2) return bestTimeLevel2;
    return bestTimeLevel3;
}
