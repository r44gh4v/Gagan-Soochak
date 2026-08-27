import type { HazardClass, SeverityLevel } from "@/lib/detection/constants";

/**
 * Recommended response per hazard class × severity — the "what should be done"
 * a graded deliverable asks for. Kept specific and municipally plausible.
 */
const PLAYBOOK: Record<HazardClass, Record<SeverityLevel, string>> = {
  pothole: {
    High: "Barricade affected lane immediately. Dispatch cold-mix patching crew within 4 h. Photo-verify repair before closure.",
    Medium:
      "Schedule cold-mix patching within 24 h. Place hazard marker if on a curve or junction approach.",
    Low: "Add to weekly ward resurfacing list. Re-inspect if repeat sightings exceed 3.",
  },
  waterlogged_road: {
    High: "Deploy dewatering pump. Place flood-depth marker. Notify Traffic Police for diversion. Inspect upstream drain for blockage.",
    Medium:
      "Inspect nearest storm-water inlet for silt within 24 h. Clear debris. Monitor during next rainfall.",
    Low: "Log for monsoon-preparedness survey. Verify inlet gradient during dry-weather inspection.",
  },
  drain_overflow: {
    High: "Dispatch emergency desilting crew within 4 h. Cordon the footpath. Raise BWSSB sewage-mix check — public-health risk.",
    Medium: "Schedule desilting within 24 h. Inspect upstream manholes for blockage.",
    Low: "Add to fortnightly desilting round. Check manhole cover seating.",
  },
};

export function recommendAction(cls: HazardClass, level: SeverityLevel): string {
  return PLAYBOOK[cls][level];
}
