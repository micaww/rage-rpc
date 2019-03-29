export as namespace rpc;

export function register(name: string, cb: ProcedureListener): void;
export function unregister(name: string): void;
export function call<T = any>(name: string, args?: any): Promise<T>;
export function callServer<T = any>(name: string, args?: any): Promise<T>;
export function callClient<T = any>(player: Player, name: string, args?: any): Promise<T>;
export function callClient<T = any>(name: string, args?: any): Promise<T>;
export function callBrowsers<T = any>(player: Player, name: string, args?: any): Promise<T>;
export function callBrowsers<T = any>(name: string, args?: any): Promise<T>;
export function callBrowser<T = any>(browser: Browser, name: string, args?: any): Promise<T>;

export interface Player {
    call: (eventName: string, args?: any[]) => void;
    [property: string]: any;
}

export interface Browser {
    execute: (code: string) => void;
    [property: string]: any;
}

export interface ProcedureListenerInfo {
    environment: string;
    id?: string;
    player?: Player;
}

export type ProcedureListener = (args: any, info: ProcedureListenerInfo) => any;
