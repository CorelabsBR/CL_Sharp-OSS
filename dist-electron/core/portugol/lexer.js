"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortugolLexer = exports.TokenType = void 0;
var TokenType;
(function (TokenType) {
    TokenType["ALGORITMO"] = "ALGORITMO";
    TokenType["VAR"] = "VAR";
    TokenType["INICIO"] = "INICIO";
    TokenType["FIMALGORITMO"] = "FIMALGORITMO";
    TokenType["ESCREVA"] = "ESCREVA";
    TokenType["ESCREVAL"] = "ESCREVAL";
    TokenType["INTEIRO"] = "INTEIRO";
    TokenType["REAL"] = "REAL";
    TokenType["LOGICO"] = "LOGICO";
    TokenType["CARACTERE"] = "CARACTERE";
    TokenType["LITERAL"] = "LITERAL";
    TokenType["LIMPATELA"] = "LIMPATELA";
    TokenType["LEIA"] = "LEIA";
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    TokenType["STRING"] = "STRING";
    TokenType["NUMBER"] = "NUMBER";
    TokenType["BOOLEAN"] = "BOOLEAN";
    TokenType["ASSIGN"] = "ASSIGN";
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["STAR"] = "STAR";
    TokenType["SLASH"] = "SLASH";
    TokenType["EQUAL"] = "EQUAL";
    TokenType["NOT_EQUAL"] = "NOT_EQUAL";
    TokenType["GREATER"] = "GREATER";
    TokenType["GREATER_EQUAL"] = "GREATER_EQUAL";
    TokenType["LESS"] = "LESS";
    TokenType["LESS_EQUAL"] = "LESS_EQUAL";
    TokenType["LEFT_PAREN"] = "LEFT_PAREN";
    TokenType["RIGHT_PAREN"] = "RIGHT_PAREN";
    TokenType["COLON"] = "COLON";
    TokenType["COMMA"] = "COMMA";
    TokenType["NEWLINE"] = "NEWLINE";
    TokenType["SE"] = "SE";
    TokenType["ENTAO"] = "ENTAO";
    TokenType["SENAO"] = "SENAO";
    TokenType["FIMSE"] = "FIMSE";
    TokenType["ENQUANTO"] = "ENQUANTO";
    TokenType["FACA"] = "FACA";
    TokenType["FIMENQUANTO"] = "FIMENQUANTO";
    TokenType["AND"] = "AND";
    TokenType["OR"] = "OR";
    TokenType["NOT"] = "NOT";
    TokenType["LEFT_BRACKET"] = "LEFT_BRACKET";
    TokenType["RIGHT_BRACKET"] = "RIGHT_BRACKET";
    TokenType["DOT_DOT"] = "DOT_DOT";
    TokenType["VETOR"] = "VETOR";
    TokenType["DE"] = "DE";
    TokenType["EOF"] = "EOF";
})(TokenType || (exports.TokenType = TokenType = {}));
const KEYWORDS = new Map([
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
class PortugolLexer {
    source;
    tokens = [];
    index = 0;
    line = 1;
    column = 1;
    constructor(source) {
        this.source = source ?? "";
    }
    scanTokens() {
        while (!this.isAtEnd()) {
            this.scanToken();
        }
        this.tokens.push({ type: TokenType.EOF, lexeme: "", line: this.line, column: this.column });
        return this.tokens;
    }
    scanToken() {
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
                }
                else {
                    this.add(TokenType.SLASH, "/");
                }
                return;
            case "\"":
                this.string();
                return;
            case "<":
                if (this.match("-"))
                    this.add(TokenType.ASSIGN, "<-");
                else if (this.match("="))
                    this.add(TokenType.LESS_EQUAL, "<=");
                else if (this.match(">"))
                    this.add(TokenType.NOT_EQUAL, "<>");
                else
                    this.add(TokenType.LESS, "<");
                return;
            case ">":
                if (this.match("="))
                    this.add(TokenType.GREATER_EQUAL, ">=");
                else
                    this.add(TokenType.GREATER, ">");
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
    string() {
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
    number(first) {
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
    identifier(first) {
        const startColumn = this.column - 1;
        let value = first;
        while (this.isIdentifierPart(this.peek())) {
            value += this.advance();
        }
        const type = KEYWORDS.get(value.toLowerCase()) ?? TokenType.IDENTIFIER;
        this.tokens.push({ type, lexeme: value, line: this.line, column: startColumn });
    }
    skipLineComment() {
        while (!this.isAtEnd() && this.peek() !== "\n") {
            this.advance();
        }
    }
    newLine() {
        this.tokens.push({ type: TokenType.NEWLINE, lexeme: "\\n", line: this.line, column: this.column - 1 });
        this.line++;
        this.column = 1;
    }
    isIdentifierStart(char) {
        return /\p{L}|_/u.test(char);
    }
    isIdentifierPart(char) {
        return /[\p{L}\p{N}_]/u.test(char);
    }
    advance() {
        const char = this.source[this.index] ?? "\0";
        this.index++;
        this.column++;
        return char;
    }
    match(expected) {
        if (this.isAtEnd() || this.source[this.index] !== expected) {
            return false;
        }
        this.index++;
        this.column++;
        return true;
    }
    peek() {
        return this.source[this.index] ?? "\0";
    }
    peekNext() {
        return this.source[this.index + 1] ?? "\0";
    }
    isAtEnd() {
        return this.index >= this.source.length;
    }
    add(type, lexeme) {
        this.tokens.push({ type, lexeme, line: this.line, column: this.column - 1 });
    }
    error(message) {
        return new Error(`[Linha ${this.line}, Coluna ${this.column}] ${message}`);
    }
}
exports.PortugolLexer = PortugolLexer;
//# sourceMappingURL=lexer.js.map