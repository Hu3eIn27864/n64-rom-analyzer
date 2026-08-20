import type { CDeclaration } from './cDeclaration';
export function emitCDeclaration(value:CDeclaration,indent=''):string|undefined { if(!value.authoritative)return undefined;const initializer=value.initializer?.trim();return `${indent}${value.type.name} ${value.name}${initializer?` = ${initializer}`:''};`; }
