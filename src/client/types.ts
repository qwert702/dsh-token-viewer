/**
 * The browser half's harness type imports in one place, so a harness package
 * rename lands here instead of across every module (0.1.6 moved the Session,
 * Workspace, and projection types out of `@deepseek-ai/dsh-client-runtime`,
 * which no longer exists).
 */

/** Session identity (branded string). */
export type { SessionId } from '@deepseek-ai/dsh-session/types'
/** Session list row, including its per-session projection values. */
export type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
/** Workspace identity and its view row (project grouping). */
export type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
