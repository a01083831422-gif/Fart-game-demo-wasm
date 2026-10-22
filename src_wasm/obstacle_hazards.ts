// obstacle_hazards.ts - Module WebAssembly compilé depuis JointRotor.cs, BounceObstacle.cs, GustZone.cs & Whirlpool.cs
// Gère l'animation temps réel et les collisions de tous les obstacles 3D de Level_Platform et Level_Parkur

let simTime: f32 = 0.0;
let rotorAngle: f32 = 0.0;
let swingAngle: f32 = 0.0;
let bobOffset: f32 = 0.0;

export function step_obstacles(dt: f32): void {
  simTime += dt;
  rotorAngle = simTime * 2.4;
  swingAngle = <f32>Math.sin(<f64>(simTime * 2.2)) * 0.85;
  bobOffset = <f32>Math.sin(<f64>(simTime * 3.0)) * 0.65;
}

export function get_rotor_angle(): f32 { return rotorAngle; }
export function get_swing_angle(): f32 { return swingAngle; }
export function get_bob_offset(): f32 { return bobOffset; }
export function get_sim_time(): f32 { return simTime; }

// Teste la collision 3D avec un obstacle rotatif ou statique et retourne l'intensité de l'impact (0 = pas touché, 1 = rebond, 2 = mortel/kill)
export function test_obstacle_collision(
  bx: f32, by: f32, bz: f32,
  ox: f32, oy: f32, oz: f32,
  radius: f32, height: f32, isDeadly: i32
): i32 {
  let dy = <f32>Math.abs(<f64>(by - oy));
  if (dy > height) return 0;

  let dx = bx - ox;
  let dz = bz - oz;
  let distSq = dx * dx + dz * dz;
  if (distSq <= radius * radius) {
    return isDeadly != 0 ? 2 : 1;
  }
  return 0;
}
