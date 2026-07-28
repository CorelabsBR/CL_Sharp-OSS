/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
export enum TokenType {
  ALGORITMO = "ALGORITMO",
  VAR = "VAR",
  INICIO = "INICIO",
  FIMALGORITMO = "FIMALGORITMO",
  ESCREVA = "ESCREVA",
  ESCREVAL = "ESCREVAL",
  INTEIRO = "INTEIRO",
  REAL = "REAL",
  LOGICO = "LOGICO",
  CARACTERE = "CARACTERE",
  LITERAL = "LITERAL",
  LIMPATELA = "LIMPATELA",
  LEIA = "LEIA",
  IDENTIFIER = "IDENTIFIER",
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  ASSIGN = "ASSIGN",
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  EQUAL = "EQUAL",
  NOT_EQUAL = "NOT_EQUAL",
  GREATER = "GREATER",
  GREATER_EQUAL = "GREATER_EQUAL",
  LESS = "LESS",
  LESS_EQUAL = "LESS_EQUAL",
  LEFT_PAREN = "LEFT_PAREN",
  RIGHT_PAREN = "RIGHT_PAREN",
  COLON = "COLON",
  COMMA = "COMMA",
  NEWLINE = "NEWLINE",
  SE = "SE",
  ENTAO = "ENTAO",
  SENAO = "SENAO",
  FIMSE = "FIMSE",
  ENQUANTO = "ENQUANTO",
  FACA = "FACA",
  FIMENQUANTO = "FIMENQUANTO",
  AND = "AND",
  OR = "OR",
  NOT = "NOT",
  LEFT_BRACKET = "LEFT_BRACKET",
  RIGHT_BRACKET = "RIGHT_BRACKET",
  DOT_DOT = "DOT_DOT",
  VETOR = "VETOR",
  DE = "DE",
  EOF = "EOF"
}

export interface Token {
  type: TokenType;
  lexeme: string;
  line: number;
  column: number;
}

const KEYWORDS = new Map<string, TokenType>([
  ["algoritmo", TokenType.ALGORITMO],
  ["var", TokenType.VAR],
  ["inicio", TokenType.INICIO],
  ["fimalgoritmo", TokenType.FIMALGORITMO],
  ["escreva", TokenType.ESCREVA],
  ["escreval", TokenType.ESCREVAL],
  ["se", TokenType.SE],
  ["entao", TokenType.ENTAO],
  ["então", TokenType.ENTAO],
  ["senao", TokenType.SENAO],
  ["senão", TokenType.SENAO],
  ["fimse", TokenType.FIMSE],
  ["enquanto", TokenType.ENQUANTO],
  ["faca", TokenType.FACA],
  ["faça", TokenType.FACA],
  ["fimenquanto", TokenType.FIMENQUANTO],
  ["inteiro", TokenType.INTEIRO],
  ["real", TokenType.REAL],
  ["logico", TokenType.LOGICO],
  ["lógico", TokenType.LOGICO],
  ["caractere", TokenType.CARACTERE],
  ["caracter", TokenType.CARACTERE],
  ["literal", TokenType.LITERAL],
  ["verdadeiro", TokenType.BOOLEAN],
  ["falso", TokenType.BOOLEAN],
  ["leia", TokenType.LEIA],
  ["limpatela", TokenType.LIMPATELA],
  ["e", TokenType.AND],
  ["ou", TokenType.OR],
  ["nao", TokenType.NOT],
  ["não", TokenType.NOT],
  ["vetor", TokenType.VETOR],
  ["de", TokenType.DE]
]);

export class PortugolLexer {
  private readonly source: string;
  private readonly tokens: Token[] = [];
  private index = 0;
  private line = 1;
  private column = 1;

  constructor(source: string | null | undefined) {
    this.source = source ?? "";
  }

  scanTokens(): Token[] {
    while (!this.isAtEnd()) {
      this.scanToken();
    }

    this.tokens.push({ type: TokenType.EOF, lexeme: "", line: this.line, column: this.column });
    return this.tokens;
  }

  private scanToken(): void {
    const char = this.advance();

    switch (char) {
      case " ":
      case "\r":
      case "\t":
        return;
      case "\n":
        this.newLine();
        return;
      case "(":
        this.add(TokenType.LEFT_PAREN, "(");
        return;
      case ")":
        this.add(TokenType.RIGHT_PAREN, ")");
        return;
      case ":":
        this.add(TokenType.COLON, ":");
        return;
      case ",":
        this.add(TokenType.COMMA, ",");
        return;
      case "+":
        this.add(TokenType.PLUS, "+");
        return;
      case "-":
        this.add(TokenType.MINUS, "-");
        return;
      case "*":
        this.add(TokenType.STAR, "*");
        return;
      case "/":
        if (this.match("/")) {
          this.skipLineComment();
        } else {
          this.add(TokenType.SLASH, "/");
        }
        return;
      case "\"":
        this.string();
        return;
      case "<":
        if (this.match("-")) this.add(TokenType.ASSIGN, "<-");
        else if (this.match("=")) this.add(TokenType.LESS_EQUAL, "<=");
        else if (this.match(">")) this.add(TokenType.NOT_EQUAL, "<>");
        else this.add(TokenType.LESS, "<");
        return;
      case ">":
        if (this.match("=")) this.add(TokenType.GREATER_EQUAL, ">=");
        else this.add(TokenType.GREATER, ">");
        return;
      case "=":
        this.add(TokenType.EQUAL, "=");
        return;
      case "[":
        this.add(TokenType.LEFT_BRACKET, "[");
        return;
      case "]":
        this.add(TokenType.RIGHT_BRACKET, "]");
        return;
      case ".":
        if (this.match(".")) {
          this.add(TokenType.DOT_DOT, "..");
          return;
        }
        throw this.error("Ponto isolado invalido");
      default:
        if (/\d/.test(char)) {
          this.number(char);
          return;
        }
        if (this.isIdentifierStart(char)) {
          this.identifier(char);
          return;
        }
        throw this.error(`Caractere invalido: ${char}`);
    }
  }

  private string(): void {
    const startColumn = this.column - 1;
    let value = "";

    while (!this.isAtEnd() && this.peek() !== "\"") {
      const char = this.advance();
      if (char === "\n") {
        this.line++;
        this.column = 1;
      }
      value += char;
    }

    if (this.isAtEnd()) {
      throw this.error("String nao finalizada");
    }

    this.advance();
    this.tokens.push({ type: TokenType.STRING, lexeme: value, line: this.line, column: startColumn });
  }

  private number(first: string): void {
    const startColumn = this.column - 1;
    let value = first;

    while (/\d/.test(this.peek())) {
      value += this.advance();
    }

    if (this.peek() === "." && /\d/.test(this.peekNext())) {
      value += this.advance();
      while (/\d/.test(this.peek())) {
        value += this.advance();
      }
    }

    this.tokens.push({ type: TokenType.NUMBER, lexeme: value, line: this.line, column: startColumn });
  }

  private identifier(first: string): void {
    const startColumn = this.column - 1;
    let value = first;

    while (this.isIdentifierPart(this.peek())) {
      value += this.advance();
    }

    const type = KEYWORDS.get(value.toLowerCase()) ?? TokenType.IDENTIFIER;
    this.tokens.push({ type, lexeme: value, line: this.line, column: startColumn });
  }

  private skipLineComment(): void {
    while (!this.isAtEnd() && this.peek() !== "\n") {
      this.advance();
    }
  }

  private newLine(): void {
    this.tokens.push({ type: TokenType.NEWLINE, lexeme: "\\n", line: this.line, column: this.column - 1 });
    this.line++;
    this.column = 1;
  }

  private isIdentifierStart(char: string): boolean {
    return /\p{L}|_/u.test(char);
  }

  private isIdentifierPart(char: string): boolean {
    return /[\p{L}\p{N}_]/u.test(char);
  }

  private advance(): string {
    const char = this.source[this.index] ?? "\0";
    this.index++;
    this.column++;
    return char;
  }

  private match(expected: string): boolean {
    if (this.isAtEnd() || this.source[this.index] !== expected) {
      return false;
    }

    this.index++;
    this.column++;
    return true;
  }

  private peek(): string {
    return this.source[this.index] ?? "\0";
  }

  private peekNext(): string {
    return this.source[this.index + 1] ?? "\0";
  }

  private isAtEnd(): boolean {
    return this.index >= this.source.length;
  }

  private add(type: TokenType, lexeme: string): void {
    this.tokens.push({ type, lexeme, line: this.line, column: this.column - 1 });
  }

  private error(message: string): Error {
    return new Error(`[Linha ${this.line}, Coluna ${this.column}] ${message}`);
  }
}
