/**
 * Image Editing Prompt Templates
 *
 * Templates for analyzing context and enhancing image editing instructions
 */

export const CONTEXT_ANALYSIS_AND_INSTRUCTION_ENHANCEMENT_TEMPLATE = `You are an expert image editing assistant. Analyze the editing instruction and enhance it for optimal results.

Target Image: {{ targetImage }}
Original Instruction: "{{ instruction }}"

Recent conversation context:
{{ conversationContext }}

Tasks:
1. Determine the edit type: inpaint, outpaint, enhance, style_transfer, or variant
2. Enhance the instruction to be more specific and effective for image editing
3. Provide clear, actionable editing guidance

Respond with JSON:
{
  "editType": "inpaint|outpaint|enhance|style_transfer|variant",
  "enhancedInstruction": "enhanced editing instruction",
  "reasoning": "brief explanation of the enhancement"
}`
