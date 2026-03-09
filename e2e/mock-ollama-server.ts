import http from 'node:http'

export interface MockModel {
  name: string
  model: string
  size: number
  digest: string
  modified_at: string
  details: {
    parent_model: string
    format: string
    family: string
    families: string[] | null
    parameter_size: string
    quantization_level: string
  }
}

const DEFAULT_MODELS: MockModel[] = [
  {
    name: 'llama3.2:3b',
    model: 'llama3.2:3b',
    size: 2_019_393_189,
    digest: 'a6990ed6be41a5f5e1cbf2e369dda62e7d2e0e93',
    modified_at: '2025-12-01T10:00:00Z',
    details: {
      parent_model: '',
      format: 'gguf',
      family: 'llama',
      families: ['llama'],
      parameter_size: '3.2B',
      quantization_level: 'Q4_K_M'
    }
  },
  {
    name: 'qwen2.5:7b',
    model: 'qwen2.5:7b',
    size: 4_683_075_584,
    digest: 'b3c88e7a2c3f4d5e6f7a8b9c0d1e2f3a4b5c6d7e',
    modified_at: '2025-11-15T08:30:00Z',
    details: {
      parent_model: '',
      format: 'gguf',
      family: 'qwen2',
      families: ['qwen2'],
      parameter_size: '7B',
      quantization_level: 'Q4_0'
    }
  },
  {
    name: 'deepseek-r1:14b',
    model: 'deepseek-r1:14b',
    size: 9_046_245_376,
    digest: 'c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3',
    modified_at: '2025-12-20T14:15:00Z',
    details: {
      parent_model: '',
      format: 'gguf',
      family: 'deepseek',
      families: ['deepseek'],
      parameter_size: '14B',
      quantization_level: 'Q4_K_M'
    }
  }
]

export class MockOllamaServer {
  private server: http.Server
  private _port = 0
  private _models: MockModel[]
  private _healthy = true
  blobs = new Set<string>()
  pullRequested: { name: string }[] = []
  deleteRequested: string[] = []
  createRequested: { model: string; files: Record<string, string> }[] = []

  constructor(models: MockModel[] = DEFAULT_MODELS) {
    this._models = [...models]
    this.server = http.createServer((req, res) => this.handleRequest(req, res))
  }

  get port(): number {
    return this._port
  }

  get url(): string {
    return `http://127.0.0.1:${this._port}`
  }

  setHealthy(healthy: boolean): void {
    this._healthy = healthy
  }

  setModels(models: MockModel[]): void {
    this._models = [...models]
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server.address()
        if (addr && typeof addr === 'object') {
          this._port = addr.port
        }
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve())
    })
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (!this._healthy) {
      res.destroy()
      return
    }

    const url = req.url ?? '/'
    const method = req.method ?? 'GET'

    // Health check
    if (url === '/' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('Ollama is running')
      return
    }

    // List models
    if (url === '/api/tags' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ models: this._models }))
      return
    }

    // Version
    if (url === '/api/version' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ version: '0.5.1' }))
      return
    }

    // Check blob exists
    if (url?.startsWith('/api/blobs/sha256:') && method === 'HEAD') {
      const digest = url.replace('/api/blobs/', '')
      if (this.blobs.has(digest)) {
        res.writeHead(200)
      } else {
        res.writeHead(404)
      }
      res.end()
      return
    }

    // Upload blob
    if (url?.startsWith('/api/blobs/sha256:') && method === 'POST') {
      const digest = url.replace('/api/blobs/', '')
      // Consume the body (discard data, just drain it)
      req.on('data', () => {})
      req.on('end', () => {
        this.blobs.add(digest)
        res.writeHead(201)
        res.end()
      })
      return
    }

    // Create model (files-based)
    if (url === '/api/create' && method === 'POST') {
      this.readBody(req).then((body) => {
        const parsed = JSON.parse(body)
        const { model, files } = parsed
        this.createRequested.push({ model, files: files ?? {} })

        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })

        const steps = [
          { status: 'reading model metadata' },
          { status: 'creating system layer' },
          { status: 'using existing layer sha256:abc123' },
          { status: 'writing manifest' },
          { status: 'success' }
        ]

        let i = 0
        const interval = setInterval(() => {
          if (i >= steps.length) {
            clearInterval(interval)
            // Add the model to the list
            this._models.push({
              name: model,
              model: model,
              size: 1_000_000,
              digest: 'sha256:created123',
              modified_at: new Date().toISOString(),
              details: {
                parent_model: '',
                format: 'gguf',
                family: 'test',
                families: null,
                parameter_size: '1B',
                quantization_level: 'Q4_0'
              }
            })
            res.end()
            return
          }
          res.write(JSON.stringify(steps[i]) + '\n')
          i++
        }, 50)

        req.on('close', () => clearInterval(interval))
      })
      return
    }

    // Delete model
    if (url === '/api/delete' && method === 'DELETE') {
      this.readBody(req).then((body) => {
        const { name } = JSON.parse(body)
        this.deleteRequested.push(name)
        this._models = this._models.filter((m) => m.name !== name)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{}')
      })
      return
    }

    // Pull model (NDJSON stream)
    if (url === '/api/pull' && method === 'POST') {
      this.readBody(req).then((body) => {
        const { name } = JSON.parse(body)
        this.pullRequested.push({ name })

        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })

        const totalSize = 1_000_000
        const steps = [
          { status: 'pulling manifest' },
          {
            status: 'pulling sha256:abc123',
            digest: 'sha256:abc123',
            total: totalSize,
            completed: 0
          },
          {
            status: 'pulling sha256:abc123',
            digest: 'sha256:abc123',
            total: totalSize,
            completed: 500_000
          },
          {
            status: 'pulling sha256:abc123',
            digest: 'sha256:abc123',
            total: totalSize,
            completed: totalSize
          },
          { status: 'verifying sha256 digest' },
          { status: 'writing manifest' },
          { status: `success` }
        ]

        let i = 0
        const interval = setInterval(() => {
          if (i >= steps.length) {
            clearInterval(interval)
            // Add the model to the list
            this._models.push({
              name,
              model: name,
              size: totalSize,
              digest: 'sha256:newmodel123',
              modified_at: new Date().toISOString(),
              details: {
                parent_model: '',
                format: 'gguf',
                family: 'test',
                families: null,
                parameter_size: '1B',
                quantization_level: 'Q4_0'
              }
            })
            res.end()
            return
          }
          res.write(JSON.stringify(steps[i]) + '\n')
          i++
        }, 100)

        req.on('close', () => clearInterval(interval))
      })
      return
    }

    res.writeHead(404)
    res.end('Not Found')
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => resolve(body))
    })
  }
}
