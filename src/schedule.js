// Date-only values stay date-only, so browser timezone cannot shift a milestone.
export const dateKey = value => /^\d{4}-\d{2}-\d{2}/.test(value || '') ? value.slice(0, 10) : null;
export function rootProject(project, projects) {
 const seen = new Set();
 while (project?.parent_id && projects[project.parent_id] && !seen.has(project.id)) {
  seen.add(project.id); project = projects[project.parent_id];
 }
 return project;
}
export function projectIsDone(project, projects) {
 const seen = new Set();
 while (project && !seen.has(project.id)) {
  if (project.status === 'done') return true;
  seen.add(project.id); project = projects[project.parent_id];
 }
 return false;
}
export function groupAssignments(items, projects) {
 const groups = new Map();
 for (const item of items) {
  const project = projects[item.project_id];
  if (!project) continue;
  const root = rootProject(project, projects);
  if (!groups.has(root.id)) groups.set(root.id, { project: root, branches: new Map(), count: 0 });
  const group = groups.get(root.id);
  if (!group.branches.has(project.id)) group.branches.set(project.id, { project, items: [] });
  group.branches.get(project.id).items.push(item); group.count++;
 }
 return [...groups.values()];
}
export function milestoneKind(item) {
 // Explicit metadata wins. Background notes do not classify a milestone.
 const kind = item.milestone_type || item.item_type || item.type;
 if (['client_meeting', 'client_review', 'client_presentation'].includes(kind)) return 'review';
 if (['release', 'client_release', 'client_delivery', 'client_handoff'].includes(kind)) return 'release';
 if (kind) return null;
 const title = item.title || '';
 if (/\brelease\b|\bclient\b.{0,40}\b(delivery|handoff)\b|\b(send|deliver|submit|share|handoff|hand\s+off)\b.{0,60}\b(to|with)\s+(the\s+)?client\b|\bfiles?\s+to\s+(the\s+)?client\b/i.test(title)) return 'release';
 if (/\bapproval\b|\bclient\b.{0,40}\b(meeting|review|presentation|call)\b|\b(meeting|review|presentation|call)\b.{0,40}\b(with|to)\s+(the\s+)?client\b/i.test(title)) return 'review';
 return null;
}
export const clientMilestone = item => milestoneKind(item) !== null;
export function isWeekend(key) {
 const day = new Date(key + 'T12:00:00Z').getUTCDay();
 return day === 0 || day === 6;
}
export function monthCells(month) {
 const [year, m] = month.split('-').map(Number);
 const length = new Date(Date.UTC(year, m, 0)).getUTCDate();
 const dates = Array.from({ length }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).filter(key => !isWeekend(key));
 const offset = (new Date(dates[0] + 'T12:00:00Z').getUTCDay() + 6) % 7;
 return [...Array(offset).fill(null), ...dates];
}
export function shiftMonth(month, delta) {
 const [year, m] = month.split('-').map(Number);
 return new Date(Date.UTC(year, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
