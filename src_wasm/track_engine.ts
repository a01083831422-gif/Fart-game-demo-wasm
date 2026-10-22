// track_engine.ts - Module WebAssembly pour la gestion des parcours, virages et checkpoints

let currentLevel: i32 = 1;
let trackLength: f32 = 200.0;
let riverWidth: f32 = 12.0;

let cp1_z: f32 = 60.0;
let cp2_z: f32 = 120.0;
let finish_z: f32 = 180.0;

let cp1_passed: i32 = 0;
let cp2_passed: i32 = 0;
let finish_passed: i32 = 0;

export function init_track(level: i32): void {
    currentLevel = level;
    cp1_passed = 0;
    cp2_passed = 0;
    finish_passed = 0;

    if (level == 1) {
        // Niveau 1 : Rivière débutant (Courte, peu de virages)
        trackLength = 180.0;
        riverWidth = 12.0;
        cp1_z = 50.0;
        cp2_z = 110.0;
        finish_z = 170.0;
    } else if (level == 2) {
        // Niveau 2 : Rapides Périlleux (Plus longue, virages prononcés)
        trackLength = 280.0;
        riverWidth = 10.0;
        cp1_z = 80.0;
        cp2_z = 170.0;
        finish_z = 260.0;
    } else {
        // Niveau 3 : Canyon Extrême (Étroit, nombreux obstacles)
        trackLength = 400.0;
        riverWidth = 8.5;
        cp1_z = 120.0;
        cp2_z = 250.0;
        finish_z = 380.0;
    }
}

// Calcule la position X du centre de la rivière en fonction de l'avancée Z (virages procéduraux)
export function get_river_center_x(z: f32): f32 {
    let freq: f32 = 0.035;
    let amplitude: f32 = 6.0;

    if (currentLevel == 2) {
        freq = 0.045;
        amplitude = 8.5;
    } else if (currentLevel == 3) {
        freq = 0.055;
        amplitude = 11.0;
    }

    return <f32>Math.sin(<f64>(z * freq)) * amplitude;
}

export function check_checkpoints(boat_z: f32): i32 {
    // Retourne l'id du checkpoint tout juste franchi (1, 2, ou 3 pour finish), ou 0
    if (cp1_passed == 0 && boat_z >= cp1_z) {
        cp1_passed = 1;
        return 1;
    }
    if (cp1_passed == 1 && cp2_passed == 0 && boat_z >= cp2_z) {
        cp2_passed = 1;
        return 2;
    }
    if (cp1_passed == 1 && cp2_passed == 1 && finish_passed == 0 && boat_z >= finish_z) {
        finish_passed = 1;
        return 3;
    }
    return 0;
}

export function is_off_track(boat_x: f32, boat_z: f32): i32 {
    let centerX = get_river_center_x(boat_z);
    let distFromCenter = <f32>Math.abs(<f64>(boat_x - centerX));
    let halfWidth = riverWidth * 0.5;

    if (distFromCenter > halfWidth) {
        return 1; // Hors-piste / heurt de la berge
    }
    return 0;
}

export function get_progress_percent(boat_z: f32): f32 {
    if (boat_z <= 0.0) return 0.0;
    if (boat_z >= finish_z) return 100.0;
    return (boat_z / finish_z) * 100.0;
}

export function get_cp1_z(): f32 { return cp1_z; }
export function get_cp2_z(): f32 { return cp2_z; }
export function get_finish_z(): f32 { return finish_z; }
export function get_river_width(): f32 { return riverWidth; }
export function is_finish_reached(): i32 { return finish_passed; }
