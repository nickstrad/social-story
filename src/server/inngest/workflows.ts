import type { TaskType } from "@/server/domain/types"

export interface TaskWorkflow {
  type: TaskType
  eventName: string
  functionId: string
  functionName: string
  description: string
  claimStepName: string
  completeStepName: string
}

export const taskWorkflows = {
  PARSE_STORY: {
    type: "PARSE_STORY",
    eventName: "story/convert-to-pages.requested",
    functionId: "story-convert-to-pages",
    functionName: "Convert story to pages",
    description: "Turn a story script into structured picture-book pages.",
    claimStepName: "Start story conversion",
    completeStepName: "Mark story conversion complete",
  },
  BASE_IMAGE: {
    type: "BASE_IMAGE",
    eventName: "story/generate-character-reference.requested",
    functionId: "story-generate-character-reference",
    functionName: "Generate character reference sheet",
    description: "Create the shared character reference used by page art.",
    claimStepName: "Start character reference generation",
    completeStepName: "Mark character reference complete",
  },
  PAGE_IMAGE: {
    type: "PAGE_IMAGE",
    eventName: "story/generate-page-illustration.requested",
    functionId: "story-generate-page-illustration",
    functionName: "Generate page illustration",
    description: "Generate and save an illustration for one story page.",
    claimStepName: "Start page illustration generation",
    completeStepName: "Mark page illustration complete",
  },
  PDF_EXPORT: {
    type: "PDF_EXPORT",
    eventName: "story/build-pdf.requested",
    functionId: "story-build-pdf",
    functionName: "Build story PDF",
    description: "Assemble the selected page art into a downloadable PDF.",
    claimStepName: "Start story PDF export",
    completeStepName: "Mark story PDF complete",
  },
} as const satisfies Record<TaskType, TaskWorkflow>
