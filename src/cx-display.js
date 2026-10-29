import {projectCx} from './step-assignment.js';
import {effectiveClientId} from './workstream-display.js';
// Clients have no separate CX field: summarize recorded project CX without
// turning that summary into an assignment on any project or step.
export function clientCx(clientId,projects){
 return [...new Set(Object.values(projects).filter(p=>(effectiveClientId(p,projects)||'')===clientId).flatMap(p=>projectCx(p,projects)).map(n=>String(n).trim()).filter(Boolean))];
}
export function cxText(names){return names.length?names.join(', '):'Not set';}
