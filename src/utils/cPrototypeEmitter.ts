import type { CFunctionSignature } from './cFunctionSignature';
export function emitCPrototype(value:CFunctionSignature):string|undefined { if(!value.authoritative)return undefined;const params=value.type.parameters.map(p=>`${p.type.name} ${p.name}`).join(', ');return `${value.type.returnType.name} ${value.name}(${params});`; }
