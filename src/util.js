export function uid(){
    let firstPart = (Math.random() * 46656) | 0;
    let secondPart = (Math.random() * 46656) | 0;
    firstPart = ('000' + firstPart.toString(36)).slice(-3);
    secondPart = ('000' + secondPart.toString(36)).slice(-3);
    return firstPart + secondPart;
}

export function getEnvironment(){
    if(!mp) return undefined;
    if(mp.joaat) return 'server';
    else if(mp.game && mp.game.joaat) return 'client';
    else if(mp.trigger) return 'cef';
}

export function stringifyData(data){
    return JSON.stringify(data);
}

export function parseData(data){
    return JSON.parse(data);
}