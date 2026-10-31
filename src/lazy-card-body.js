// Closed cards keep their summary controls, but do not build hidden editors,
// timelines or comment history until opened. Never replace a hydrated draft.
export function hydrateCardBody(body,html,bind){
 if(!body||body.dataset.bodyFilled==='true')return false;
 body.innerHTML=html();
 body.dataset.bodyFilled='true';
 bind(body);
 return true;
}
