import { sanitizeSemanticName } from './semanticNameSanitization';

const RESERVED = new Set([
  'alignas', 'alignof', 'and', 'asm', 'auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const',
  'constexpr', 'continue', 'default', 'delete', 'do', 'double', 'else', 'enum', 'explicit', 'export',
  'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int', 'long', 'namespace',
  'new', 'noexcept', 'not', 'nullptr', 'operator', 'or', 'private', 'protected', 'public', 'register',
  'reinterpret_cast', 'return', 'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'template',
  'this', 'throw', 'true', 'try', 'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using',
  'virtual', 'void', 'volatile', 'wchar_t', 'while', 'xor',
]);

export function projectCppIdentifier(name: string): string {
  const value = sanitizeSemanticName(name);
  return RESERVED.has(value) ? `${value}_` : value;
}

export function isCppReservedWord(name: string): boolean {
  return RESERVED.has(name.trim());
}
