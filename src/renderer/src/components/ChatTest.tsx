import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Send, Square, Trash2, Image, Brain, Copy, Check } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useOllamaStore } from '@renderer/stores/useOllamaStore'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../../../shared/types'

// Code block with copy button
function CodeBlock({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const lang = className?.replace('language-', '') ?? ''
  const code = String(children).replace(/\n$/, '')

  const handleCopy = (): void => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="relative group my-1.5 rounded-md bg-background/60 border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 border-b border-border/30 text-[10px] text-muted-foreground">
        <span>{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed">
        <code className={className}>{code}</code>
      </pre>
    </div>
  )
}

// Markdown renderer for assistant messages
function MarkdownContent({ content }: { content: string }): React.JSX.Element {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const isBlock = className?.startsWith('language-') || String(children).includes('\n')
          if (isBlock) {
            return <CodeBlock className={className}>{children}</CodeBlock>
          }
          return (
            <code
              className="bg-background/60 border border-border/30 rounded px-1 py-0.5 text-[11px]"
              {...props}
            >
              {children}
            </code>
          )
        },
        pre({ children }) {
          // Unwrap <pre> since CodeBlock handles its own wrapping
          return <>{children}</>
        },
        p({ children }) {
          return <p className="mb-1.5 last:mb-0">{children}</p>
        },
        ul({ children }) {
          return <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>
        },
        ol({ children }) {
          return <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>
        },
        h1({ children }) {
          return <h1 className="text-sm font-bold mb-1">{children}</h1>
        },
        h2({ children }) {
          return <h2 className="text-xs font-bold mb-1">{children}</h2>
        },
        h3({ children }) {
          return <h3 className="text-xs font-semibold mb-1">{children}</h3>
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-border pl-2 my-1.5 text-muted-foreground italic">
              {children}
            </blockquote>
          )
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-1.5">
              <table className="text-[11px] border-collapse w-full">{children}</table>
            </div>
          )
        },
        th({ children }) {
          return <th className="border border-border/50 px-2 py-1 bg-muted/50 text-left font-medium">{children}</th>
        },
        td({ children }) {
          return <td className="border border-border/50 px-2 py-1">{children}</td>
        },
        a({ children, href }) {
          return (
            <a href={href} className="text-primary underline" target="_blank" rel="noreferrer">
              {children}
            </a>
          )
        }
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

interface ChatTestProps {
  initialModel?: string
  onBack: () => void
}

export function ChatTest({ initialModel, onBack }: ChatTestProps): React.JSX.Element {
  const { t } = useTranslation()
  const models = useOllamaStore((s) => s.models)
  const [selectedModel, setSelectedModel] = useState(initialModel ?? '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingThinking, setStreamingThinking] = useState('')
  const [enableThinking, setEnableThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeRequestIdRef = useRef<string | null>(null)
  const streamingContentRef = useRef('')
  const streamingThinkingRef = useRef('')
  const stopRequestedRef = useRef(false)

  useEffect(() => {
    if (initialModel) setSelectedModel(initialModel)
  }, [initialModel])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, streamingContent, streamingThinking])

  // Finalize streaming content into a message
  const setStreamingContentState = useCallback((value: string | ((prev: string) => string)) => {
    setStreamingContent((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      streamingContentRef.current = next
      return next
    })
  }, [])

  const setStreamingThinkingState = useCallback((value: string | ((prev: string) => string)) => {
    setStreamingThinking((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      streamingThinkingRef.current = next
      return next
    })
  }, [])

  const resetStreamingState = useCallback(() => {
    activeRequestIdRef.current = null
    streamingContentRef.current = ''
    streamingThinkingRef.current = ''
    setStreamingContent('')
    setStreamingThinking('')
    setStreaming(false)
  }, [])

  const finalizeStreaming = useCallback((content: string, thinking: string) => {
    if (content || thinking) {
      const finalContent = thinking ? `<think>${thinking}</think>${content}` : content
      setMessages((msgs) => [...msgs, { role: 'assistant', content: finalContent }])
    }
    resetStreamingState()
  }, [resetStreamingState])

  useEffect(() => {
    const unsubToken = window.electronAPI.onChatToken((token) => {
      if (!activeRequestIdRef.current || token.requestId !== activeRequestIdRef.current) return
      if (token.thinking) {
        setStreamingThinkingState((prev) => prev + token.thinking)
      }
      if (token.content) {
        setStreamingContentState((prev) => prev + token.content)
      }
    })

    const unsubComplete = window.electronAPI.onChatComplete((event) => {
      if (!activeRequestIdRef.current || event.requestId !== activeRequestIdRef.current) return
      if (stopRequestedRef.current) {
        stopRequestedRef.current = false
        return
      }
      finalizeStreaming(streamingContentRef.current, streamingThinkingRef.current)
    })

    const unsubError = window.electronAPI.onChatError((err) => {
      if (!activeRequestIdRef.current || err.requestId !== activeRequestIdRef.current) return
      setError(err.message)
      stopRequestedRef.current = false
      resetStreamingState()
    })

    return () => {
      window.electronAPI.cancelChat()
      unsubToken()
      unsubComplete()
      unsubError()
    }
  }, [finalizeStreaming, resetStreamingState, setStreamingContentState, setStreamingThinkingState])

  const handleSend = async (): Promise<void> => {
    const text = input.trim()
    if (!text || !selectedModel || streaming) return

    setError(null)
    stopRequestedRef.current = false

    const userMsg: ChatMessage = { role: 'user', content: text }
    if (pendingImages.length > 0) {
      userMsg.images = pendingImages
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setPendingImages([])
    setStreaming(true)
    const requestId = crypto.randomUUID()
    activeRequestIdRef.current = requestId
    streamingContentRef.current = ''
    streamingThinkingRef.current = ''
    setStreamingContent('')
    setStreamingThinking('')

    // Build messages for API: prepend system prompt, strip thinking from history
    const apiMessages: ChatMessage[] = []
    if (systemPrompt.trim()) {
      apiMessages.push({ role: 'system', content: systemPrompt.trim() })
    }
    for (const msg of newMessages) {
      if (msg.role === 'assistant') {
        // Strip stored thinking blocks from history before sending back
        const cleaned = msg.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
        apiMessages.push({ ...msg, content: cleaned })
      } else {
        apiMessages.push(msg)
      }
    }

    try {
      await window.electronAPI.chat({
        requestId,
        model: selectedModel,
        messages: apiMessages,
        think: enableThinking
      })
    } catch {
      // Error is handled via onChatError event
    }
  }

  const handleStop = (): void => {
    stopRequestedRef.current = true
    window.electronAPI.cancelChat()
    // Immediately finalize with current content
    const content = streamingContentRef.current
    const thinking = streamingThinkingRef.current
    finalizeStreaming(content, thinking)
  }

  const handleClear = (): void => {
    if (streaming) handleStop()
    setMessages([])
    resetStreamingState()
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleBack = (): void => {
    if (streaming) {
      handleStop()
    }
    onBack()
  }

  const handleImageUpload = (): void => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const reader = new FileReader()
      reader.onload = (): void => {
        const base64 = (reader.result as string).split(',')[1]
        if (base64) {
          setPendingImages((prev) => [...prev, base64])
        }
      }
      reader.readAsDataURL(file)
    }
    // Reset so same file can be selected again
    e.target.value = ''
  }

  // Extract visible content and thinking from a stored assistant message
  const parseAssistantMessage = (content: string): { visible: string; thinking: string } => {
    let thinking = ''
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/)
    if (thinkMatch) thinking = thinkMatch[1].trim()
    const visible = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    return { visible, thinking }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Button variant="ghost" size="sm" onClick={handleBack} className="h-7 w-7 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{t('chat.title')}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant={enableThinking ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setEnableThinking(!enableThinking)}
            className="h-7 px-2 gap-1"
            title={t('chat.enableThinking')}
          >
            <Brain className="h-3.5 w-3.5" />
          </Button>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 w-7 p-0" title={t('chat.clear')}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Model selector + system prompt */}
      <div className="px-4 py-2 border-b border-border/50 space-y-1.5">
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full h-8 text-xs rounded-md border border-input bg-transparent px-2 focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">{t('chat.selectModel')}</option>
          {models.map((m) => (
            <option key={m.name} value={m.name}>{m.name}</option>
          ))}
        </select>
        <button
          onClick={() => setShowSystemPrompt(!showSystemPrompt)}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {showSystemPrompt ? '▾' : '▸'} {t('chat.systemPromptLabel')}
        </button>
        {showSystemPrompt && (
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder={t('chat.systemPromptPlaceholder')}
            rows={2}
            className="w-full resize-none rounded-md border border-input bg-transparent px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="px-4 py-3 space-y-3">
          {messages.map((msg, i) => {
            if (msg.role === 'system') return null
            if (msg.role === 'assistant') {
              const { visible, thinking } = parseAssistantMessage(msg.content)
              if (!visible && !thinking) return null
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%] space-y-1">
                    {thinking && (
                      <details className="text-[10px] text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">{t('chat.thinking')}</summary>
                        <div className="mt-1 pl-2 border-l border-border/50 whitespace-pre-wrap">{thinking}</div>
                      </details>
                    )}
                    <div className="rounded-lg px-3 py-2 text-xs bg-muted break-words">
                      <MarkdownContent content={visible} />
                    </div>
                  </div>
                </div>
              )
            }
            return (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%]">
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex gap-1 mb-1 justify-end">
                      {msg.images.map((img, j) => (
                        <img key={j} src={`data:image/png;base64,${img}`} alt="" className="h-16 rounded-md object-cover" />
                      ))}
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 text-xs whitespace-pre-wrap break-words ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Streaming indicator */}
          {streaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] space-y-1">
                {streamingThinking && (
                  <div className="text-[10px] text-muted-foreground pl-2 border-l border-border/50 whitespace-pre-wrap animate-pulse">
                    {streamingThinking}
                  </div>
                )}
                {streamingContent ? (
                  <div className="rounded-lg px-3 py-2 text-xs bg-muted break-words">
                    <MarkdownContent content={streamingContent} />
                  </div>
                ) : (
                  <div className="rounded-lg px-3 py-2 text-xs bg-muted">
                    <span className="text-muted-foreground animate-pulse">
                      {streamingThinking ? t('chat.thinking') : t('chat.loading')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="flex justify-center">
              <div className="rounded-lg px-3 py-2 text-xs bg-destructive/10 text-destructive border border-destructive/20">
                {t('chat.error', { message: error })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Image previews */}
      {pendingImages.length > 0 && (
        <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative shrink-0">
              <img src={`data:image/png;base64,${img}`} alt="" className="h-12 rounded-md object-cover" />
              <button
                onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-2.5 border-t border-border/50">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 shrink-0"
          onClick={handleImageUpload}
          disabled={!selectedModel}
          title={t('chat.imageUpload')}
        >
          <Image className="h-3.5 w-3.5" />
        </Button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder')}
          disabled={!selectedModel}
          rows={1}
          className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[32px] max-h-[80px]"
        />
        {streaming ? (
          <Button size="sm" variant="destructive" className="h-8 shrink-0" onClick={handleStop}>
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm" className="h-8 shrink-0" onClick={handleSend} disabled={!input.trim() || !selectedModel}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
