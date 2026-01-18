// a cursor-based data structure for parsing, probably going to remove
export function buffer(ring) {
  return {
    data: [],
    ring,
    p: 0,
    get length() {
      return this.data.length
    },
    get size() {
      return this.data.length
    },
    read() {
      return this.data[this.p]
    },
    write(v) {
      this.insert(v)
    },
    move(n) {
      const s = this.size
      this.p = this.ring && s ? (((this.p + n) % s) + s) % s : Math.max(0, Math.min(this.p + n, s))
      return this.p
    },
    insert(...v) {
      this.data.splice(this.p + 1, 0, ...v)
      this.p += v.length
    },
    delete(n = 1) {
      this.data.splice(this.p, n)
    },
    leap(f, dir = 1) {
      for (let i = this.p + dir; dir > 0 ? i < this.size : i >= 0; i += dir)
        if (f(this.data[i])) {
          const s = this.p
          this.p = i
          return dir > 0 ? [s, i] : [i, s]
        }
      return []
    },
    skip(f, dir = 1) {
      while (this.p >= 0 && this.p < this.size && f(this.data[this.p])) this.p += dir
      return this.p
    },
    slice(start, end) {
      return this.data.slice(start, end ?? this.p).join('')
    },
  }
}