declare var mp: any;
declare var global: any;
declare var window: any;

declare type ProcedureListener = (args: any, info: ProcedureListenerInfo) => any;

declare interface Player {
    call: (eventName: string, args?: any[]) => void;
    [property: string]: any;
}

declare interface Browser {
    execute: (code: string) => void;
    [property: string]: any;
}

declare interface ProcedureListenerInfo {
    environment: string;
    id?: string;
    player?: Player;
}

declare interface Event {
    req?: number;
    ret?: number;
    id: string;
    name?: string;
    args?: any;
    env: string;
    fenv?: string;
    res?: any;
    err?: any;
}