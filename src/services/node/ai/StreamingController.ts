export class StreamingController {
  private readonly requests = new Map<string, AbortController>();

  start(requestId: string): AbortSignal {
    this.cancel(requestId);
    const controller = new AbortController();
    this.requests.set(requestId, controller);
    return controller.signal;
  }

  cancel(requestId: string): boolean {
    const controller = this.requests.get(requestId);
    if (!controller) return false;
    controller.abort();
    this.requests.delete(requestId);
    return true;
  }

  finish(requestId: string): void {
    this.requests.delete(requestId);
  }

  cancelAll(): void {
    for (const controller of this.requests.values()) controller.abort();
    this.requests.clear();
  }
}

