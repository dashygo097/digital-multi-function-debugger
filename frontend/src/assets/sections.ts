import sectionsData from "./sections.json";

interface Section {
  id: string;
  name: string;
  startAddr: string;
  endAddr: string;
}

export function getSections(): Section[] {
  return sectionsData;
}
