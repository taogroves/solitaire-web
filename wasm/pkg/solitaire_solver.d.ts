/* tslint:disable */
/* eslint-disable */

export function first_solvable_seed(base_seed: string, options_json?: string | null): string;

export function is_solvable_game_string(game_string: string, options_json?: string | null): boolean;

export function is_solvable_seed(seed: string, options_json?: string | null): boolean;

export function normalize_game_string(game_string: string): string;

export function solve_board_state_json(board_json: string, options_json?: string | null): string;

export function solve_game_string(game_string: string, options_json?: string | null): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly first_solvable_seed: (a: number, b: number, c: number, d: number) => [number, number];
    readonly is_solvable_game_string: (a: number, b: number, c: number, d: number) => number;
    readonly normalize_game_string: (a: number, b: number) => [number, number, number, number];
    readonly solve_board_state_json: (a: number, b: number, c: number, d: number) => [number, number];
    readonly solve_game_string: (a: number, b: number, c: number, d: number) => [number, number];
    readonly is_solvable_seed: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
