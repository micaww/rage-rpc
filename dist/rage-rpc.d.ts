export as namespace rpc;

export function register(name: string, cb: ProcedureListener): void;
export function unregister(name: string): void;
export function call(name: string, args?: any): Promise<any>;
export function callServer(name: string, args?: any): Promise<any>;
export function callClient(player: Player, name: string, args?: any): Promise<any>;
export function callClient(name: string, args?: any): Promise<any>;
export function callBrowsers(player: Player, name: string, args?: any): Promise<any>;
export function callBrowsers(name: string, args?: any): Promise<any>;
export function callBrowser(browser: Browser, name: string, args?: any): Promise<any>;

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