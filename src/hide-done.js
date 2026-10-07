// A reversible view filter, never a status change or database deletion.
export function visibleCards(rows,hideDone=false){return hideDone?rows.filter(row=>row.status!=='done'):rows;}
