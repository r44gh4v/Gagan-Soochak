import type { HazardClass } from "@/lib/detection/constants";
import type { Owner } from "@/lib/workflow/types";

/**
 * Hazard class → responsible civic department. Departments are representative
 * of the real Bengaluru split (BBMP roads / BBMP storm-water / BWSSB sewerage),
 * not live municipal integrations - stated on /about.
 */
export const ROUTING: Record<
  HazardClass,
  { department: string; crewPrefix: string; contact: string }
> = {
  pothole: {
    department: "BBMP Road Maintenance",
    crewPrefix: "Road Crew",
    contact: "ward-eng-bmh@bbmp.gov.in",
  },
  waterlogged_road: {
    department: "BBMP Storm Water Drain Cell",
    crewPrefix: "SWD Crew",
    contact: "swd-ec@bbmp.gov.in",
  },
  drain_overflow: {
    department: "BWSSB Sewerage Division",
    crewPrefix: "Sewer Crew",
    contact: "sewerage-bsd@bwssb.gov.in",
  },
};

/**
 * Suggested owner at detection time. The incident still starts `open` and the
 * operator confirms the assignment - the human stays in the loop.
 */
export function suggestOwner(cls: HazardClass, zone: string): Owner {
  const r = ROUTING[cls];
  return {
    department: r.department,
    crew: `${r.crewPrefix} - ${zone}`,
    contact: r.contact,
  };
}
