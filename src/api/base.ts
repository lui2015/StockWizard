/**
 * 子路径部署支持。
 * 本地开发时 BASE_URL 为 '/'，拼接后等价于原来的绝对路径；
 * 线上以 VITE_BASE=/StockWizard/ 构建时，资源与接口都会带上 /StockWizard 前缀。
 */
export const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '')

export function api(path: string) {
  return `${BASE}${path}`
}
