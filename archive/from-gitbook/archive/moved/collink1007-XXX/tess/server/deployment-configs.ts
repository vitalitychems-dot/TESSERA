const configs: Record<string, any> = {};
export const getDeploymentConfigs = () => Object.keys(configs).map(k => ({ name: k, ...configs[k] }));
export const getDeploymentConfig = (name: string) => configs[name] || null;
export const getDeploymentConfigFull = (name: string) => configs[name] || null;
