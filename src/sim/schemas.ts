// ── Zod schemas for runtime validation ──────────────────────────────────
import { z } from 'zod';

// ── Node kinds ──────────────────────────────────────────────────────────

const NodeKindSchema = z.enum(['LB', 'API', 'DB', 'CACHE', 'QUEUE', 'WORKER']);
const RoutingModeSchema = z.enum(['auto', 'explicit']);
const RoutingFallbackSchema = z.enum(['auto', 'none']);

// ── Placement input validation ──────────────────────────────────────────

export const PlacementInputSchema = z.object({
    kind: NodeKindSchema,
    gx: z.number().int(),
    gy: z.number().int(),
});

export type PlacementInput = z.infer<typeof PlacementInputSchema>;

// ── Level preset validation ─────────────────────────────────────────────

const PresetNodeSchema = z.object({
    kind: NodeKindSchema,
    gx: z.number().int(),
    gy: z.number().int(),
});

const AreaKindSchema = z.enum(['PUBLIC', 'APP', 'DATA', 'ASYNC']);

const AreaSchema = z.object({
    id: z.string(),
    kind: AreaKindSchema,
    label: z.string(),
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
});

const ValidationSeveritySchema = z.enum(['info', 'warning', 'error']);

const ValidationIssueCodeSchema = z.enum([
    'NO_ENTRYPOINT',
    'NO_API',
    'NO_STORAGE',
    'API_WITHOUT_BACKING',
    'QUEUE_WITHOUT_WORKER',
    'WORKER_WITHOUT_QUEUE',
    'CACHE_WITHOUT_DB',
    'DB_UNREACHABLE',
    'PUBLIC_TO_PRIVATE_VIOLATION',
    'INVALID_DEPENDENCY_DIRECTION',
    'ISOLATED_NODE',
]);

const ValidationIssueSchema = z.object({
    id: z.string(),
    severity: ValidationSeveritySchema,
    code: ValidationIssueCodeSchema,
    message: z.string(),
    nodeIds: z.array(z.string()).optional(),
});

const ValidationSnapshotSchema = z.object({
    isValid: z.boolean(),
    issues: z.array(ValidationIssueSchema),
});

const NodeRoutingConfigSchema = z.object({
    mode: RoutingModeSchema,
    targetNodeIds: z.array(z.string()),
    fallback: RoutingFallbackSchema,
    queueWeightPct: z.number().min(0).max(1),
    workerDbWritePct: z.number().min(0).max(1),
});

const NodeDependencyConfigSchema = z.object({
    preferredNodeIds: z.array(z.string()),
});

const NodePolicyConfigSchema = z.object({
    dropOnInvalidTargets: z.boolean(),
});

export const NodeBehaviorSchema = z.object({
    routing: NodeRoutingConfigSchema,
    dependencies: NodeDependencyConfigSchema,
    policies: NodePolicyConfigSchema,
});

export const NodeBehaviorScriptSchema = z.union([
    NodeBehaviorSchema,
    z.object({
        routing: NodeRoutingConfigSchema.partial().optional(),
        dependencies: NodeDependencyConfigSchema.partial().optional(),
        policies: NodePolicyConfigSchema.partial().optional(),
    }),
]);

const ArchitectureRunStateSchema = z.enum(['build', 'review', 'running', 'paused', 'stopped']);
const SubmissionStateSchema = z.enum(['clean', 'dirty', 'validated', 'invalid']);

const SubmissionResultSchema = z.object({
    accepted: z.boolean(),
    blockingIssueIds: z.array(z.string()),
    degradationIssueIds: z.array(z.string()),
});

export const LevelPresetSchema = z.object({
    name: z.string().min(1),
    trafficRps: z.number().positive(),
    nodes: z.array(PresetNodeSchema).min(1),
    areas: z.array(AreaSchema).optional(),
});

export type LevelPreset = z.infer<typeof LevelPresetSchema>;

// ── Sim snapshot validation (lightweight) ───────────────────────────────

export const SimSnapshotSchema = z.object({
    nodes: z.array(
        z.object({
            id: z.string(),
            kind: NodeKindSchema,
            gx: z.number(),
            gy: z.number(),
        }),
    ),
    edges: z.array(
        z.object({
            from: z.string(),
            to: z.string(),
        }),
    ),
    areas: z.array(AreaSchema),
    validation: ValidationSnapshotSchema,
    selectedNodeId: z.string().nullable(),
    tick: z.number().int().min(0),
    trafficRps: z.number().min(0),
    elapsedSec: z.number().min(0),
    runState: ArchitectureRunStateSchema,
    submissionState: SubmissionStateSchema,
    isDirty: z.boolean(),
    trafficActive: z.boolean(),
    lastSubmitAtTick: z.number().int().min(0).nullable(),
    lastSubmission: SubmissionResultSchema.nullable(),
});
