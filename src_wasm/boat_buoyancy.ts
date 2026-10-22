// boat_buoyancy.ts - Module WebAssembly de flottaison et dynamique de la bouée
// Dérivé de BoatDefinition.cs & BuoyantBody.cs

let posX: f32 = 0.0;
let posY: f32 = 0.0;
let posZ: f32 = 0.0;

let velX: f32 = 0.0;
let velY: f32 = 0.0;
let velZ: f32 = 0.0;

let rotationAngle: f32 = 0.0;
let angularVelocity: f32 = 0.0;

let mass: f32 = 40.0;
let linearDamping: f32 = 0.88;
let angularDamping: f32 = 0.90;
let steerTorque: f32 = 4.8;
let maxSpeed: f32 = 18.0;

let waterTime: f32 = 0.0;

export function init_boat(start_x: f32, start_z: f32): void {
    posX = start_x;
    posY = 0.0;
    posZ = start_z;
    velX = 0.0;
    velY = 0.0;
    velZ = 0.0;
    rotationAngle = 0.0;
    angularVelocity = 0.0;
    waterTime = 0.0;
}

export function apply_impulse(force_forward: f32, force_up: f32): void {
    let dirX = <f32>Math.sin(<f64>rotationAngle);
    let dirZ = <f32>Math.cos(<f64>rotationAngle);

    velX += (dirX * force_forward) / mass;
    velZ += (dirZ * force_forward) / mass;
    velY += force_up / mass;
}

export function apply_lateral_push(push_x: f32, push_z: f32): void {
    velX += push_x / mass;
    velZ += push_z / mass;
}

export function update_boat_physics(steer_input: f32, thrust_input: f32, dt: f32): void {
    waterTime += dt;

    // Rotation
    angularVelocity += (steer_input * steerTorque * dt);
    angularVelocity *= angularDamping;
    rotationAngle += angularVelocity * dt;

    // Poussée du moteur / propulsion continue
    if (thrust_input != 0.0) {
        let dirX = <f32>Math.sin(<f64>rotationAngle);
        let dirZ = <f32>Math.cos(<f64>rotationAngle);
        velX += (dirX * thrust_input * dt);
        velZ += (dirZ * thrust_input * dt);
    }

    // Résistance fluide de l'eau
    velX *= linearDamping;
    velZ *= linearDamping;

    // Limiteur de vitesse maximale
    let speedSq = velX * velX + velZ * velZ;
    if (speedSq > (maxSpeed * maxSpeed)) {
        let speed = <f32>Math.sqrt(<f64>speedSq);
        velX = (velX / speed) * maxSpeed;
        velZ = (velZ / speed) * maxSpeed;
    }

    posX += velX * dt;
    posZ += velZ * dt;

    // Houle d'eau
    let wave1 = <f32>Math.sin(<f64>(posX * 0.4 + waterTime * 2.2)) * 0.12;
    let wave2 = <f32>Math.cos(<f64>(posZ * 0.3 + waterTime * 1.8)) * 0.10;
    posY = (wave1 + wave2) + velY;

    if (velY > 0.0) {
        velY -= 9.81 * dt * 0.6;
        if (velY < 0.0) velY = 0.0;
    }
}

export function get_boat_x(): f32 { return posX; }
export function get_boat_y(): f32 { return posY; }
export function get_boat_z(): f32 { return posZ; }
export function get_boat_rotation(): f32 { return rotationAngle; }
export function get_boat_speed(): f32 { return <f32>Math.sqrt(<f64>(velX * velX + velZ * velZ)); }
