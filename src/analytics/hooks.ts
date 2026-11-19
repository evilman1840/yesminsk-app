import { useEffect, useRef } from 'react';
import { ClientEventName } from './contract';
import { track, whenAnalyticsEnabled } from './runtime';
/** instanceKey is only a React dependency: it is never sent to analytics. */
export function useAnalyticsView(event: ClientEventName,instanceKey?: string | number): void {
 const seen=useRef<string>();const key=event+':'+String(instanceKey??'');
 useEffect(()=>whenAnalyticsEnabled(()=>{if(seen.current!==key){if(track(event))seen.current=key;}}),[key]);
}
