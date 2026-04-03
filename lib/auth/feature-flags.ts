export function isParallelAccessEnabled() {
  return process.env.CHRISM_ENABLE_PARALLEL_ACCESS !== 'false'
}
