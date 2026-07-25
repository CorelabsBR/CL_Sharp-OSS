import type {
  AIContextItem,
  AIContextSource,
  AIConversation,
  AIMessage,
  AIProviderDescriptor,
  AIProviderId,
  AISettings,
  AIStreamEvent
} from "../../shared/types";
import { ContextCollector, type ContextCollectorHost } from "../ai/ContextCollector";
import { HistoryManager } from "../ai/HistoryManager";
import { MarkdownRenderer } from "../ai/MarkdownRenderer";
import { api } from "../services/api";
import { buttonIcon, el } from "../utils/dom";
import { reportError } from "../utils/errors";

export interface AIChatEditorActions {
  insertBelow(code: string): void;
  replaceSelection(code: string): void;
  replaceFile(code: string): void;
  createNewFile(code: string, language: string): void;
}

const CONTEXT_OPTIONS: Array<{ source: AIContextSource; label: string }> = [
  { source: "currentFile", label: "Arquivo atual" },
  { source: "selection", label: "Texto selecionado" },
  { source: "openEditors", label: "Editores abertos" },
  { source: "workspaceTree", label: "Árvore do workspace" },
  { source: "workspaceFiles", label: "Arquivos relevantes do workspace" },
  { source: "terminal", label: "Saída do terminal" },
  { source: "buildOutput", label: "Saída da build" },
  { source: "gitDiff", label: "Diff do Git" },
  { source: "diagnostics", label: "Diagnósticos" },
  { source: "problems", label: "Problemas" },
  { source: "clipboard", label: "Área de transferência" },
  { source: "files", label: "Arquivos arrastados" }
];

const ACTION_PROMPTS: Record<string, string> = {
  ask: "Me ajude com o código selecionado.",
  explain: "Explique o código selecionado com clareza, incluindo o comportamento e os principais casos extremos.",
  refactor: "Refatore o código selecionado para melhorar clareza, manutenção e corretude. Retorne a substituição completa em um bloco de código.",
  optimize: "Otimize o código selecionado sem alterar o comportamento. Explique os tradeoffs e retorne a substituição em um bloco de código.",
  docs: "Gere documentação adequada para o código selecionado. Retorne a versão documentada em um bloco de código.",
  tests: "Gere testes unitários abrangentes para o código selecionado usando as convenções existentes do projeto.",
  fix: "Encontre e corrija os erros no código selecionado. Explique a causa raiz e retorne o código corrigido.",
  convert: "Converta o código selecionado para a linguagem que eu especificar, preservando o comportamento. Pergunte qual linguagem usar se isso não estiver claro.",
  review: "Revise o código selecionado quanto a corretude, segurança, desempenho e manutenção. Priorize achados concretos.",
  rename: "Sugira um nome melhor para o símbolo na seleção, explique o motivo e mostre as mudanças de código necessárias.",
  commit: "Gere uma mensagem de commit convencional e concisa a partir do diff Git anexado. Retorne apenas a mensagem de commit."
};

export class AIChatPanel {
  readonly element = el("div", { className: "panel ai-chat-panel", attrs: { "aria-label": "Chat de IA" } });
  private readonly history = new HistoryManager();
  private readonly collector: ContextCollector;
  private readonly markdown: MarkdownRenderer;
  private readonly conversationSearch = el("input", { className: "panel-input ai-history-search", attrs: { placeholder: "Pesquisar conversas", "aria-label": "Pesquisar conversas" } });
  private readonly conversationList = el("div", { className: "ai-conversation-list", attrs: { role: "list" } });
  private readonly messages = el("div", { className: "ai-messages", attrs: { role: "log", "aria-live": "polite" } });
  private readonly input = el("textarea", { className: "ai-input", attrs: { placeholder: "Pergunte ao NPSharp AI… (Ctrl+Enter para enviar)", rows: "3", "aria-label": "Mensagem do chat" } });
  private readonly providerSelect = el("select", { className: "ai-provider-select", title: "Provedor de IA", attrs: { "aria-label": "Provedor de IA" } });
  private readonly modelSelect = el("select", { className: "ai-model-select", title: "Modelo de IA", attrs: { "aria-label": "Modelo de IA" } });
  private readonly contextMenu = el("div", { className: "ai-context-menu", attrs: { role: "menu" } });
  private readonly contextChips = el("div", { className: "ai-context-chips" });
  private readonly sendButton = el("button", { className: "ai-send-button", text: "Enviar", attrs: { "aria-label": "Enviar mensagem" } });
  private readonly stopButton = el("button", { className: "ai-stop-button", text: "Parar", attrs: { "aria-label": "Parar geração" } });
  private conversations: AIConversation[] = [];
  private current?: AIConversation;
  private settings?: AISettings;
  private providers: AIProviderDescriptor[] = [];
  private readonly selectedSources = new Set<AIContextSource>();
  private activeRequestId?: string;
  private activeAssistantId?: string;
  private streamContent = "";
  private disposed = false;
  private readonly disposeStream: () => void;

  constructor(
    contextHost: ContextCollectorHost,
    private readonly editorActions: AIChatEditorActions,
    private readonly updateStatus: (text: string) => void
  ) {
    this.collector = new ContextCollector(contextHost);
    this.markdown = new MarkdownRenderer({
      copy: code => navigator.clipboard.writeText(code),
      insertBelow: code => this.editorActions.insertBelow(code),
      replaceSelection: code => this.editorActions.replaceSelection(code),
      replaceFile: code => this.editorActions.replaceFile(code),
      createNewFile: (code, language) => this.editorActions.createNewFile(code, language),
      saveAsSnippet: (code, language) => this.saveSnippet(code, language)
    });
    this.disposeStream = api.ai.onStream(event => this.handleStream(event));
    this.build();
    void this.initialize();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeStream();
    if (this.activeRequestId) void api.ai.cancel(this.activeRequestId);
  }

  focusInput(): void {
    this.input.focus();
  }

  async newConversation(): Promise<void> {
    if (!this.settings) return;
    try {
      const conversation = await api.ai.createConversation(this.settings.provider, this.settings.model);
      this.conversations = [conversation, ...this.conversations];
      this.selectConversation(conversation);
      this.renderHistory();
      this.input.focus();
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao criar a conversa de IA");
    }
  }

  async clearConversation(): Promise<void> {
    if (!this.current || this.activeRequestId) return;
    this.current = await api.ai.updateConversation({ id: this.current.id, messages: [] });
    this.replaceConversation(this.current);
    this.renderMessages();
  }

  async runAction(action: string): Promise<void> {
    const prompt = ACTION_PROMPTS[action] ?? ACTION_PROMPTS.ask;
    if (action === "commit") this.selectedSources.add("gitDiff");
    else this.selectedSources.add("selection");
    this.input.value = prompt;
    this.renderContextChips();
    await this.send();
  }

  async changeProvider(): Promise<void> {
    this.providerSelect.focus();
    this.providerSelect.click();
  }

  async changeModel(): Promise<void> {
    this.modelSelect.focus();
    this.modelSelect.click();
  }

  private build(): void {
    const toolbar = el("div", { className: "ai-toolbar" });
    toolbar.append(
      buttonIcon("add", "Nova conversa", () => void this.newConversation()),
      buttonIcon("edit", "Renomear conversa", () => void this.renameConversation()),
      buttonIcon("trash", "Excluir conversa", () => void this.deleteConversation()),
      buttonIcon("settings-gear", "Configurações de IA", () => this.openSettings())
    );
    const history = el("section", { className: "ai-history" });
    history.append(this.conversationSearch, this.conversationList);
    const selector = el("div", { className: "ai-provider-row" });
    selector.append(this.providerSelect, this.modelSelect);
    const composer = el("section", { className: "ai-composer" });
    const contextButton = el("button", { className: "ai-context-button", text: "+ Contexto", attrs: { "aria-haspopup": "menu", "aria-expanded": "false" } });
    contextButton.addEventListener("click", () => {
      const visible = this.contextMenu.hidden;
      this.contextMenu.hidden = !visible;
      contextButton.setAttribute("aria-expanded", String(visible));
    });
    this.contextMenu.hidden = true;
    this.buildContextMenu();
    const composerActions = el("div", { className: "ai-composer-actions" });
    this.stopButton.hidden = true;
    composerActions.append(contextButton, this.contextMenu, el("span", { className: "ai-composer-spacer" }), this.stopButton, this.sendButton);
    composer.append(this.contextChips, this.input, composerActions);
    this.element.append(toolbar, history, selector, this.messages, composer);

    this.conversationSearch.addEventListener("input", () => this.renderHistory());
    this.providerSelect.addEventListener("change", () => void this.providerChanged());
    this.modelSelect.addEventListener("change", () => void this.modelChanged());
    this.sendButton.addEventListener("click", () => void this.send());
    this.stopButton.addEventListener("click", () => void this.stop());
    this.input.addEventListener("keydown", event => {
      if (event.key === "Enter" && event.ctrlKey) {
        event.preventDefault();
        void this.send();
      }
    });
    this.element.addEventListener("dragover", event => {
      event.preventDefault();
      this.element.classList.add("dragging");
    });
    this.element.addEventListener("dragleave", () => this.element.classList.remove("dragging"));
    this.element.addEventListener("drop", event => void this.handleDrop(event));
  }

  private async initialize(): Promise<void> {
    try {
      const [settings, providers, conversations] = await Promise.all([
        api.ai.loadSettings(),
        api.ai.providers(),
        api.ai.listConversations()
      ]);
      if (this.disposed) return;
      this.settings = settings;
      this.providers = providers;
      this.conversations = conversations;
      this.renderProviders();
      await this.renderModels();
      if (conversations.length) this.selectConversation(conversations[0]);
      else await this.newConversation();
      this.renderHistory();
    } catch (error) {
      reportError(error, this.updateStatus, "Falha ao inicializar o Chat de IA");
      this.messages.replaceChildren(el("div", { className: "ai-empty", text: "O Chat de IA não pôde ser inicializado." }));
    }
  }

  private buildContextMenu(): void {
    for (const option of CONTEXT_OPTIONS) {
      const label = el("label", { className: "ai-context-option" });
      const checkbox = el("input", { attrs: { type: "checkbox", "data-source": option.source } });
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selectedSources.add(option.source);
        else this.selectedSources.delete(option.source);
        this.renderContextChips();
      });
      label.append(checkbox, el("span", { text: option.label }));
      this.contextMenu.append(label);
    }
  }

  private renderProviders(): void {
    if (!this.settings) return;
    this.providerSelect.replaceChildren(...this.providers.map(provider =>
      el("option", { text: provider.displayName, attrs: { value: provider.id, ...(provider.id === this.settings?.provider ? { selected: "true" } : {}) } })
    ));
  }

  private async renderModels(): Promise<void> {
    if (!this.settings) return;
    this.modelSelect.replaceChildren(el("option", { text: "Carregando modelos…", attrs: { value: this.settings.model } }));
    try {
      const models = await api.ai.listModels(this.settings.provider);
      const ids = models.some(model => model.id === this.settings?.model)
        ? models
        : [{ id: this.settings.model, displayName: this.settings.model }, ...models];
      this.modelSelect.replaceChildren(...ids.map(model =>
        el("option", { text: model.displayName, attrs: { value: model.id, ...(model.id === this.settings?.model ? { selected: "true" } : {}) } })
      ));
    } catch (error) {
      console.warn("[NPSharp AI] Falha ao descobrir modelos; mantendo o modelo configurado.", error);
      this.modelSelect.replaceChildren(el("option", { text: this.settings.model, attrs: { value: this.settings.model } }));
    }
  }

  private renderHistory(): void {
    this.conversationList.replaceChildren();
    for (const conversation of this.history.filter(this.conversations, this.conversationSearch.value)) {
      const button = el("button", {
        className: `ai-conversation-row ${conversation.id === this.current?.id ? "active" : ""}`,
        attrs: { role: "listitem" }
      });
      button.append(
        el("span", { className: "ai-conversation-title", text: conversation.title }),
        el("span", { className: "ai-conversation-meta", text: formatRelativeTime(conversation.updatedAt) })
      );
      button.addEventListener("click", () => this.selectConversation(conversation));
      this.conversationList.append(button);
    }
  }

  private renderMessages(): void {
    this.messages.replaceChildren();
    if (!this.current?.messages.length) {
      this.messages.append(el("div", {
        className: "ai-empty",
        text: "Pergunte sobre o seu código, anexe contexto do editor ou use uma ação de IA no menu de contexto do editor."
      }));
      return;
    }
    for (const message of this.current.messages) {
      const article = el("article", { className: `ai-message ai-message-${message.role}`, attrs: { "data-message-id": message.id } });
      const header = el("header", { className: "ai-message-header" });
      header.append(
        el("strong", { text: message.role === "user" ? "Você" : "NPSharp AI" }),
        el("time", { text: new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
      );
      const body = message.role === "assistant"
        ? this.markdown.render(message.content || (this.activeAssistantId === message.id ? "Gerando…" : ""))
        : el("div", { className: "ai-user-content", text: message.content });
      article.append(header, body);
      if (message.contexts?.length) {
        article.append(el("div", { className: "ai-message-context", text: message.contexts.map(context => context.label).join(" · ") }));
      }
      if (message.error) article.append(el("div", { className: "ai-message-error", text: message.error }));
      if (message.stopped) article.append(el("div", { className: "ai-message-stopped", text: "Geração interrompida" }));
      if (message.role === "assistant") {
        const actions = el("footer", { className: "ai-message-actions" });
        const copy = el("button", { text: "Copiar resposta" });
        copy.addEventListener("click", () => void navigator.clipboard.writeText(message.content));
        const retry = el("button", { text: message.error ? "Tentar novamente" : "Regenerar" });
        retry.addEventListener("click", () => void this.regenerate(message.id));
        actions.append(copy, retry);
        article.append(actions);
      }
      this.messages.append(article);
    }
    this.scrollToBottom();
  }

  private renderContextChips(): void {
    this.contextChips.replaceChildren();
    const labels = new Map(CONTEXT_OPTIONS.map(option => [option.source, option.label]));
    for (const source of this.selectedSources) {
      const chip = el("button", { className: "ai-context-chip", text: `${labels.get(source) ?? source} ×`, title: "Remover contexto" });
      chip.addEventListener("click", () => {
        this.selectedSources.delete(source);
        const checkbox = this.contextMenu.querySelector<HTMLInputElement>(`[data-source="${source}"]`);
        if (checkbox) checkbox.checked = false;
        this.renderContextChips();
      });
      this.contextChips.append(chip);
    }
    for (const label of this.collector.droppedFileLabels()) {
      this.contextChips.append(el("span", { className: "ai-context-chip", text: label }));
    }
  }

  private selectConversation(conversation: AIConversation): void {
    this.current = conversation;
    if (this.settings) {
      this.settings = { ...this.settings, provider: conversation.provider, model: conversation.model || this.settings.model };
      this.renderProviders();
      void this.renderModels();
    }
    this.renderHistory();
    this.renderMessages();
  }

  private async send(): Promise<void> {
    const content = this.input.value.trim();
    if (!content || this.activeRequestId || !this.settings) return;
    if (!this.current) await this.newConversation();
    if (!this.current) return;
    this.setGenerating(true);
    try {
      const contexts = await this.collector.collect(this.selectedSources, content);
      const user: AIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
        contexts
      };
      this.input.value = "";
      await this.generate([...this.current.messages, user], contexts);
      this.collector.clearDroppedFiles();
      this.selectedSources.delete("files");
      this.renderContextChips();
    } catch (error) {
      this.setGenerating(false);
      reportError(error, this.updateStatus, "Falha na requisição de IA");
    }
  }

  private async generate(messages: AIMessage[], contexts: AIContextItem[]): Promise<void> {
    if (!this.current || !this.settings) return;
    const assistant: AIMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString()
    };
    const latestUser = [...messages].reverse().find(message => message.role === "user");
    const title = this.current.title === "Nova conversa"
      ? titleFromMessage(latestUser?.content ?? "")
      : this.current.title;
    this.current = await api.ai.updateConversation({
      id: this.current.id,
      title,
      provider: this.settings.provider,
      model: this.settings.model,
      messages: [...messages, assistant]
    });
    this.replaceConversation(this.current);
    this.activeRequestId = crypto.randomUUID();
    this.activeAssistantId = assistant.id;
    this.streamContent = "";
    this.renderHistory();
    this.renderMessages();
    const providerMessages = messages.map(message => ({ ...message, contexts: undefined }));
    void api.ai.send({
      requestId: this.activeRequestId,
      conversationId: this.current.id,
      messages: providerMessages,
      contexts,
      settings: this.settings
    }).catch(error => {
      if (!this.activeRequestId) return;
      this.handleStream({ requestId: this.activeRequestId, type: "error", message: error instanceof Error ? error.message : String(error) });
    });
  }

  private handleStream(event: AIStreamEvent): void {
    if (event.requestId !== this.activeRequestId || !this.current || !this.activeAssistantId) return;
    const assistant = this.current.messages.find(message => message.id === this.activeAssistantId);
    if (!assistant) return;
    if (event.type === "delta" && event.delta) {
      this.streamContent += event.delta;
      assistant.content = this.streamContent;
      this.renderMessages();
      return;
    }
    if (event.type === "error") assistant.error = event.message ?? "O provedor de IA falhou.";
    if (event.type === "cancelled") assistant.stopped = true;
    if (event.type === "complete" || event.type === "error" || event.type === "cancelled") {
      const completedConversation = this.current;
      this.activeRequestId = undefined;
      this.activeAssistantId = undefined;
      this.setGenerating(false);
      this.renderMessages();
      void api.ai.updateConversation({ id: completedConversation.id, messages: completedConversation.messages })
        .then(saved => this.replaceConversation(saved))
        .catch(error => reportError(error, this.updateStatus, "Falha ao salvar a conversa de IA"));
    }
  }

  private async stop(): Promise<void> {
    if (this.activeRequestId) await api.ai.cancel(this.activeRequestId);
  }

  private async regenerate(assistantId: string): Promise<void> {
    if (!this.current || this.activeRequestId) return;
    const index = this.current.messages.findIndex(message => message.id === assistantId);
    if (index < 0) return;
    const messages = this.current.messages.slice(0, index);
    const user = [...messages].reverse().find(message => message.role === "user");
    if (!user) return;
    this.setGenerating(true);
    try {
      await this.generate(messages, user.contexts ?? []);
    } catch (error) {
      this.setGenerating(false);
      reportError(error, this.updateStatus, "Falha ao regenerar a resposta");
    }
  }

  private async providerChanged(): Promise<void> {
    if (!this.settings) return;
    const provider = this.providerSelect.value as AIProviderId;
    const descriptor = this.providers.find(item => item.id === provider);
    this.settings = await api.ai.saveSettings({
      ...settingsRequest(this.settings),
      provider,
      model: descriptor?.defaultModel ?? this.settings.model
    });
    await this.renderModels();
    if (this.current) {
      this.current = await api.ai.updateConversation({ id: this.current.id, provider, model: this.settings.model });
      this.replaceConversation(this.current);
    }
  }

  private async modelChanged(): Promise<void> {
    if (!this.settings) return;
    this.settings = await api.ai.saveSettings({ ...settingsRequest(this.settings), model: this.modelSelect.value });
    if (this.current) {
      this.current = await api.ai.updateConversation({ id: this.current.id, model: this.settings.model });
      this.replaceConversation(this.current);
    }
  }

  private openSettings(): void {
    if (!this.settings) return;
    document.querySelector(".ai-settings-overlay")?.remove();
    const overlay = el("div", { className: "ai-settings-overlay" });
    const dialog = el("form", { className: "ai-settings-dialog", attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Configurações de IA" } });
    const provider = selectField("Provedor", this.providers.map(item => [item.id, item.displayName]), this.settings.provider);
    const key = textField("Chave da API", "", "password", "Deixe em branco para manter a chave salva");
    const model = textField("Modelo", this.settings.model);
    const temperature = numberField("Temperatura", this.settings.temperature, 0, 2, 0.1);
    const maxTokens = numberField("Máximo de tokens", this.settings.maxTokens, 1, 128000, 1);
    const contextSize = numberField("Tamanho do contexto", this.settings.contextSize, 1024, 1_050_000, 1024);
    const streaming = checkboxField("Streaming", this.settings.streaming);
    const systemPrompt = textareaField("Prompt do sistema", this.settings.systemPrompt);
    const ollamaUrl = textField("URL do Ollama", this.settings.ollamaBaseUrl);
    const keyStatus = el("div", { className: "ai-key-status", text: this.settings.apiKeyConfigured ? "Uma chave está armazenada com segurança para este provedor." : "Nenhuma chave de API está armazenada para este provedor." });
    const clearKey = checkboxField("Limpar chave de API salva", false);
    const actions = el("div", { className: "ai-settings-actions" });
    const cancel = el("button", { text: "Cancelar", attrs: { type: "button" } });
    const save = el("button", { className: "primary", text: "Salvar", attrs: { type: "submit" } });
    actions.append(cancel, save);
    dialog.append(
      el("h2", { text: "Configurações de IA" }),
      provider.row, key.row, keyStatus, model.row, temperature.row, maxTokens.row,
      contextSize.row, streaming.row, systemPrompt.row, ollamaUrl.row, clearKey.row, actions
    );
    overlay.append(dialog);
    document.body.append(overlay);
    cancel.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", event => {
      if (event.target === overlay) overlay.remove();
    });
    dialog.addEventListener("submit", event => {
      event.preventDefault();
      void api.ai.saveSettings({
        provider: provider.input.value as AIProviderId,
        apiKey: key.input.value || undefined,
        clearApiKey: clearKey.input.checked,
        model: model.input.value,
        temperature: temperature.input.valueAsNumber,
        maxTokens: maxTokens.input.valueAsNumber,
        streaming: streaming.input.checked,
        systemPrompt: systemPrompt.input.value,
        contextSize: contextSize.input.valueAsNumber,
        ollamaBaseUrl: ollamaUrl.input.value
      }).then(async settings => {
        this.settings = settings;
        this.renderProviders();
        await this.renderModels();
        overlay.remove();
        this.updateStatus("Configurações de IA salvas");
      }).catch(error => reportError(error, this.updateStatus, "Falha ao salvar as configurações de IA"));
    });
    provider.input.addEventListener("change", () => {
      const descriptor = this.providers.find(item => item.id === provider.input.value);
      if (descriptor) model.input.value = descriptor.defaultModel;
    });
    key.input.focus();
  }

  private async renameConversation(): Promise<void> {
    if (!this.current) return;
    const title = prompt("Nome da conversa", this.current.title);
    if (title === null) return;
    this.current = await api.ai.updateConversation({ id: this.current.id, title });
    this.replaceConversation(this.current);
    this.renderHistory();
  }

  private async deleteConversation(): Promise<void> {
    if (!this.current || !confirm(`Excluir "${this.current.title}"?`)) return;
    const id = this.current.id;
    if (this.activeRequestId) await this.stop();
    await api.ai.deleteConversation(id);
    this.conversations = this.conversations.filter(item => item.id !== id);
    this.current = this.conversations[0];
    if (!this.current) await this.newConversation();
    this.renderHistory();
    this.renderMessages();
  }

  private async handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.element.classList.remove("dragging");
    const files = [...(event.dataTransfer?.files ?? [])];
    for (const file of files) {
      try {
        this.collector.addDroppedFile(file.name, await file.text(), browserFilePath(file));
      } catch (error) {
        reportError(error, this.updateStatus, `Falha ao anexar ${file.name}`);
      }
    }
    if (files.length) this.selectedSources.add("files");
    this.renderContextChips();
  }

  private async saveSnippet(code: string, language: string): Promise<void> {
    const extension = extensionForLanguage(language);
    await api.dialog.saveFile({ suggestedName: `ai-snippet${extension}`, content: code });
  }

  private replaceConversation(conversation: AIConversation): void {
    this.conversations = [conversation, ...this.conversations.filter(item => item.id !== conversation.id)]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    if (this.current?.id === conversation.id) this.current = conversation;
  }

  private setGenerating(generating: boolean): void {
    this.sendButton.hidden = generating;
    this.stopButton.hidden = !generating;
    this.input.disabled = generating;
    this.providerSelect.disabled = generating;
    this.modelSelect.disabled = generating;
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      this.messages.scrollTop = this.messages.scrollHeight;
    });
  }
}

function titleFromMessage(message: string): string {
  return message.replace(/\s+/gu, " ").trim().slice(0, 60) || "Nova conversa";
}

function formatRelativeTime(value: string): string {
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60_000) return "agora";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h`;
  return new Date(value).toLocaleDateString();
}

function settingsRequest(settings: AISettings): Omit<AISettings, "apiKeyConfigured"> {
  const { apiKeyConfigured: _ignored, ...request } = settings;
  return request;
}

function browserFilePath(file: File): string | undefined {
  const path = (file as File & { path?: unknown }).path;
  return typeof path === "string" ? path : undefined;
}

function extensionForLanguage(language: string): string {
  const values: Record<string, string> = {
    typescript: ".ts", ts: ".ts", javascript: ".js", js: ".js", python: ".py", py: ".py",
    java: ".java", csharp: ".cs", cs: ".cs", cpp: ".cpp", c: ".c", rust: ".rs", go: ".go",
    html: ".html", css: ".css", json: ".json", markdown: ".md", md: ".md", shell: ".sh",
    bash: ".sh", powershell: ".ps1", php: ".php", ruby: ".rb", kotlin: ".kt", diff: ".diff"
  };
  return values[language.toLocaleLowerCase()] ?? ".txt";
}

function textField(label: string, value: string, type = "text", placeholder = ""): { row: HTMLElement; input: HTMLInputElement } {
  const input = el("input", { attrs: { type, value, placeholder } });
  return { row: fieldRow(label, input), input };
}

function numberField(label: string, value: number, min: number, max: number, step: number): { row: HTMLElement; input: HTMLInputElement } {
  const input = el("input", { attrs: { type: "number", value: String(value), min: String(min), max: String(max), step: String(step) } });
  return { row: fieldRow(label, input), input };
}

function checkboxField(label: string, value: boolean): { row: HTMLElement; input: HTMLInputElement } {
  const input = el("input", { attrs: { type: "checkbox", ...(value ? { checked: "true" } : {}) } });
  return { row: fieldRow(label, input), input };
}

function textareaField(label: string, value: string): { row: HTMLElement; input: HTMLTextAreaElement } {
  const input = el("textarea", { text: value, attrs: { rows: "5" } });
  return { row: fieldRow(label, input), input };
}

function selectField(label: string, options: Array<[string, string]>, value: string): { row: HTMLElement; input: HTMLSelectElement } {
  const input = el("select");
  input.append(...options.map(([id, name]) => el("option", { text: name, attrs: { value: id, ...(id === value ? { selected: "true" } : {}) } })));
  return { row: fieldRow(label, input), input };
}

function fieldRow(label: string, input: HTMLElement): HTMLElement {
  const row = el("label", { className: "ai-settings-field" });
  row.append(el("span", { text: label }), input);
  return row;
}
