import { useEffect, useRef } from 'react';
import { AnalyticsProperties, ClientEventName } from './contract';
import { track, whenAnalyticsEnabled } from './runtime';
/** instanceKey is only a React dependency: it is never sent to analytics. */
export function useAnalyticsView(event: ClientEventName,instanceKey?: string | number, properties: Pick<AnalyticsProperties, 'entry_point'> = {}): void {
 const seen=useRef<string>();const key=event+':'+String(instanceKey??'');
 useEffect(()=>whenAnalyticsEnabled(()=>{if(seen.current!==key){if(track(event, properties))seen.current=key;}}),[key,properties.entry_point]);
}
