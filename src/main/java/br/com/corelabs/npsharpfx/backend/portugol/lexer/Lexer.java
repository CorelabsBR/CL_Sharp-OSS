package br.com.corelabs.npsharpfx.backend.portugol.lexer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class Lexer {

    private static final Map<String, TokenType> KEYWORDS = Map.ofEntries(

            Map.entry("algoritmo", TokenType.ALGORITMO),
            Map.entry("var", TokenType.VAR),
            Map.entry("inicio", TokenType.INICIO),
            Map.entry("fimalgoritmo", TokenType.FIMALGORITMO),

            Map.entry("escreva", TokenType.ESCREVA),
            Map.entry("escreval", TokenType.ESCREVAL),

            Map.entry("inteiro", TokenType.INTEIRO),
            Map.entry("real", TokenType.REAL),
            Map.entry("logico", TokenType.LOGICO),
            Map.entry("caractere", TokenType.CARACTERE),
            Map.entry("literal", TokenType.LITERAL),

            Map.entry("verdadeiro", TokenType.BOOLEAN),
            Map.entry("falso", TokenType.BOOLEAN)
    );

    private final String source;

    private final List<Token> tokens =
            new ArrayList<>();

    private int index = 0;

    private int line = 1;

    private int column = 1;

    public Lexer(String source) {
        this.source = source == null
                ? ""
                : source;
    }

    public List<Token> scanTokens() {

        while (!isAtEnd()) {
            scanToken();
        }

        tokens.add(
                new Token(
                        TokenType.EOF,
                        "",
                        line,
                        column
                )
        );

        return tokens;
    }

    private void scanToken() {

        char c = advance();

        switch (c) {

            case ' ', '\r', '\t' -> {
            }

            case '\n' -> {

                tokens.add(
                        new Token(
                                TokenType.NEWLINE,
                                "\\n",
                                line,
                                column
                        )
                );

                line++;
                column = 1;
            }

            case '(' -> add(TokenType.LEFT_PAREN, "(");

            case ')' -> add(TokenType.RIGHT_PAREN, ")");

            case ':' -> add(TokenType.COLON, ":");

            case ',' -> add(TokenType.COMMA, ",");

            case '+' -> add(TokenType.PLUS, "+");

            case '-' -> add(TokenType.MINUS, "-");

            case '*' -> add(TokenType.STAR, "*");

            case '/' -> {

                if (match('/')) {

                    while (!isAtEnd() && peek() != '\n') {
                        advance();
                    }

                    return;
                }

                add(TokenType.SLASH, "/");
            }

            case '"' -> string();

            case '<' -> {

                if (match('-')) {
                    add(TokenType.ASSIGN, "<-");
                    return;
                }

                if (match('=')) {
                    add(TokenType.LESS_EQUAL, "<=");
                    return;
                }

                if (match('>')) {
                    add(TokenType.NOT_EQUAL, "<>");
                    return;
                }

                add(TokenType.LESS, "<");
            }

            case '>' -> {

                if (match('=')) {
                    add(TokenType.GREATER_EQUAL, ">=");
                    return;
                }

                add(TokenType.GREATER, ">");
            }

            case '=' -> add(TokenType.EQUAL, "=");

            default -> {

                if (Character.isDigit(c)) {
                    number(c);
                    return;
                }

                if (Character.isLetter(c) || c == '_') {
                    identifier(c);
                    return;
                }

                throw error(
                        "Caractere invalido: " + c
                );
            }
        }
    }

    private void string() {

        int startColumn = column;

        StringBuilder builder =
                new StringBuilder();

        while (!isAtEnd() && peek() != '"') {

            char c = advance();

            if (c == '\n') {
                line++;
                column = 1;
            }

            builder.append(c);
        }

        if (isAtEnd()) {
            throw error("String nao finalizada");
        }

        advance();

        tokens.add(
                new Token(
                        TokenType.STRING,
                        builder.toString(),
                        line,
                        startColumn
                )
        );
    }

    private void number(char first) {

        int startColumn =
                column - 1;

        StringBuilder builder =
                new StringBuilder();

        builder.append(first);

        while (!isAtEnd()
                && Character.isDigit(peek())) {

            builder.append(advance());
        }

        tokens.add(
                new Token(
                        TokenType.NUMBER,
                        builder.toString(),
                        line,
                        startColumn
                )
        );
    }

    private void identifier(char first) {

        int startColumn =
                column - 1;

        StringBuilder builder =
                new StringBuilder();

        builder.append(first);

        while (!isAtEnd()
                && isIdentifier(peek())) {

            builder.append(advance());
        }

        String text =
                builder.toString();

        TokenType type =
                KEYWORDS.getOrDefault(
                        text.toLowerCase(),
                        TokenType.IDENTIFIER
                );

        tokens.add(
                new Token(
                        type,
                        text,
                        line,
                        startColumn
                )
        );
    }

    private boolean isIdentifier(char c) {
        return Character.isLetterOrDigit(c)
                || c == '_';
    }

    private char advance() {

        char c =
                source.charAt(index++);

        column++;

        return c;
    }

    private boolean match(char expected) {

        if (isAtEnd()) {
            return false;
        }

        if (source.charAt(index) != expected) {
            return false;
        }

        index++;
        column++;

        return true;
    }

    private char peek() {

        if (isAtEnd()) {
            return '\0';
        }

        return source.charAt(index);
    }

    private boolean isAtEnd() {
        return index >= source.length();
    }

    private void add(
            TokenType type,
            String lexeme
    ) {

        tokens.add(
                new Token(
                        type,
                        lexeme,
                        line,
                        column - 1
                )
        );
    }

    private RuntimeException error(String message) {

        return new RuntimeException(
                "[Linha "
                        + line
                        + ", Coluna "
                        + column
                        + "] "
                        + message
        );
    }
}