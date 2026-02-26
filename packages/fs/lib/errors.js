export const errno = {
  EPERM: -1,
  ENOENT: -2,
  EIO: -5,
  EACCES: -13,
  EEXIST: -17,
  ENOTDIR: -20,
  EISDIR: -21,
  ENOSPC: -28,
  ENOSYS: -38,
  ENOTEMPTY: -39,
};

export class FuseError extends Error {
  constructor(code) {
    const name = Object.entries(errno).find(([, v]) => v === code)?.[0] ?? 'UNKNOWN';
    super(`FUSE error: ${name} (${code})`);
    this.code = code;
  }
}
