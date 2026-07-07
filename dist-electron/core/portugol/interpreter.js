"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortugolInterpreter = void 0;
const lexer_1 = require("./lexer");
class PortugolInterpreter {
    variables = new Map();
    tokens = [];
    current = 0;
    inputProvider;
    outputHandler = () => undefined;
    setInputProvider(provider) {
        this.inputProvider = provider;
    }
    setOutputHandler(handler) {
        this.outputHandler = handler ?? (() => undefined);
    }
    executeWithOutput(source, output) {
        this.setOutputHandler(output);
        this.execute(source);
    }
    executeCollecting(source) {
        const out = [];
        this.executeWithOutput(source, line => out.push(line));
        return out;
    }
    execute(source) {
        try {
            this.variables.clear();
            this.tokens = new lexer_1.PortugolLexer(source).scanTokens();
            this.current = 0;
            this.consumeUntil(lexer_1.TokenType.VAR, lexer_1.TokenType.INICIO);
            if (this.match(lexer_1.TokenType.VAR)) {
                this.parseVarBlock();
            }
            this.consume(lexer_1.TokenType.INICIO, "Esperado 'inicio'.");
            this.consumeLineEnd();
            while (!this.check(lexer_1.TokenType.FIMALGORITMO) && !this.isAtEnd()) {
                this.executeStatement();
            }
            this.consume(lexer_1.TokenType.FIMALGORITMO, "Esperado 'fimalgoritmo'.");
        }
        catch (error) {
            if (error instanceof Error) {
                this.outputHandler(`[ERRO] ${error.message}`);
            }
            else {
                this.outputHandler(`[ERRO INTERNO] ${String(error)}`);
            }
        }
    }
    parseVarBlock() {
        while (!this.check(lexer_1.TokenType.INICIO) && !this.isAtEnd()) {
            if (this.match(lexer_1.TokenType.NEWLINE)) {
                continue;
            }
            const names = [this.consume(lexer_1.TokenType.IDENTIFIER, "Esperado nome da variável.")];
            while (this.match(lexer_1.TokenType.COMMA)) {
                names.push(this.consume(lexer_1.TokenType.IDENTIFIER, "Esperado nome da variável depois da vírgula."));
            }
            this.consume(lexer_1.TokenType.COLON, "Esperado ':' depois do nome da variável.");
            if (this.match(lexer_1.TokenType.INTEIRO) ||
                this.match(lexer_1.TokenType.REAL) ||
                this.match(lexer_1.TokenType.CARACTERE) ||
                this.match(lexer_1.TokenType.LITERAL) ||
                this.match(lexer_1.TokenType.LOGICO)) {
                for (const name of names) {
                    this.variables.set(this.normalizeName(name.lexeme), null);
                }
            }
            else {
                throw this.error(this.peek(), "Tipo de variável inválido.");
            }
            this.consumeLineEnd();
        }
    }
    executeStatement() {
        if (this.match(lexer_1.TokenType.NEWLINE))
            return;
        if (this.match(lexer_1.TokenType.ESCREVA)) {
            this.executeWrite();
            this.consumeLineEnd();
            return;
        }
        if (this.match(lexer_1.TokenType.ESCREVAL)) {
            this.executeWrite();
            this.consumeLineEnd();
            return;
        }
        if (this.match(lexer_1.TokenType.SE)) {
            this.executeIf();
            return;
        }
        if (this.match(lexer_1.TokenType.ENQUANTO)) {
            this.executeWhile();
            return;
        }
        if (this.check(lexer_1.TokenType.IDENTIFIER)) {
            this.executeAssignment();
            this.consumeLineEnd();
            return;
        }
        if (this.match(lexer_1.TokenType.LEIA)) {
            this.executeRead();
            this.consumeLineEnd();
            return;
        }
        if (this.match(lexer_1.TokenType.LIMPATELA)) {
            this.outputHandler("\n\n\n\n\n");
            this.consumeLineEnd();
            return;
        }
        if (this.check(lexer_1.TokenType.FIMALGORITMO) ||
            this.check(lexer_1.TokenType.FIMSE) ||
            this.check(lexer_1.TokenType.SENAO) ||
            this.check(lexer_1.TokenType.FIMENQUANTO)) {
            return;
        }
        throw this.error(this.peek(), `Comando inválido: ${this.peek().lexeme}`);
    }
    executeAssignment() {
        const name = this.consume(lexer_1.TokenType.IDENTIFIER, "Esperado nome da variável.");
        const varName = this.normalizeName(name.lexeme);
        if (!this.variables.has(varName)) {
            throw this.error(name, `Variável não declarada: ${name.lexeme}`);
        }
        this.consume(lexer_1.TokenType.ASSIGN, "Esperado '<-' na atribuição.");
        this.variables.set(varName, this.evaluateExpression());
    }
    executeWrite() {
        this.consume(lexer_1.TokenType.LEFT_PAREN, "Esperado '('.");
        const out = [];
        while (!this.check(lexer_1.TokenType.RIGHT_PAREN) && !this.isAtEnd()) {
            const value = this.evaluateExpression();
            out.push(value == null ? "" : String(value));
            if (!this.match(lexer_1.TokenType.COMMA)) {
                break;
            }
        }
        this.consume(lexer_1.TokenType.RIGHT_PAREN, "Esperado ')'.");
        this.outputHandler(out.join(" "));
    }
    executeRead() {
        this.consume(lexer_1.TokenType.LEFT_PAREN, "Esperado '('.");
        const name = this.consume(lexer_1.TokenType.IDENTIFIER, "Esperado nome da variável no leia.");
        this.consume(lexer_1.TokenType.RIGHT_PAREN, "Esperado ')'.");
        const varName = this.normalizeName(name.lexeme);
        if (!this.variables.has(varName)) {
            throw this.error(name, `Variável não declarada: ${name.lexeme}`);
        }
        if (!this.inputProvider) {
            this.variables.set(varName, "");
            return;
        }
        const raw = this.inputProvider();
        let converted = raw;
        const numeric = raw.includes(".") ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
        if (!Number.isNaN(numeric)) {
            converted = numeric;
        }
        this.variables.set(varName, converted);
    }
    executeIf() {
        const condition = this.toBoolean(this.evaluateExpression());
        this.consume(lexer_1.TokenType.ENTAO, "Esperado 'entao'.");
        this.consumeLineEnd();
        if (condition) {
            this.executeUntil(lexer_1.TokenType.SENAO, lexer_1.TokenType.FIMSE);
            if (this.match(lexer_1.TokenType.SENAO)) {
                this.skipUntil(lexer_1.TokenType.FIMSE);
            }
            this.consume(lexer_1.TokenType.FIMSE, "Esperado 'fimse'.");
            this.consumeLineEnd();
            return;
        }
        this.skipUntil(lexer_1.TokenType.SENAO, lexer_1.TokenType.FIMSE);
        if (this.match(lexer_1.TokenType.SENAO)) {
            if (!this.check(lexer_1.TokenType.NEWLINE) && !this.check(lexer_1.TokenType.FIMSE)) {
                if (!this.toBoolean(this.evaluateExpression())) {
                    this.skipUntil(lexer_1.TokenType.FIMSE);
                    this.consume(lexer_1.TokenType.FIMSE, "Esperado 'fimse'.");
                    this.consumeLineEnd();
                    return;
                }
                if (this.check(lexer_1.TokenType.ENTAO)) {
                    this.advance();
                }
            }
            this.consumeLineEnd();
            this.executeUntil(lexer_1.TokenType.FIMSE);
        }
        this.consume(lexer_1.TokenType.FIMSE, "Esperado 'fimse'.");
        this.consumeLineEnd();
    }
    executeWhile() {
        const conditionStart = this.current;
        while (true) {
            this.current = conditionStart;
            const condition = this.toBoolean(this.evaluateExpression());
            this.consume(lexer_1.TokenType.FACA, "Esperado 'faca'.");
            this.consumeLineEnd();
            const bodyStart = this.current;
            if (!condition) {
                this.skipUntil(lexer_1.TokenType.FIMENQUANTO);
                this.consume(lexer_1.TokenType.FIMENQUANTO, "Esperado 'fimenquanto'.");
                this.consumeLineEnd();
                return;
            }
            this.executeUntil(lexer_1.TokenType.FIMENQUANTO);
            this.consume(lexer_1.TokenType.FIMENQUANTO, "Esperado 'fimenquanto'.");
            this.consumeLineEnd();
            this.current = conditionStart;
            if (bodyStart === this.current) {
                throw this.error(this.peek(), "Loop inválido.");
            }
        }
    }
    executeUntil(...stopTypes) {
        while (!this.isAtEnd() && !this.checkAny(...stopTypes)) {
            this.executeStatement();
        }
    }
    skipUntil(...stopTypes) {
        const stops = new Set(stopTypes);
        let ifDepth = 0;
        let whileDepth = 0;
        while (!this.isAtEnd()) {
            const type = this.peek().type;
            if (ifDepth === 0 && whileDepth === 0 && stops.has(type)) {
                return;
            }
            if (type === lexer_1.TokenType.SE) {
                ifDepth++;
            }
            else if (type === lexer_1.TokenType.FIMSE && ifDepth > 0) {
                ifDepth--;
            }
            else if (type === lexer_1.TokenType.ENQUANTO) {
                whileDepth++;
            }
            else if (type === lexer_1.TokenType.FIMENQUANTO && whileDepth > 0) {
                whileDepth--;
            }
            this.advance();
        }
    }
    evaluateExpression() {
        return this.evaluateOr();
    }
    evaluateOr() {
        let left = this.evaluateAnd();
        while (this.match(lexer_1.TokenType.OR)) {
            const right = this.evaluateAnd();
            left = this.toBoolean(left) || this.toBoolean(right);
        }
        return left;
    }
    evaluateAnd() {
        let left = this.evaluateComparison();
        while (this.match(lexer_1.TokenType.AND)) {
            const right = this.evaluateComparison();
            left = this.toBoolean(left) && this.toBoolean(right);
        }
        return left;
    }
    evaluateComparison() {
        let left = this.evaluateAddition();
        while (this.match(lexer_1.TokenType.GREATER) ||
            this.match(lexer_1.TokenType.GREATER_EQUAL) ||
            this.match(lexer_1.TokenType.LESS) ||
            this.match(lexer_1.TokenType.LESS_EQUAL) ||
            this.match(lexer_1.TokenType.EQUAL) ||
            this.match(lexer_1.TokenType.NOT_EQUAL)) {
            const operator = this.previous();
            const right = this.evaluateAddition();
            switch (operator.type) {
                case lexer_1.TokenType.GREATER:
                    left = this.toNumber(left) > this.toNumber(right);
                    break;
                case lexer_1.TokenType.GREATER_EQUAL:
                    left = this.toNumber(left) >= this.toNumber(right);
                    break;
                case lexer_1.TokenType.LESS:
                    left = this.toNumber(left) < this.toNumber(right);
                    break;
                case lexer_1.TokenType.LESS_EQUAL:
                    left = this.toNumber(left) <= this.toNumber(right);
                    break;
                case lexer_1.TokenType.EQUAL:
                    left = this.valuesEqual(left, right);
                    break;
                case lexer_1.TokenType.NOT_EQUAL:
                    left = !this.valuesEqual(left, right);
                    break;
            }
        }
        return left;
    }
    evaluateAddition() {
        let left = this.evaluateMultiplication();
        while (this.match(lexer_1.TokenType.PLUS) || this.match(lexer_1.TokenType.MINUS)) {
            const operator = this.previous();
            const right = this.evaluateMultiplication();
            if (operator.type === lexer_1.TokenType.PLUS) {
                left = typeof left === "string" || typeof right === "string"
                    ? String(left) + String(right)
                    : this.normalizeNumber(this.toNumber(left) + this.toNumber(right));
            }
            else {
                left = this.normalizeNumber(this.toNumber(left) - this.toNumber(right));
            }
        }
        return left;
    }
    evaluateMultiplication() {
        let left = this.evaluateUnary();
        while (this.match(lexer_1.TokenType.STAR) || this.match(lexer_1.TokenType.SLASH)) {
            const operator = this.previous();
            const right = this.evaluateUnary();
            left = operator.type === lexer_1.TokenType.STAR
                ? this.normalizeNumber(this.toNumber(left) * this.toNumber(right))
                : this.normalizeNumber(this.toNumber(left) / this.toNumber(right));
        }
        return left;
    }
    evaluateUnary() {
        if (this.match(lexer_1.TokenType.MINUS)) {
            return this.normalizeNumber(-this.toNumber(this.evaluateUnary()));
        }
        if (this.match(lexer_1.TokenType.NOT)) {
            return !this.toBoolean(this.evaluateUnary());
        }
        return this.evaluatePrimary();
    }
    evaluatePrimary() {
        if (this.match(lexer_1.TokenType.STRING))
            return this.previous().lexeme;
        if (this.match(lexer_1.TokenType.NUMBER)) {
            const raw = this.previous().lexeme;
            return raw.includes(".") ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
        }
        if (this.match(lexer_1.TokenType.BOOLEAN)) {
            return this.previous().lexeme.toLowerCase() === "verdadeiro";
        }
        if (this.match(lexer_1.TokenType.IDENTIFIER)) {
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
        if (this.match(lexer_1.TokenType.LEFT_PAREN)) {
            const value = this.evaluateExpression();
            this.consume(lexer_1.TokenType.RIGHT_PAREN, "Esperado ')'.");
            return value;
        }
        throw this.error(this.peek(), `Valor inválido: ${this.peek().lexeme}`);
    }
    valuesEqual(a, b) {
        if (typeof a === "number" && typeof b === "number") {
            return Object.is(a, b) || Math.abs(a - b) === 0;
        }
        return String(a).toLowerCase() === String(b).toLowerCase();
    }
    toNumber(value) {
        if (typeof value === "number") {
            return value;
        }
        throw new Error(`Valor não numérico: ${String(value)}`);
    }
    toBoolean(value) {
        if (typeof value === "boolean")
            return value;
        if (typeof value === "number")
            return value !== 0;
        const normalized = String(value).toLowerCase();
        return normalized === "true" || normalized === "verdadeiro";
    }
    normalizeNumber(value) {
        return value === Math.round(value) ? Math.trunc(value) : value;
    }
    normalizeName(name) {
        return name.toLowerCase();
    }
    consumeLineEnd() {
        while (this.match(lexer_1.TokenType.NEWLINE)) {
            // consumes all adjacent line breaks, like the Java implementation
        }
    }
    consumeUntil(...types) {
        while (!this.isAtEnd()) {
            if (types.some(type => this.check(type)))
                return;
            this.advance();
        }
    }
    checkAny(...types) {
        return types.some(type => this.check(type));
    }
    match(type) {
        if (!this.check(type))
            return false;
        this.advance();
        return true;
    }
    check(type) {
        if (this.isAtEnd())
            return false;
        return this.peek().type === type;
    }
    consume(type, message) {
        if (this.check(type))
            return this.advance();
        throw this.error(this.peek(), message);
    }
    advance() {
        if (!this.isAtEnd())
            this.current++;
        return this.previous();
    }
    isAtEnd() {
        return this.peek().type === lexer_1.TokenType.EOF;
    }
    peek() {
        return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1];
    }
    previous() {
        return this.tokens[this.current - 1] ?? this.tokens[0];
    }
    error(token, message) {
        return new Error(`${message} Perto de: '${token.lexeme}'`);
    }
}
exports.PortugolInterpreter = PortugolInterpreter;
//# sourceMappingURL=interpreter.js.map