export const departmentsKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentsKeys.all, 'list'] as const,
  detail: (departmentId: string) =>
    [...departmentsKeys.all, 'detail', departmentId] as const,
};
