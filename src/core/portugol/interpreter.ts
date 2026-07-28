/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { PortugolLexer, Token, TokenType } from "./lexer";

export type PortugolInputProvider = () => string;
export type PortugolOutputHandler = (line: string) => void;

export class PortugolInterpreter {
  private variables = new Map<string, unknown>();
  private tokens: Token[] = [];
  private current = 0;
  private inputProvider?: PortugolInputProvider;
  private outputHandler: PortugolOutputHandler = () => undefined;

  setInputProvider(provider?: PortugolInputProvider): void {
    this.inputProvider = provider;
  }

  setOutputHandler(handler?: PortugolOutputHandler): void {
    this.outputHandler = handler ?? (() => undefined);
  }

  executeWithOutput(source: string, output: PortugolOutputHandler): void {
    this.setOutputHandler(output);
    this.execute(source);
  }

  executeCollecting(source: string): string[] {
    const out: string[] = [];
    this.executeWithOutput(source, line => out.push(line));
    return out;
  }

  execute(source: string): void {
    try {
      this.variables.clear();
      this.tokens = new PortugolLexer(source).scanTokens();
      this.current = 0;

      this.consumeUntil(TokenType.VAR, TokenType.INICIO);

      if (this.match(TokenType.VAR)) {
        this.parseVarBlock();
      }

      this.consume(TokenType.INICIO, "Esperado 'inicio'.");
      this.consumeLineEnd();

      while (!this.check(TokenType.FIMALGORITMO) && !this.isAtEnd()) {
        this.executeStatement();
      }

      this.consume(TokenType.FIMALGORITMO, "Esperado 'fimalgoritmo'.");
    } catch (error) {
      if (error instanceof Error) {
        this.outputHandler(`[ERRO] ${error.message}`);
      } else {
        this.outputHandler(`[ERRO INTERNO] ${String(error)}`);
      }
    }
  }

  private parseVarBlock(): void {
    while (!this.check(TokenType.INICIO) && !this.isAtEnd()) {
      if (this.match(TokenType.NEWLINE)) {
        continue;
      }

      const names: Token[] = [this.consume(TokenType.IDENTIFIER, "Esperado nome da variável.")];
      while (this.match(TokenType.COMMA)) {
        names.push(this.consume(TokenType.IDENTIFIER, "Esperado nome da variável depois da vírgula."));
      }

      this.consume(TokenType.COLON, "Esperado ':' depois do nome da variável.");

      if (
        this.match(TokenType.INTEIRO) ||
        this.match(TokenType.REAL) ||
        this.match(TokenType.CARACTERE) ||
        this.match(TokenType.LITERAL) ||
        this.match(TokenType.LOGICO)
      ) {
        for (const name of names) {
          this.variables.set(this.normalizeName(name.lexeme), null);
        }
      } else {
        throw this.error(this.peek(), "Tipo de variável inválido.");
      }

      this.consumeLineEnd();
    }
  }

  private executeStatement(): void {
    if (this.match(TokenType.NEWLINE)) return;

    if (this.match(TokenType.ESCREVA)) {
      this.executeWrite();
      this.consumeLineEnd();
      return;
    }

    if (this.match(TokenType.ESCREVAL)) {
      this.executeWrite();
      this.consumeLineEnd();
      return;
    }

    if (this.match(TokenType.SE)) {
      this.executeIf();
      return;
    }

    if (this.match(TokenType.ENQUANTO)) {
      this.executeWhile();
      return;
    }

    if (this.check(TokenType.IDENTIFIER)) {
      this.executeAssignment();
      this.consumeLineEnd();
      return;
    }

    if (this.match(TokenType.LEIA)) {
      this.executeRead();
      this.consumeLineEnd();
      return;
    }

    if (this.match(TokenType.LIMPATELA)) {
      this.outputHandler("\n\n\n\n\n");
      this.consumeLineEnd();
      return;
    }

    if (
      this.check(TokenType.FIMALGORITMO) ||
      this.check(TokenType.FIMSE) ||
      this.check(TokenType.SENAO) ||
      this.check(TokenType.FIMENQUANTO)
    ) {
      return;
    }

    throw this.error(this.peek(), `Comando inválido: ${this.peek().lexeme}`);
  }

  private executeAssignment(): void {
    const name = this.consume(TokenType.IDENTIFIER, "Esperado nome da variável.");
    const varName = this.normalizeName(name.lexeme);
    if (!this.variables.has(varName)) {
      throw this.error(name, `Variável não declarada: ${name.lexeme}`);
    }

    this.consume(TokenType.ASSIGN, "Esperado '<-' na atribuição.");
    this.variables.set(varName, this.evaluateExpression());
  }

  private executeWrite(): void {
    this.consume(TokenType.LEFT_PAREN, "Esperado '('.");
    const out: string[] = [];

    while (!this.check(TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
      const value = this.evaluateExpression();
      out.push(value == null ? "" : String(value));

      if (!this.match(TokenType.COMMA)) {
        break;
      }
    }

    this.consume(TokenType.RIGHT_PAREN, "Esperado ')'.");
    this.outputHandler(out.join(" "));
  }

  private executeRead(): void {
    this.consume(TokenType.LEFT_PAREN, "Esperado '('.");
    const name = this.consume(TokenType.IDENTIFIER, "Esperado nome da variável no leia.");
    this.consume(TokenType.RIGHT_PAREN, "Esperado ')'.");

    const varName = this.normalizeName(name.lexeme);
    if (!this.variables.has(varName)) {
      throw this.error(name, `Variável não declarada: ${name.lexeme}`);
    }

    if (!this.inputProvider) {
      this.variables.set(varName, "");
      return;
    }

    const raw = this.inputProvider();
    let converted: unknown = raw;
    const numeric = raw.includes(".") ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
    if (!Number.isNaN(numeric)) {
      converted = numeric;
    }
    this.variables.set(varName, converted);
  }

  private executeIf(): void {
    const condition = this.toBoolean(this.evaluateExpression());
    this.consume(TokenType.ENTAO, "Esperado 'entao'.");
    this.consumeLineEnd();

    if (condition) {
      this.executeUntil(TokenType.SENAO, TokenType.FIMSE);
      if (this.match(TokenType.SENAO)) {
        this.skipUntil(TokenType.FIMSE);
      }
      this.consume(TokenType.FIMSE, "Esperado 'fimse'.");
      this.consumeLineEnd();
      return;
    }

    this.skipUntil(TokenType.SENAO, TokenType.FIMSE);
    if (this.match(TokenType.SENAO)) {
      if (!this.check(TokenType.NEWLINE) && !this.check(TokenType.FIMSE)) {
        if (!this.toBoolean(this.evaluateExpression())) {
          this.skipUntil(TokenType.FIMSE);
          this.consume(TokenType.FIMSE, "Esperado 'fimse'.");
          this.consumeLineEnd();
          return;
        }
        if (this.check(TokenType.ENTAO)) {
          this.advance();
        }
      }

      this.consumeLineEnd();
      this.executeUntil(TokenType.FIMSE);
    }

    this.consume(TokenType.FIMSE, "Esperado 'fimse'.");
    this.consumeLineEnd();
  }

  private executeWhile(): void {
    const conditionStart = this.current;

    while (true) {
      this.current = conditionStart;
      const condition = this.toBoolean(this.evaluateExpression());
      this.consume(TokenType.FACA, "Esperado 'faca'.");
      this.consumeLineEnd();

      const bodyStart = this.current;

      if (!condition) {
        this.skipUntil(TokenType.FIMENQUANTO);
        this.consume(TokenType.FIMENQUANTO, "Esperado 'fimenquanto'.");
        this.consumeLineEnd();
        return;
      }

      this.executeUntil(TokenType.FIMENQUANTO);
      this.consume(TokenType.FIMENQUANTO, "Esperado 'fimenquanto'.");
      this.consumeLineEnd();
      this.current = conditionStart;

      if (bodyStart === this.current) {
        throw this.error(this.peek(), "Loop inválido.");
      }
    }
  }

  private executeUntil(...stopTypes: TokenType[]): void {
    while (!this.isAtEnd() && !this.checkAny(...stopTypes)) {
      this.executeStatement();
    }
  }

  private skipUntil(...stopTypes: TokenType[]): void {
    const stops = new Set(stopTypes);
    let ifDepth = 0;
    let whileDepth = 0;

    while (!this.isAtEnd()) {
      const type = this.peek().type;
      if (ifDepth === 0 && whileDepth === 0 && stops.has(type)) {
        return;
      }
      if (type === TokenType.SE) {
        ifDepth++;
      } else if (type === TokenType.FIMSE && ifDepth > 0) {
        ifDepth--;
      } else if (type === TokenType.ENQUANTO) {
        whileDepth++;
      } else if (type === TokenType.FIMENQUANTO && whileDepth > 0) {
        whileDepth--;
      }
      this.advance();
    }
  }

  private evaluateExpression(): unknown {
    return this.evaluateOr();
  }

  private evaluateOr(): unknown {
    let left = this.evaluateAnd();
    while (this.match(TokenType.OR)) {
      const right = this.evaluateAnd();
      left = this.toBoolean(left) || this.toBoolean(right);
    }
    return left;
  }

  private evaluateAnd(): unknown {
    let left = this.evaluateComparison();
    while (this.match(TokenType.AND)) {
      const right = this.evaluateComparison();
      left = this.toBoolean(left) && this.toBoolean(right);
    }
    return left;
  }

  private evaluateComparison(): unknown {
    let left = this.evaluateAddition();
    while (
      this.match(TokenType.GREATER) ||
      this.match(TokenType.GREATER_EQUAL) ||
      this.match(TokenType.LESS) ||
      this.match(TokenType.LESS_EQUAL) ||
      this.match(TokenType.EQUAL) ||
      this.match(TokenType.NOT_EQUAL)
    ) {
      const operator = this.previous();
      const right = this.evaluateAddition();
      switch (operator.type) {
        case TokenType.GREATER:
          left = this.toNumber(left) > this.toNumber(right);
          break;
        case TokenType.GREATER_EQUAL:
          left = this.toNumber(left) >= this.toNumber(right);
          break;
        case TokenType.LESS:
          left = this.toNumber(left) < this.toNumber(right);
          break;
        case TokenType.LESS_EQUAL:
          left = this.toNumber(left) <= this.toNumber(right);
          break;
        case TokenType.EQUAL:
          left = this.valuesEqual(left, right);
          break;
        case TokenType.NOT_EQUAL:
          left = !this.valuesEqual(left, right);
          break;
      }
    }
    return left;
  }

  private evaluateAddition(): unknown {
    let left = this.evaluateMultiplication();
    while (this.match(TokenType.PLUS) || this.match(TokenType.MINUS)) {
      const operator = this.previous();
      const right = this.evaluateMultiplication();
      if (operator.type === TokenType.PLUS) {
        left = typeof left === "string" || typeof right === "string"
          ? String(left) + String(right)
          : this.normalizeNumber(this.toNumber(left) + this.toNumber(right));
      } else {
        left = this.normalizeNumber(this.toNumber(left) - this.toNumber(right));
      }
    }
    return left;
  }

  private evaluateMultiplication(): unknown {
    let left = this.evaluateUnary();
    while (this.match(TokenType.STAR) || this.match(TokenType.SLASH)) {
      const operator = this.previous();
      const right = this.evaluateUnary();
      left = operator.type === TokenType.STAR
        ? this.normalizeNumber(this.toNumber(left) * this.toNumber(right))
        : this.normalizeNumber(this.toNumber(left) / this.toNumber(right));
    }
    return left;
  }

  private evaluateUnary(): unknown {
    if (this.match(TokenType.MINUS)) {
      return this.normalizeNumber(-this.toNumber(this.evaluateUnary()));
    }
    if (this.match(TokenType.NOT)) {
      return !this.toBoolean(this.evaluateUnary());
    }
    return this.evaluatePrimary();
  }

  private evaluatePrimary(): unknown {
    if (this.match(TokenType.STRING)) return this.previous().lexeme;
    if (this.match(TokenType.NUMBER)) {
      const raw = this.previous().lexeme;
      return raw.includes(".") ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
    }
    if (this.match(TokenType.BOOLEAN)) {
      return this.previous().lexeme.toLowerCase() === "verdadeiro";
    }
    if (this.match(TokenType.IDENTIFIER)) {
      const name = this.normalizeName(this.previous().lexeme);
      if (!this.variables.has(name)) {
        throw this.error(this.previous(), `Variável não declarada: ${name}`);
      }
      const value = this.variables.get(name);
      if (value == null) {
        throw this.error(this.previous(), `Variável sem valor: ${name}`);
      }
      return value;
    }
    if (this.match(TokenType.LEFT_PAREN)) {
      const value = this.evaluateExpression();
      this.consume(TokenType.RIGHT_PAREN, "Esperado ')'.");
      return value;
    }
    throw this.error(this.peek(), `Valor inválido: ${this.peek().lexeme}`);
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
    if (typeof a === "number" && typeof b === "number") {
      return Object.is(a, b) || Math.abs(a - b) === 0;
    }
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  private toNumber(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }
    throw new Error(`Valor não numérico: ${String(value)}`);
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = String(value).toLowerCase();
    return normalized === "true" || normalized === "verdadeiro";
  }

  private normalizeNumber(value: number): number {
    return value === Math.round(value) ? Math.trunc(value) : value;
  }

  private normalizeName(name: string): string {
    return name.toLowerCase();
  }

  private consumeLineEnd(): void {
    while (this.match(TokenType.NEWLINE)) {
      // consumes all adjacent line breaks, like the Java implementation
    }
  }

  private consumeUntil(...types: TokenType[]): void {
    while (!this.isAtEnd()) {
      if (types.some(type => this.check(type))) return;
      this.advance();
    }
  }

  private checkAny(...types: TokenType[]): boolean {
    return types.some(type => this.check(type));
  }

  private match(type: TokenType): boolean {
    if (!this.check(type)) return false;
    this.advance();
    return true;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(this.peek(), message);
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1] ?? this.tokens[0];
  }

  private error(token: Token, message: string): Error {
    return new Error(`${message} Perto de: '${token.lexeme}'`);
  }
}
