export type LightCommand = {
  power: boolean;
  brightness_percent: number;
  color: string;
  breathing: boolean;
};

type CommandListener = (command: LightCommand) => void;

export class SimulatedLightChannel {
  private listeners = new Set<CommandListener>();

  subscribe(listener: CommandListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  write(command: LightCommand) {
    const payload = JSON.stringify(command);
    const delivered = JSON.parse(payload) as LightCommand;
    this.listeners.forEach((listener) => listener(delivered));
  }
}
