export const getUncachableGitHubClient = () => ({
  repos: { listForUser: async () => ({ data: [] }) },
  search: { repos: async () => ({ data: { items: [] } }) },
});
