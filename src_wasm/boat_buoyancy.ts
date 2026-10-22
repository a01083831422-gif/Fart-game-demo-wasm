// boat_buoyancy.ts - Module WebAssembly compilé depuis BuoyantBody.cs, WaterChannel.cs & NetworkBoat.cs
// Gère la physique 3D complète de la bouée, la flottaison sur les canaux d'eau à hauteurs variables et les rebonds

let posX: f32 = 0.0;
let posY: f32 = 1.0;
let posZ: f32 = 0.0;

let velX: f32 = 0.0;
let velY: f32 = 0.0;
let velZ: f32 = 0.0;

let yawAngle: f32 = 3.14159;
let pitchAngle: f32 = 0.0;
let rollAngle: f32 = 0.0;
let angularVelYaw: f32 = 0.0;

let mass: f32 = 42.0;
let maxSpeed: f32 = 28.0;
let waterTime: f32 = 0.0;
let targetWaterY: f32 = 0.6;
let invulnTimer: f32 = 0.0;

export function set_boat_pose(x: f32, y: f32, z: f32, yaw: f32): void {
  posX = x;
  posY = y;
  posZ = z;
  velX = 0.0;
  velY = 0.0;
  velZ = 0.0;
  yawAngle = yaw;
  pitchAngle = 0.0;
  rollAngle = 0.0;
  angularVelYaw = 0.0;
  targetWaterY = y;
  invulnTimer = 2.0;
}

export function set_water_surface_y(waterY: f32): void {
  targetWaterY = waterY;
}

export function apply_gas_impulse(forwardForce: f32, upwardForce: f32, steerTorqueImpulse: f32): void {
  // En convention Unity / Three.js, forward le long de -sin(yaw), -cos(yaw) ou +sin(yaw), +cos(yaw)
  let dirX = <f32>Math.sin(<f64>yawAngle);
  let dirZ = <f32>Math.cos(<f64>yawAngle);

  velX += (dirX * forwardForce) / mass;
  velZ += (dirZ * forwardForce) / mass;
  velY += upwardForce / mass;
  angularVelYaw += steerTorqueImpulse;
  pitchAngle = -0.18;
}

export function apply_world_impulse(fx: f32, fy: f32, fz: f32): void {
  velX += fx / mass;
  velY += fy / mass;
  velZ += fz / mass;
}

export function bounce_velocity(normalX: f32, normalZ: f32, restitution: f32): void {
  let dot = velX * normalX + velZ * normalZ;
  if (dot < 0.0) {
    velX -= (1.0 + restitution) * dot * normalX;
    velZ -= (1.0 + restitution) * dot * normalZ;
  }
}

export function clamp_position(x: f32, y: f32, z: f32): void {
  posX = x;
  posY = y;
  posZ = z;
}

export function step_boat_physics(steerInput: f32, rowThrust: f32, dt: f32): void {
  if (dt > 0.05) dt = 0.05;
  waterTime += dt;
  if (invulnTimer > 0.0) {
    invulnTimer -= dt;
    if (invulnTimer < 0.0) invulnTimer = 0.0;
  }

  // Rotation lacet (Yaw)
  angularVelYaw += steerInput * 5.8 * dt;
  angularVelYaw *= <f32>Math.pow(0.06, <f64>dt);
  yawAngle += angularVelYaw * dt;

  // Poussée continue des rames / gaz
  if (rowThrust != 0.0) {
    let dirX = <f32>Math.sin(<f64>yawAngle);
    let dirZ = <f32>Math.cos(<f64>yawAngle);
    velX += dirX * rowThrust * dt;
    velZ += dirZ * rowThrust * dt;
  }

  // Drag hydrodynamique (BuoyantBody.cs)
  let drag = <f32>Math.pow(0.28, <f64>dt);
  velX *= drag;
  velZ *= drag;

  // Limiteur de vitesse
  let speedSq = velX * velX + velZ * velZ;
  if (speedSq > maxSpeed * maxSpeed) {
    let sp = <f32>Math.sqrt(<f64>speedSq);
    velX = (velX / sp) * maxSpeed;
    velZ = (velZ / sp) * maxSpeed;
  }

  posX += velX * dt;
  posZ += velZ * dt;

  // Houle de WaterChannel.cs (_waveAmp = 0.14, _waveLen = 8, _waveSpd = 1.6)
  let wave = <f32>Math.sin(<f64>(posX * 0.35 + waterTime * 2.4)) * 0.10
           + <f32>Math.cos(<f64>(posZ * 0.35 + waterTime * 1.9)) * 0.08;
  let desiredY = targetWaterY + wave;

  // Ressort de flottaison Archimède + gravité
  let dy = desiredY - posY;
  velY += (dy * 18.0 - velY * 4.5) * dt;
  posY += velY * dt;

  // Roulis et tangage dynamiques
  let targetRoll = -steerInput * 0.22 + <f32>Math.sin(<f64>(waterTime * 3.1)) * 0.04;
  rollAngle += (targetRoll - rollAngle) * 8.0 * dt;
  pitchAngle += (0.0 - pitchAngle) * 5.0 * dt;
}

export function get_boat_x(): f32 { return posX; }
export function get_boat_y(): f32 { return posY; }
export function get_boat_z(): f32 { return posZ; }
export function get_boat_yaw(): f32 { return yawAngle; }
export function get_boat_pitch(): f32 { return pitchAngle; }
export function get_boat_roll(): f32 { return rollAngle; }
export function get_boat_speed(): f32 { return <f32>Math.sqrt(<f64>(velX * velX + velZ * velZ)); }
export function is_invulnerable(): i32 { return invulnTimer > 0.0 ? 1 : 0; }
