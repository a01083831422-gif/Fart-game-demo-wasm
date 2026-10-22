// gas_physics.ts - Module WebAssembly pour la physique des gaz
// Dérivé de PirateGas.cs

let maxEnergy: f32 = 100.0;
let currentEnergy: f32 = 100.0;
let regenRate: f32 = 16.0;
let regenDelay: f32 = 1.0;
let currentDelayTimer: f32 = 0.0;
let isDepleted: i32 = 0;
let jiggleIntensity: f32 = 0.0;

export function init_gas(max_e: f32, regen_r: f32, delay: f32): void {
    maxEnergy = max_e;
    currentEnergy = max_e;
    regenRate = regen_r;
    regenDelay = delay;
    currentDelayTimer = 0.0;
    isDepleted = 0;
    jiggleIntensity = 0.0;
}

export function trigger_fart(cost: f32, power_multiplier: f32): f32 {
    if (isDepleted == 1 || currentEnergy < cost) {
        return 0.0;
    }

    currentEnergy -= cost;
    currentDelayTimer = regenDelay;
    jiggleIntensity = 1.0;

    if (currentEnergy <= 0.0) {
        currentEnergy = 0.0;
        isDepleted = 1;
    }

    return cost * power_multiplier;
}

export function update_gas(dt: f32): f32 {
    if (jiggleIntensity > 0.0) {
        jiggleIntensity -= dt * 4.0;
        if (jiggleIntensity < 0.0) jiggleIntensity = 0.0;
    }

    if (currentDelayTimer > 0.0) {
        currentDelayTimer -= dt;
        return currentEnergy;
    }

    if (currentEnergy < maxEnergy) {
        currentEnergy += regenRate * dt;
        if (currentEnergy >= maxEnergy) {
            currentEnergy = maxEnergy;
            isDepleted = 0;
        } else if (isDepleted == 1 && currentEnergy >= (maxEnergy * 0.35)) {
            isDepleted = 0;
        }
    }

    return currentEnergy;
}

export function get_gas_energy(): f32 { return currentEnergy; }
export function is_gas_depleted(): i32 { return isDepleted; }
export function get_jiggle_intensity(): f32 { return jiggleIntensity; }
