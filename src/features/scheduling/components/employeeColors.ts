export const employeeColorClasses: Record<string, string> = {
  "employee-coral": "bg-employee-coral",
  "employee-amber": "bg-employee-amber",
  "employee-blue": "bg-employee-blue",
  "employee-indigo": "bg-employee-indigo",
  "employee-green": "bg-employee-green",
  "employee-teal": "bg-employee-teal",
  "employee-violet": "bg-employee-violet",
  "employee-rose": "bg-employee-rose"
};

export const employeeDisplayColorKeys = [
  "employee-blue",
  "employee-coral",
  "employee-green",
  "employee-violet",
  "employee-amber",
  "employee-teal",
  "employee-indigo",
  "employee-rose"
] as const;

export function assignEmployeeDisplayColors<T extends { color: string }>(employees: readonly T[]): T[] {
  return employees.map((employee, index) => ({
    ...employee,
    color: employeeDisplayColorKeys[index % employeeDisplayColorKeys.length]
  }));
}
