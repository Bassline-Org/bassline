export default function (platform) {
  const isAddress = (s) => /^0x[0-9a-fA-F]{40}$/.test(s)
  const isBlockHash = (s) => /^0x[0-9a-fA-F]{64}$/.test(s)
  const isTxHash = (s) => /^0x[0-9a-fA-F]{64}$/.test(s)
  const isDecimal = (s) => /^\d+$/.test(s)
  const BLOCK_TAGS = ['latest', 'pending', 'finalized', 'safe', 'earliest']
  const isBlockRef = (s) => BLOCK_TAGS.includes(s) || isDecimal(s) || isBlockHash(s)

  const hex2dec = (hex) => (hex == null ? '0' : BigInt(hex).toString(10))

  let nextId = 0
  let rpcUrl = 'http://127.0.0.1:8545'

  async function rpc(method, params = []) {
    const id = ++nextId
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    })
    const json = await res.json()
    if (json.error) throw new Error(`RPC error ${json.error.code}: ${json.error.message}`)
    return json.result
  }

  function fetchBlock(ref, withTxs = false) {
    if (isBlockHash(ref)) return rpc('eth_getBlockByHash', [ref, withTxs])
    const tag = isDecimal(ref) ? '0x' + BigInt(ref).toString(16) : ref
    return rpc('eth_getBlockByNumber', [tag, withTxs])
  }

  // --- Helpers ---

  function readable(fn) {
    const R = platform.classes.Resource
    const r = new R()
    r.get = fn
    return platform.resource(r)
  }

  function fieldReader(fetchFn, key, fmt = 'hex') {
    return readable(async () => {
      const obj = await fetchFn()
      const val = obj[key]
      if (val == null) return ''
      if (fmt === 'dec') return hex2dec(val)
      return String(val)
    })
  }

  function jsonReadable(fetchFn, size = 1048576) {
    const res = readable(async () => JSON.stringify(await fetchFn(), null, 2))
    return { resource: res, meta: { size } }
  }

  // --- Block subtree ---

  const BLOCK_FIELDS = [
    ['hash', 'hash', 'hex'], ['parent-hash', 'parentHash', 'hex'],
    ['number', 'number', 'dec'], ['timestamp', 'timestamp', 'dec'],
    ['miner', 'miner', 'hex'], ['gas-used', 'gasUsed', 'dec'],
    ['gas-limit', 'gasLimit', 'dec'], ['base-fee-per-gas', 'baseFeePerGas', 'dec'],
    ['size', 'size', 'dec'], ['state-root', 'stateRoot', 'hex'],
    ['receipts-root', 'receiptsRoot', 'hex'], ['transactions-root', 'transactionsRoot', 'hex'],
    ['extra-data', 'extraData', 'hex'], ['logs-bloom', 'logsBloom', 'hex'],
    ['nonce', 'nonce', 'hex'],
  ]

  function makeBlockScope(ref) {
    const fetch = () => fetchBlock(ref, false)
    const fetchFull = () => fetchBlock(ref, true)

    const blockScope = platform.create.Scope()

    // .json
    const json = jsonReadable(fetch)
    blockScope({ put: json.resource, at: '.json', meta: json.meta })

    // Field files
    for (const [name, key, fmt] of BLOCK_FIELDS) {
      blockScope({ put: fieldReader(fetch, key, fmt), at: name })
    }

    // transactions/ scope
    const txScope = platform.create.Scope()
    txScope({ put: readable(async () => String((await fetch()).transactions.length)), at: 'count' })
    const txJson = jsonReadable(fetchFull)
    txScope({ put: txJson.resource, at: '.json', meta: txJson.meta })
    blockScope({ put: txScope, at: 'transactions' })

    // withdrawals/ scope
    const wdScope = platform.create.Scope()
    const wdJson = jsonReadable(async () => (await fetch()).withdrawals || [])
    wdScope({ put: wdJson.resource, at: '.json', meta: wdJson.meta })
    blockScope({ put: wdScope, at: 'withdrawals' })

    return blockScope
  }

  // --- Tx subtree ---

  const TX_FIELDS = [
    ['from', 'from', 'hex'], ['to', 'to', 'hex'],
    ['value', 'value', 'dec'], ['gas', 'gas', 'dec'],
    ['gas-price', 'gasPrice', 'dec'], ['nonce', 'nonce', 'dec'],
    ['input', 'input', 'hex'], ['block-number', 'blockNumber', 'dec'],
    ['block-hash', 'blockHash', 'hex'], ['transaction-index', 'transactionIndex', 'dec'],
    ['type', 'type', 'dec'],
  ]

  const RECEIPT_FIELDS = [
    ['status', 'status', 'dec'], ['gas-used', 'gasUsed', 'dec'],
    ['cumulative-gas-used', 'cumulativeGasUsed', 'dec'],
    ['effective-gas-price', 'effectiveGasPrice', 'dec'],
    ['contract-address', 'contractAddress', 'hex'],
  ]

  function makeTxScope(hash) {
    const fetchTx = () => rpc('eth_getTransactionByHash', [hash])
    const fetchReceipt = () => rpc('eth_getTransactionReceipt', [hash])

    const txScope = platform.create.Scope()

    // .json
    const json = jsonReadable(fetchTx)
    txScope({ put: json.resource, at: '.json', meta: json.meta })

    // Field files
    for (const [name, key, fmt] of TX_FIELDS) {
      txScope({ put: fieldReader(fetchTx, key, fmt), at: name })
    }

    // receipt/ scope
    const receiptScope = platform.create.Scope()
    const rJson = jsonReadable(fetchReceipt)
    receiptScope({ put: rJson.resource, at: '.json', meta: rJson.meta })

    for (const [name, key, fmt] of RECEIPT_FIELDS) {
      receiptScope({ put: fieldReader(fetchReceipt, key, fmt), at: name })
    }

    // receipt/logs/ scope
    const logsScope = platform.create.Scope()
    const lJson = jsonReadable(async () => (await fetchReceipt()).logs || [])
    logsScope({ put: lJson.resource, at: '.json', meta: lJson.meta })
    receiptScope({ put: logsScope, at: 'logs' })

    txScope({ put: receiptScope, at: 'receipt' })
    return txScope
  }

  // --- Account subtree ---

  function makeAccountScope(addr) {
    const acctScope = platform.create.Scope()
    acctScope({ put: readable(() => rpc('eth_getBalance', [addr, 'latest']).then(hex2dec)), at: 'balance' })
    acctScope({ put: readable(() => rpc('eth_getTransactionCount', [addr, 'latest']).then(hex2dec)), at: 'nonce' })
    const codeRes = jsonReadable(() => rpc('eth_getCode', [addr, 'latest']))
    acctScope({ put: codeRes.resource, at: 'code', meta: codeRes.meta })
    return acctScope
  }

  // --- Caches for dynamic scopes ---

  const blockCache = new Map()
  const txCache = new Map()
  const accountCache = new Map()

  function getOrCreateBlock(ref) {
    if (!blockCache.has(ref)) blockCache.set(ref, makeBlockScope(ref))
    return blockCache.get(ref)
  }

  function getOrCreateTx(hash) {
    if (!txCache.has(hash)) txCache.set(hash, makeTxScope(hash))
    return txCache.get(hash)
  }

  function getOrCreateAccount(addr) {
    if (!accountCache.has(addr)) accountCache.set(addr, makeAccountScope(addr))
    return accountCache.get(addr)
  }

  // --- Top-level resources ---

  // Scalar readables
  const blockNumber = readable(() => rpc('eth_blockNumber').then(hex2dec))
  const chainId = readable(() => rpc('eth_chainId').then(hex2dec))
  const gasPrice = readable(() => rpc('eth_gasPrice').then(hex2dec))

  // blocks/ scope with dynamic lookup
  const blocksCtl = platform.create.Slot({
    value: null,
    reduce: (_prev, ref) => {
      if (typeof ref === 'string' && isBlockRef(ref)) getOrCreateBlock(ref)
      return ref
    }
  })

  const blocksScope = platform.create.Scope({
    lookup(name) {
      if (!isBlockRef(name)) return null
      return getOrCreateBlock(name)
    },
    list: () => [...blockCache.keys()]
  })
  blocksScope({ put: blocksCtl, at: 'ctl' })

  // tx/ scope with dynamic lookup
  const txCtl = platform.create.Slot({
    value: null,
    reduce: (_prev, hash) => {
      if (typeof hash === 'string' && isTxHash(hash)) getOrCreateTx(hash)
      return hash
    }
  })

  const txScope = platform.create.Scope({
    lookup(name) {
      if (!isTxHash(name)) return null
      return getOrCreateTx(name)
    },
    list: () => [...txCache.keys()]
  })
  txScope({ put: txCtl, at: 'ctl' })

  // accounts/ scope with dynamic lookup
  const accountsCtl = platform.create.Slot({
    value: null,
    reduce: (_prev, addr) => {
      if (typeof addr === 'string' && isAddress(addr)) getOrCreateAccount(addr)
      return addr
    }
  })

  const accountsScope = platform.create.Scope({
    lookup(name) {
      if (!isAddress(name)) return null
      return getOrCreateAccount(name)
    },
    list: () => [...accountCache.keys()]
  })
  accountsScope({ put: accountsCtl, at: 'ctl' })

  // Pre-populate latest block
  getOrCreateBlock('latest')

  // Mount everything into the platform root
  platform.root({ put: blockNumber, at: 'block-number' })
  platform.root({ put: chainId, at: 'chain-id' })
  platform.root({ put: gasPrice, at: 'gas-price' })
  platform.root({ put: blocksScope, at: 'blocks' })
  platform.root({ put: txScope, at: 'tx' })
  platform.root({ put: accountsScope, at: 'accounts' })

  return { setUrl: (url) => { rpcUrl = url } }
}
