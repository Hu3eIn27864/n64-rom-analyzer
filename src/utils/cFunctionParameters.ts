import type { CFunctionParameter } from './cFunctionType';
export function normalizeFunctionParameters(parameters:readonly CFunctionParameter[]):readonly CFunctionParameter[] { return [...parameters].filter(p=>p.authoritative&&p.name.trim()&&p.type.authoritative).map(p=>({...p,name:p.name.trim()})).sort((a,b)=>a.name.localeCompare(b.name)); }
