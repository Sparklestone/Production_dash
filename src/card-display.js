// Name display only. Never rewrites stored data, URLs, notes or dates.
export function parentheticalName(value){const parts=String(value??'').split(/\s*\/\s*/).map(x=>x.trim()).filter(Boolean);return parts.length>1?`${parts[0]} (${parts.slice(1).join('; ')})`:String(value??'');}
export function joinedNames(...names){return parentheticalName(names.filter(Boolean).join(' / '));}
