export const employeeDisplayColorKeys = [
  "employee-blue",
  "employee-coral",
  "employee-green",
  "employee-violet",
  "employee-amber",
  "employee-teal",
  "employee-indigo",
  "employee-rose",
  "employee-cyan",
  "employee-olive",
  "employee-magenta",
  "employee-slate"
] as const;

export function getNextEmployeeColor(employees: readonly { color: string }[]) {
  const counts = new Map<string, number>();
  for (const employee of employees) counts.set(employee.color, (counts.get(employee.color) ?? 0) + 1);
  return employeeDisplayColorKeys.reduce((selected, color) => (
    (counts.get(color) ?? 0) < (counts.get(selected) ?? 0) ? color : selected
  ));
}
