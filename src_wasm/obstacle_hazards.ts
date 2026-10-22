// obstacle_hazards.ts - Module WebAssembly pour les pièges, moulins et accélérateurs
// Dérivé de JointRotor.cs, BoostPad.cs, Whirlpool.cs, BounceObstacle.cs

let rotorAngle: f32 = 0.0;

export function update_hazards(dt: f32): void {
    rotorAngle += dt * 3.5; // Vitesse de rotation des pales
    if (rotorAngle > 6.28318) {
        rotorAngle -= 6.28318;
    }
}

export function get_rotor_angle(): f32 {
    return rotorAngle;
}

// Vérifie si la bouée heurte une pale de rotor tournante (obstacle rotatif)
export function check_rotor_hit(boat_x: f32, boat_z: f32, rotor_x: f32, rotor_z: f32, blade_length: f32): i32 {
    let dx = boat_x - rotor_x;
    let dz = boat_z - rotor_z;
    let dist = <f32>Math.sqrt(<f64>(dx * dx + dz * dz));

    if (dist > blade_length + 1.2) return 0;

    // Angle relatif
    let angle = <f32>Math.atan2(<f64>dz, <f64>dx);
    let diff = <f32>Math.abs(<f64>(angle - rotorAngle));
    let diffOpposite = <f32>Math.abs(<f64>(angle - (rotorAngle + 3.14159)));

    if (diff < 0.4 || diffOpposite < 0.4) {
        return 1; // Percuté par une pale !
    }
    return 0;
}

// Vérifie la collision avec un rocher fixe
export function check_rock_hit(boat_x: f32, boat_z: f32, rock_x: f32, rock_z: f32, rock_radius: f32): i32 {
    let dx = boat_x - rock_x;
    let dz = boat_z - rock_z;
    let distSq = dx * dx + dz * dz;
    let hitDist = rock_radius + 1.2;

    return distSq < (hitDist * hitDist) ? 1 : 0;
}

// Vérifie le passage sur un Boost Pad (Accélérateur jaune)
export function check_boost_pad(boat_x: f32, boat_z: f32, pad_x: f32, pad_z: f32): i32 {
    let dx = <f32>Math.abs(<f64>(boat_x - pad_x));
    let dz = <f32>Math.abs(<f64>(boat_z - pad_z));
    return (dx < 2.0 && dz < 2.5) ? 1 : 0;
}

// Calcule l'attraction d'un tourbillon
export function calculate_whirlpool_pull_x(boat_x: f32, wp_x: f32): f32 {
    return (wp_x - boat_x) * 15.0;
}
export function calculate_whirlpool_pull_z(boat_z: f32, wp_z: f32): f32 {
    return (wp_z - boat_z) * 15.0;
}
