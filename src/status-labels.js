// Display names only. Do not infer or change recorded status from dates or ownership.
const labels = {active:'In progress',in_progress:'In progress',waiting:'Waiting',pending:'Planned',not_started:'Planned',planned:'Planned',done:'Done',blocked:'Blocked'};
export const statusLabel = status => labels[status] || String(status || 'Unknown').replaceAll('_',' ');
