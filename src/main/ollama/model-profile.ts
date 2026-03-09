import { existsSync } from 'fs'
import { gguf } from '@huggingface/gguf'
import { convertGGUFTemplateToOllama } from '@huggingface/ollama-utils'
import type { ChatMessage, ModelProfile, ModelShowResponse } from '../../shared/types'
import { createLogger } from '../logger'
import store from '../store'

const log = createLogger('ollama:model-profile')

const MODEL_PROFILE_SCHEMA_VERSION = 1
const CHATML_OLLAMA_TEMPLATE =
  '{{ if .System }}<|im_start|>system\n{{ .System }}<|im_end|>\n{{ end }}{{ if .Prompt }}<|im_start|>user\n{{ .Prompt }}<|im_end|>\n{{ end }}<|im_start|>assistant\n{{ .Response }}'

function isChatMlTemplate(chatTemplate: string): boolean {
  return chatTemplate.includes('<|im_start|>') && chatTemplate.includes('<|im_end|>')
}

function getStoredProfiles(): Record<string, ModelProfile> {
  return store.get('modelProfiles')
}

export function getModelProfile(name: string): ModelProfile | null {
  return getStoredProfiles()[name] ?? null
}

export function saveModelProfile(name: string, profile: ModelProfile): void {
  const profiles = getStoredProfiles()
  store.set('modelProfiles', { ...profiles, [name]: profile })
  log.info(`Saved model profile for "${name}"`, {
    source: profile.source,
    runtimeFormat: profile.runtimeFormat,
    stopCount: profile.stop.length,
    hasOllamaTemplate: Boolean(profile.ollamaTemplate)
  })
}

export function removeModelProfile(name: string): void {
  const profiles = getStoredProfiles()
  if (!(name in profiles)) return
  const next = { ...profiles }
  delete next[name]
  store.set('modelProfiles', next)
  log.info(`Removed model profile for "${name}"`)
}

export function copyModelProfile(source: string, destination: string): void {
  const profile = getModelProfile(source)
  if (!profile) return
  saveModelProfile(destination, profile)
  log.info(`Copied model profile`, { source, destination })
}

function extractEosToken(metadata: Record<string, unknown>): string | undefined {
  const tokens = Array.isArray(metadata['tokenizer.ggml.tokens']) ? metadata['tokenizer.ggml.tokens'] : []
  const eosTokenId = typeof metadata['tokenizer.ggml.eos_token_id'] === 'number' ? metadata['tokenizer.ggml.eos_token_id'] : undefined
  return eosTokenId !== undefined && typeof tokens[eosTokenId] === 'string' ? tokens[eosTokenId] : undefined
}

export async function buildModelProfileFromGguf(localPath: string): Promise<ModelProfile | null> {
  if (!localPath || !existsSync(localPath)) return null

  try {
    log.debug(`Parsing GGUF metadata from ${localPath}`)
    const { metadata } = await gguf(localPath, { allowLocalFile: true })
    const chatTemplate = metadata['tokenizer.chat_template']
    if (typeof chatTemplate !== 'string' || !chatTemplate.trim()) return null

    const eosToken = extractEosToken(metadata as Record<string, unknown>)
    const converted = convertGGUFTemplateToOllama({
      chat_template: chatTemplate,
      eos_token: eosToken
    })

    if (converted?.ollama?.template) {
      log.info(`Converted GGUF chat template to Ollama template`, {
        localPath,
        stopCount: converted.ollama.params?.stop?.length ?? 0
      })
      return {
        schemaVersion: MODEL_PROFILE_SCHEMA_VERSION,
        source: 'gguf',
        parentModelPath: localPath,
        rawChatTemplate: chatTemplate,
        stop: converted.ollama.params?.stop ?? (eosToken ? [eosToken] : []),
        ollamaTemplate: converted.ollama.template,
        ollamaParameters: converted.ollama.params
      }
    }

    if (!isChatMlTemplate(chatTemplate)) return null

    const stop = Array.from(new Set(['<|im_start|>', '<|im_end|>', ...(eosToken ? [eosToken] : [])]))
    log.info(`Falling back to ChatML runtime profile`, { localPath, stopCount: stop.length })
    return {
      schemaVersion: MODEL_PROFILE_SCHEMA_VERSION,
      source: 'gguf',
      parentModelPath: localPath,
      rawChatTemplate: chatTemplate,
      runtimeFormat: 'chatml',
      stop,
      ollamaTemplate: CHATML_OLLAMA_TEMPLATE,
      ollamaParameters: { stop }
    }
  } catch (error) {
    log.warn(`Failed to build model profile from ${localPath}: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

export async function ensureModelProfile(name: string, modelInfo?: ModelShowResponse): Promise<ModelProfile | null> {
  const stored = getModelProfile(name)
  if (stored) {
    log.debug(`Using stored model profile for "${name}"`, {
      runtimeFormat: stored.runtimeFormat,
      hasOllamaTemplate: Boolean(stored.ollamaTemplate)
    })
    return stored
  }

  const parentModelPath = modelInfo?.details.parent_model
  if (!parentModelPath) return null

  const profile = await buildModelProfileFromGguf(parentModelPath)
  if (!profile) return null

  saveModelProfile(name, profile)
  log.info(`Recovered legacy model profile for "${name}" from parent GGUF`, { parentModelPath })
  return profile
}

export function isCompletionOnlyModel(model: ModelShowResponse): boolean {
  return model.capabilities?.length === 1 && model.capabilities[0] === 'completion'
}

export function mergeProfileStopSequences(
  modelOptions: Record<string, unknown> | undefined,
  profile: ModelProfile
): Record<string, unknown> {
  const existingStop = Array.isArray(modelOptions?.stop)
    ? modelOptions.stop.filter((value): value is string => typeof value === 'string')
    : []
  const stop = Array.from(new Set([...existingStop, ...profile.stop]))
  return { ...(modelOptions ?? {}), stop }
}

export function shouldUseProfileGenerateFallback(
  _model: ModelShowResponse,
  profile: ModelProfile | null,
  messages: ChatMessage[]
): profile is ModelProfile {
  if (messages.some((message) => (message.images?.length ?? 0) > 0)) return false
  return profile?.runtimeFormat === 'chatml'
}

export function renderPromptFromProfile(
  profile: ModelProfile,
  messages: ChatMessage[],
  options?: { think?: boolean }
): string | null {
  if (profile.runtimeFormat !== 'chatml') return null

  const prompt = messages
    .filter((message) => message.role === 'system' || message.role === 'user' || message.role === 'assistant')
    .map((message) => `<|im_start|>${message.role}\n${message.content}<|im_end|>`)
    .join('\n')

  let assistantPrefix = '<|im_start|>assistant\n'
  const supportsThinkingControl =
    profile.rawChatTemplate?.includes('enable_thinking') ||
    profile.rawChatTemplate?.includes('<think>')

  if (supportsThinkingControl) {
    assistantPrefix += options?.think === false ? '<think>\n\n</think>\n\n' : '<think>\n'
  }

  return `${prompt}\n${assistantPrefix}`
}
