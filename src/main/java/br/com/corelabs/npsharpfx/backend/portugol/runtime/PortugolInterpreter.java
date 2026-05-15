package br.com.corelabs.npsharpfx.backend.portugol.runtime;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import br.com.corelabs.npsharpfx.backend.portugol.lexer.Lexer;
import br.com.corelabs.npsharpfx.backend.portugol.lexer.Token;
import br.com.corelabs.npsharpfx.backend.portugol.lexer.TokenType;

public class PortugolInterpreter {

    private Consumer<String> outputHandler = System.out::println;
    private final Map<String, Object> variables = new HashMap<>();

    private List<Token> tokens;
    private int current;
    private java.util.function.Supplier<String> inputProvider;
    public void setInputProvider(java.util.function.Supplier<String> provider) {
    this.inputProvider = provider;
}

    public void setOutputHandler(Consumer<String> handler) {
        this.outputHandler = handler != null ? handler : System.out::println;
    }

    public void executeWithOutput(String source, Consumer<String> output) {
        setOutputHandler(output);
        execute(source);
    }

    public void execute(String source) {
        try {
            variables.clear();

            Lexer lexer = new Lexer(source);
            tokens = lexer.scanTokens();
            current = 0;

            consumeUntil(TokenType.VAR, TokenType.INICIO);

            if (match(TokenType.VAR)) {
                parseVarBlock();
            }

            consume(TokenType.INICIO, "Esperado 'inicio'.");
            consumeLineEnd();

            while (!check(TokenType.FIMALGORITMO) && !isAtEnd()) {
                executeStatement();
            }

            consume(TokenType.FIMALGORITMO, "Esperado 'fimalgoritmo'.");

        } catch (RuntimeException e) {
            outputHandler.accept("[ERRO] " + e.getMessage());
        } catch (Exception e) {
            outputHandler.accept("[ERRO INTERNO] " + e.getMessage());
        }
    }

    private void parseVarBlock() {
    while (!check(TokenType.INICIO) && !isAtEnd()) {
        if (match(TokenType.NEWLINE)) {
            continue;
        }

        java.util.List<Token> names = new java.util.ArrayList<>();

        names.add(consume(TokenType.IDENTIFIER, "Esperado nome da variável."));

        while (match(TokenType.COMMA)) {
            names.add(consume(TokenType.IDENTIFIER, "Esperado nome da variável depois da vírgula."));
        }

        consume(TokenType.COLON, "Esperado ':' depois do nome da variável.");

        if (
                match(TokenType.INTEIRO) ||
                match(TokenType.REAL) ||
                match(TokenType.CARACTERE) ||
                match(TokenType.LITERAL) ||
                match(TokenType.LOGICO)
        ) {
            for (Token name : names) {
                variables.put(normalizeName(name.getLexeme()), null);
            }
        } else {
            throw error(peek(), "Tipo de variável inválido.");
        }

        consumeLineEnd();
    }
}


private void executeRead() {

    consume(TokenType.LEFT_PAREN, "Esperado '('.");

    Token name =
            consume(
                    TokenType.IDENTIFIER,
                    "Esperado nome da variável no leia."
            );

    consume(TokenType.RIGHT_PAREN, "Esperado ')'.");

    String varName =
            normalizeName(name.getLexeme());

    if (!variables.containsKey(varName)) {
        throw error(
                name,
                "Variável não declarada: "
                        + name.getLexeme()
        );
    }

    if (inputProvider == null) {
        variables.put(varName, "");
        return;
    }

    String value =
            inputProvider.get();

    Object converted = value;

    try {

        if (value.contains(".")) {
            converted =
                    Double.parseDouble(value);
        } else {
            converted =
                    Integer.parseInt(value);
        }

    } catch (Exception ignored) {
    }

    variables.put(varName, converted);
}
private void executeClearScreen() {
    outputHandler.accept("\n\n\n\n\n");
}
    private void executeStatement() {
        if (match(TokenType.NEWLINE)) return;

        if (match(TokenType.ESCREVA)) {
            executeWrite();
            consumeLineEnd();
            return;
        }

        if (match(TokenType.ESCREVAL)) {
            executeWrite();
            consumeLineEnd();
            return;
        }

        if (match(TokenType.SE)) {
            executeIf();
            return;
        }

        if (match(TokenType.ENQUANTO)) {
            executeWhile();
            return;
        }

        if (check(TokenType.IDENTIFIER)) {
            executeAssignment();
            consumeLineEnd();
            return;
        }

        if (match(TokenType.LEIA)) {
    executeRead();
    consumeLineEnd();
    return;
}

if (match(TokenType.LIMPATELA)) {
    executeClearScreen();
    consumeLineEnd();
    return;
}

        if (
                check(TokenType.FIMALGORITMO) ||
                check(TokenType.FIMSE) ||
                check(TokenType.SENAO) ||
                check(TokenType.FIMENQUANTO)
        ) {
            return;
        }

        throw error(peek(), "Comando inválido: " + peek().getLexeme());
    }

    private void executeAssignment() {
        Token name = consume(TokenType.IDENTIFIER, "Esperado nome da variável.");
        String varName = normalizeName(name.getLexeme());

        if (!variables.containsKey(varName)) {
            throw error(name, "Variável não declarada: " + name.getLexeme());
        }

        consume(TokenType.ASSIGN, "Esperado '<-' na atribuição.");

        Object value = evaluateExpression();

        variables.put(varName, value);
    }

    private void executeWrite() {
        consume(TokenType.LEFT_PAREN, "Esperado '('.");

        StringBuilder out = new StringBuilder();

        while (!check(TokenType.RIGHT_PAREN) && !isAtEnd()) {
            Object value = evaluateExpression();
            out.append(value == null ? "" : value);

            if (match(TokenType.COMMA)) {
                out.append(" ");
            } else {
                break;
            }
        }

        consume(TokenType.RIGHT_PAREN, "Esperado ')'.");
        outputHandler.accept(out.toString());
    }

    private void executeIf() {
        boolean condition = toBoolean(evaluateExpression());

        consume(TokenType.ENTAO, "Esperado 'entao'.");
        consumeLineEnd();

        if (condition) {
            executeUntil(TokenType.SENAO, TokenType.FIMSE);

            if (match(TokenType.SENAO)) {
                skipUntil(TokenType.FIMSE);
            }

            consume(TokenType.FIMSE, "Esperado 'fimse'.");
            consumeLineEnd();
            return;
        }

        skipUntil(TokenType.SENAO, TokenType.FIMSE);

if (match(TokenType.SENAO)) {
    if (!check(TokenType.NEWLINE) && !check(TokenType.FIMSE)) {
        if (!toBoolean(evaluateExpression())) {
            skipUntil(TokenType.FIMSE);
            consume(TokenType.FIMSE, "Esperado 'fimse'.");
            consumeLineEnd();
            return;
        }

        if (check(TokenType.ENTAO)) {
            advance();
        }
    }

    consumeLineEnd();
    executeUntil(TokenType.FIMSE);
}
        consume(TokenType.FIMSE, "Esperado 'fimse'.");
        consumeLineEnd();
    }

    private void executeWhile() {
        int conditionStart = current;

        while (true) {
            current = conditionStart;

            boolean condition = toBoolean(evaluateExpression());

            consume(TokenType.FACA, "Esperado 'faca'.");
            consumeLineEnd();

            int bodyStart = current;

            if (!condition) {
                skipUntil(TokenType.FIMENQUANTO);
                consume(TokenType.FIMENQUANTO, "Esperado 'fimenquanto'.");
                consumeLineEnd();
                return;
            }

            executeUntil(TokenType.FIMENQUANTO);

            consume(TokenType.FIMENQUANTO, "Esperado 'fimenquanto'.");
            consumeLineEnd();

            current = conditionStart;

            if (bodyStart == current) {
                throw error(peek(), "Loop inválido.");
            }
        }
    }

    private void executeUntil(TokenType... stopTypes) {
        while (!isAtEnd() && !checkAny(stopTypes)) {
            executeStatement();
        }
    }

    private void skipUntil(TokenType... stopTypes) {
        while (!isAtEnd() && !checkAny(stopTypes)) {
            advance();
        }
    }

    private Object evaluateExpression() {
        return evaluateComparison();
    }

    private Object evaluateComparison() {
        Object left = evaluateAddition();

        while (
                match(TokenType.GREATER) ||
                match(TokenType.GREATER_EQUAL) ||
                match(TokenType.LESS) ||
                match(TokenType.LESS_EQUAL) ||
                match(TokenType.EQUAL) ||
                match(TokenType.NOT_EQUAL)
        ) {
            Token operator = previous();
            Object right = evaluateAddition();

            left = switch (operator.getType()) {
                case GREATER -> toNumber(left) > toNumber(right);
                case GREATER_EQUAL -> toNumber(left) >= toNumber(right);
                case LESS -> toNumber(left) < toNumber(right);
                case LESS_EQUAL -> toNumber(left) <= toNumber(right);
                case EQUAL -> valuesEqual(left, right);
                case NOT_EQUAL -> !valuesEqual(left, right);
                default -> throw error(operator, "Operador inválido.");
            };
        }

        return left;
    }

    private Object evaluateAddition() {
        Object left = evaluateMultiplication();

        while (match(TokenType.PLUS) || match(TokenType.MINUS)) {
            Token operator = previous();
            Object right = evaluateMultiplication();

            left = switch (operator.getType()) {
                case PLUS -> {
                    if (left instanceof String || right instanceof String) {
                        yield String.valueOf(left) + String.valueOf(right);
                    }

                    yield normalizeNumber(toNumber(left) + toNumber(right));
                }
                case MINUS -> normalizeNumber(toNumber(left) - toNumber(right));
                default -> throw error(operator, "Operador inválido.");
            };
        }

        return left;
    }

    private Object evaluateMultiplication() {
        Object left = evaluateUnary();

        while (match(TokenType.STAR) || match(TokenType.SLASH)) {
            Token operator = previous();
            Object right = evaluateUnary();

            left = switch (operator.getType()) {
                case STAR -> normalizeNumber(toNumber(left) * toNumber(right));
                case SLASH -> normalizeNumber(toNumber(left) / toNumber(right));
                default -> throw error(operator, "Operador inválido.");
            };
        }

        return left;
    }

    private Object evaluateUnary() {
        if (match(TokenType.MINUS)) {
            return normalizeNumber(-toNumber(evaluateUnary()));
        }

        if (match(TokenType.NOT)) {
            return !toBoolean(evaluateUnary());
        }

        return evaluatePrimary();
    }

    private Object evaluatePrimary() {
        if (match(TokenType.STRING)) {
            return previous().getLexeme();
        }

        if (match(TokenType.NUMBER)) {
            String raw = previous().getLexeme();

            if (raw.contains(".")) {
                return Double.parseDouble(raw);
            }

            return Integer.parseInt(raw);
        }

        if (match(TokenType.BOOLEAN)) {
            return previous().getLexeme().equalsIgnoreCase("verdadeiro");
        }

        if (match(TokenType.IDENTIFIER)) {
            String name = normalizeName(previous().getLexeme());

            if (!variables.containsKey(name)) {
                throw error(previous(), "Variável não declarada: " + name);
            }

            Object value = variables.get(name);

            if (value == null) {
                throw error(previous(), "Variável sem valor: " + name);
            }

            return value;
        }

        if (match(TokenType.LEFT_PAREN)) {
            Object value = evaluateExpression();
            consume(TokenType.RIGHT_PAREN, "Esperado ')'.");
            return value;
        }

        throw error(peek(), "Valor inválido: " + peek().getLexeme());
    }

    private boolean valuesEqual(Object a, Object b) {
        if (a instanceof Number && b instanceof Number) {
            return Double.compare(toNumber(a), toNumber(b)) == 0;
        }

        return String.valueOf(a).equalsIgnoreCase(String.valueOf(b));
    }

    private double toNumber(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }

        throw new RuntimeException("Valor não numérico: " + value);
    }

    private boolean toBoolean(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }

        if (value instanceof Number number) {
            return number.doubleValue() != 0;
        }

        return Boolean.parseBoolean(String.valueOf(value));
    }

    private Object normalizeNumber(double value) {
        if (value == Math.rint(value)) {
            return (int) value;
        }

        return value;
    }

    private String normalizeName(String name) {
        return name.toLowerCase();
    }

    private void consumeLineEnd() {
        while (match(TokenType.NEWLINE)) {
        }
    }

    private void consumeUntil(TokenType... types) {
        while (!isAtEnd()) {
            for (TokenType type : types) {
                if (check(type)) return;
            }

            advance();
        }
    }

    private boolean checkAny(TokenType... types) {
        for (TokenType type : types) {
            if (check(type)) return true;
        }

        return false;
    }

    private boolean match(TokenType type) {
        if (check(type)) {
            advance();
            return true;
        }

        return false;
    }

    private boolean check(TokenType type) {
        if (isAtEnd()) return false;
        return peek().getType() == type;
    }

    private Token consume(TokenType type, String message) {
        if (check(type)) return advance();
        throw error(peek(), message);
    }

    private Token advance() {
        if (!isAtEnd()) current++;
        return previous();
    }

    private boolean isAtEnd() {
        return peek().getType() == TokenType.EOF;
    }

    private Token peek() {
        return tokens.get(current);
    }

    private Token previous() {
        return tokens.get(current - 1);
    }

    private RuntimeException error(Token token, String message) {
        return new RuntimeException(message + " Perto de: '" + token.getLexeme() + "'");
    }
}