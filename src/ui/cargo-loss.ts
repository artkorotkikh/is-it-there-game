import type { CargoEvent, CanisterType, Snapshot } from '../game/types';

export const cargoLossSeconds = 3;
export const cargoLossCopy: Record<CanisterType, { title: string; detail: string; action: string }> = {
  cycles: { title: 'CYCLES ARE LOST', detail: 'Engine power is lost.', action: 'Brake, collect the canister and reinstall it.' },
  winch: { title: 'WINCH IS LOST', detail: 'Winch motor is offline. The cable still holds.', action: 'Collect the canister to reel again.' },
  skills: { title: 'DRIVING SKILL IS LOST', detail: 'Forward / reverse AND left / right are swapped.', action: 'Release the controls. Collect and reinstall SKILLS.' },
};

/** Consumes actual ejections, including repeats; initial loading/manual drops are quiet. */
export class CargoLossNotice {
  event: CargoEvent | null = null;
  remaining = 0;
  private lastSequence = 0;

  /** One three-second sequence, including a 220 ms entrance and 280 ms exit. */
  get appearance() {
    const enter = 1 - (1 - Math.min(1, Math.max(0, (cargoLossSeconds - this.remaining) / .22))) ** 3;
    const exit = Math.min(1, this.remaining / .28);
    return { opacity: Math.min(enter, exit * exit), scale: 1 - .06 * (1 - enter) + .035 * (1 - exit) };
  }

  reset() { this.event = null; this.remaining = 0; this.lastSequence = 0; }

  // Advance only on simulation ticks, so pausing preserves the reading time.
  advance(snapshot: Snapshot, dt: number) {
    this.remaining = Math.max(0, this.remaining - dt);
    for (const event of snapshot.events) {
      if (event.sequence <= this.lastSequence) continue;
      this.lastSequence = event.sequence;
      if (event.kind !== 'eject') continue;
      // A newer loss must appear immediately, even when another system is offline.
      this.event = event;
      this.remaining = cargoLossSeconds;
    }
    if (this.remaining === 0 || snapshot.canisters.some(item => item.type === this.event?.type && item.phase === 'docked')) {
      this.event = null;
      this.remaining = 0;
    }
  }
}
