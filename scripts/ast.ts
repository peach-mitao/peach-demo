import type {AnyNode} from 'acorn';

export function isNode(value:unknown):value is AnyNode {
  return !!value&&typeof value==='object'&&'type' in value&&typeof value.type==='string';
}
export function children(node:AnyNode):AnyNode[]{
  return Object.values(node).flatMap((value:unknown)=>Array.isArray(value)?value.filter(isNode):isNode(value)?[value]:[]);
}
export function walk(node:AnyNode,visit:(node:AnyNode)=>void):void{
  visit(node);children(node).forEach(child=>walk(child,visit));
}
