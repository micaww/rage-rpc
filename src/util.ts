export function uid(): string {
    const first = (Math.random() * 46656) | 0;
    const second = (Math.random() * 46656) | 0;
    const firstPart = ('000' + first.toString(36)).slice(-3);
    const secondPart = ('000' + second.toString(36)).slice(-3);
    return firstPart + secondPart;
}

export function getEnvironment(): string {
    if(mp.joaat) return 'server';
    else if(mp.game && mp.game.joaat) return 'client';
    else if(mp.trigger) return 'cef';
}

export function stringifyData(data: any): string {
    return JSON.stringify(data);
}

export function parseData(data: string): any {
    return JSON.parse(data);
}

export function isBrowserValid(browser: Browser): boolean {
    try {
        browser.url;
    }catch(e){ return false; }
    return true;
}