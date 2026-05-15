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
            this.tokens = lexer.scanTokens();
            this.current = 0;

            consumeUntil(TokenType.VAR, TokenType.INICIO);

            if (match(TokenType.VAR)) {
                parseVarBlock();
            }

            consume(TokenType.INICIO, "Esperado 'inicio'.");

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

            Token name = consume(TokenType.IDENTIFIER, "Esperado nome da variável.");

            consume(TokenType.COLON, "Esperado ':' depois do nome da variável.");

            if (
                match(TokenType.INTEIRO) ||
                match(TokenType.REAL) ||
                match(TokenType.CARACTERE) ||
                match(TokenType.LOGICO)
            ) {
                variables.put(name.getLexeme(), null);
            } else {
                throw error(peek(), "Tipo de variável inválido.");
            }

            consumeLineEnd();
        }
    }

    private void executeStatement() {
        if (match(TokenType.NEWLINE)) {
            return;
        }

        if (match(TokenType.ESCREVA)) {
            executeWrite(false);
            consumeLineEnd();
            return;
        }

        if (match(TokenType.ESCREVAL)) {
            executeWrite(true);
            consumeLineEnd();
            return;
        }

        if (check(TokenType.IDENTIFIER)) {
            executeAssignment();
            consumeLineEnd();
            return;
        }

        if (check(TokenType.FIMALGORITMO)) {
            return;
        }

        throw error(peek(), "Comando inválido: " + peek().getLexeme());
    }

    private void executeAssignment() {
        Token name = consume(TokenType.IDENTIFIER, "Esperado nome da variável.");

        if (!variables.containsKey(name.getLexeme())) {
            throw error(name, "Variável não declarada: " + name.getLexeme());
        }

        consume(TokenType.ASSIGN, "Esperado '<-' na atribuição.");

        Object value = evaluateValue();

        variables.put(name.getLexeme(), value);
    }

    private void executeWrite(boolean newline) {
        consume(TokenType.LEFT_PAREN, "Esperado '('.");

        StringBuilder out = new StringBuilder();

        while (!check(TokenType.RIGHT_PAREN) && !isAtEnd()) {
            Object value = evaluateValue();
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

    private Object evaluateValue() {
        if (match(TokenType.STRING)) {
            return previous().getLexeme().replaceAll("^\"|\"$", "");
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
            String name = previous().getLexeme();

            if (!variables.containsKey(name)) {
                throw error(previous(), "Variável não declarada: " + name);
            }

            Object value = variables.get(name);

            if (value == null) {
                throw error(previous(), "Variável sem valor: " + name);
            }

            return value;
        }

        throw error(peek(), "Valor inválido: " + peek().getLexeme());
    }

    private void consumeLineEnd() {
        while (match(TokenType.NEWLINE)) {
            // limpa quebras de linha
        }
    }

    private void consumeUntil(TokenType... types) {
        while (!isAtEnd()) {
            for (TokenType type : types) {
                if (check(type)) {
                    return;
                }
            }
            advance();
        }
    }

    private boolean match(TokenType type) {
        if (check(type)) {
            advance();
            return true;
        }

        return false;
    }

    private boolean check(TokenType type) {
        if (isAtEnd()) {
            return false;
        }

        return peek().getType() == type;
    }

    private Token consume(TokenType type, String message) {
        if (check(type)) {
            return advance();
        }

        throw error(peek(), message);
    }

    private Token advance() {
        if (!isAtEnd()) {
            current++;
        }

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