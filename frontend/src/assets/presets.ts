import presetsData from "./presets.json";

interface Preset {
  name: string;
  address: string;
  description: string;
  section: string;
}

export function getPresets(): Preset[] {
  return presetsData;
}
