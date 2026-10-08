// Recorded created-to-due windows, not measured effort. Keep user review explicit.
export function timingPattern(item){
 const t=item.title||'';
 if(/collateral.*design|design.*collateral/i.test(t))return '18-20 calendar days';
 if(/poster.*production|production.*poster/i.test(t))return '14 calendar days';
 if(/ppt.*(deck|build)|deck.*(build|kickoff)/i.test(t))return '10-11 calendar days';
 if(/record.*cut|cut.*record/i.test(t))return '6 calendar days';
 if(/logo.*(recolor|update)|update.*logo/i.test(t))return '4 calendar days';
 if(/edit.*training.*video|send.*r1.*guideline/i.test(t))return '3 calendar days';
 if(/collect.*record|gather.*record/i.test(t))return '2 calendar days';
 if(/pms.*alternative|disclaimer|grid.*page/i.test(t))return '1 calendar day';
 return null;
}
